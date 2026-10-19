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

/** Reads the current theme's chart colours from the CSS tokens in styles.scss. */
function chartColors() {
  const css = getComputedStyle(document.documentElement);
  const token = (name: string) => css.getPropertyValue(name).trim();
  return {
    line: token('--pf-chart'),
    fill: token('--pf-chart-fill'),
    muted: token('--pf-muted'),
    border: token('--pf-border')
  };
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
  private readonly theme = inject(ThemeService).theme;

  protected readonly asOf = new Date();

  protected readonly accounts = this.data.accounts;
  protected readonly watchlist = this.data.watchlist;
  protected readonly trades = this.data.trades;
  protected readonly movers = this.data.movers;

  /** Combined value and today's P/L across every account. */
  protected readonly totals = computed(() => {
    const accts = this.accounts();
    const value = accts.reduce((s, a) => s + a.value, 0);
    const dayPL = accts.reduce((s, a) => s + a.dayPL, 0);
    const prev = value - dayPL;
    return { value, dayPL, dayPct: prev ? (dayPL / prev) * 100 : 0 };
  });

  /** Total value of all accounts for each day, oldest first. */
  protected readonly series = computed(() => {
    const accts = this.accounts();
    const length = accts[0]?.history.length ?? 0;
    return Array.from({ length }, (_, i) => accts.reduce((s, a) => s + a.history[i], 0));
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
      this.chart.data.datasets[0].data = data;
      this.chart.update();
    });

    // Recolour the chart when switching light / dark mode
    effect(() => {
      this.theme();
      if (!this.chart) return;
      this.applyColors(this.chart);
      this.chart.update('none');
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  protected volume(v: number): string {
    return volumeFmt.format(v);
  }

  private applyColors(chart: Chart<'line'>): void {
    const c = chartColors();
    const ds = chart.data.datasets[0];
    ds.borderColor = c.line;
    ds.backgroundColor = c.fill;
    ds.pointBackgroundColor = c.line;
    const { x, y } = chart.options.scales!;
    x!.ticks!.color = c.muted;
    y!.ticks!.color = c.muted;
    y!.grid!.color = c.border;
  }

  private createChart(el: HTMLCanvasElement): Chart<'line'> {
    const c = chartColors();
    return new Chart(el, {
      type: 'line',
      data: {
        labels: this.data.labels,
        datasets: [
          {
            label: 'Total value',
            data: this.series(),
            borderColor: c.line,
            backgroundColor: c.fill,
            borderWidth: 2,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 5,
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
            ticks: { color: c.muted, callback: v => usdCompact.format(Number(v)) }
          }
        }
      }
    });
  }
}
