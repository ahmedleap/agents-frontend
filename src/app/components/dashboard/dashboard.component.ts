import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  viewChild
} from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import {
  CategoryScale,
  Chart,
  Filler,
  LineController,
  LineElement,
  LinearScale,
  PointElement,
  Tooltip
} from 'chart.js';

import { DashboardService } from '../../core/services/dashboard.service';
import { ThemeService } from '../../core/services/theme.service';

// Register only what the line chart needs (keeps the bundle small).
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

/** Chart colours from the current theme's CSS tokens (styles.scss), so the chart follows light/dark mode */
function themeColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return { line: token('--pf-chart'), fill: token('--pf-chart-fill'), muted: token('--pf-muted'), border: token('--pf-border') };
}

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});
const volumeFmt = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  private readonly data = inject(DashboardService);
  private readonly theme = inject(ThemeService);

  protected readonly asOf = new Date();

  protected readonly accounts = this.data.accounts;
  protected readonly watchlist = computed(() => this.data.watchlist().slice(0, 3));
  protected readonly trades = computed(() => this.data.trades().slice(0, 5));
  protected readonly movers = this.data.movers;
  protected readonly visibleMovers = computed(() => this.movers().slice(0, 3));
  protected readonly loading = this.data.loading;
  protected readonly error = this.data.error;

  /** Combined value and today's P/L across every account. */
  protected readonly totals = computed(() => {
    const accts = this.accounts();
    const value = accts.reduce((s, a) => s + a.value, 0);
    return {
      value,
      dayPL: this.data.todayProfitLoss(),
      dayPct: this.data.todayProfitLossPercent()
    };
  });

  /** Total value of all accounts for each day, oldest first. */
  protected readonly series = computed(() => {
    return this.data.portfolioHistory();
  });

  protected readonly period = computed(() => {
    const s = this.series();
    if (s.length < 2) return { change: 0, pct: 0, days: 0 };
    const change = s[s.length - 1] - s[0];
    return { change, pct: (change / s[0]) * 100, days: s.length };
  });

  private readonly canvas = viewChild<ElementRef<HTMLCanvasElement>>('valueChart');
  private chart?: Chart<'line'>;

  constructor() {
    // Create the chart once the canvas exists in the DOM...
    afterNextRender(() => {
      const el = this.canvas()?.nativeElement;
      if (!el) return;
      this.chart = this.createChart(el);
    });

    // ...then keep it in sync whenever the data changes.
    effect(() => {
      const data = this.series();
      if (!this.chart) return;
      this.chart.data.labels = this.data.labels();
      this.chart.data.datasets[0].data = data;
      this.chart.update();
    });

    // ...and recolour it when switching between light and dark mode
    effect(() => {
      this.theme.theme();
      if (!this.chart) return;
      // Wait a frame so the new theme's CSS variables are in place
      requestAnimationFrame(() => this.applyThemeColors());
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  private applyThemeColors(): void {
    const chart = this.chart;
    if (!chart) return;
    const c = themeColors();
    const dataset = chart.data.datasets[0];
    dataset.borderColor = c.line;
    dataset.backgroundColor = c.fill;
    (dataset as { pointBackgroundColor?: string }).pointBackgroundColor = c.line;
    const scales = chart.options.scales as Record<string, { grid?: { color?: string }; ticks?: { color?: string } }>;
    if (scales['x']?.ticks) scales['x'].ticks.color = c.muted;
    if (scales['y']?.ticks) scales['y'].ticks.color = c.muted;
    if (scales['y']?.grid) scales['y'].grid.color = c.border;
    chart.update('none');
  }

  protected volume(v: number): string {
    return volumeFmt.format(v);
  }

  private createChart(el: HTMLCanvasElement): Chart<'line'> {
    const c = themeColors();
    return new Chart(el, {
      type: 'line',
      data: {
        labels: this.data.labels(),
        datasets: [
          {
            label: 'Total value',
            data: this.series(),
            borderColor: c.line,
            backgroundColor: c.fill,
            borderWidth: 2,
            fill: false,
            tension: 0.25,
            pointRadius: 0,
            pointHoverRadius: 5,
            pointHitRadius: 12,
            pointBackgroundColor: c.line
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: false,
            callbacks: { label: ctx => usd.format(ctx.parsed.y ?? 0) }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: c.muted, maxTicksLimit: 7 } },
          y: {
            grid: { color: c.border },
            ticks: { color: c.muted, maxTicksLimit: 3, callback: v => usdCompact.format(Number(v)) }
          }
        }
      }
    });
  }
}
