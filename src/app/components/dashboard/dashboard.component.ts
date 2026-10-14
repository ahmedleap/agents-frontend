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

// Register only what the line chart needs (keeps the bundle small).
Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

const GREEN = '#2f6f2a';
const MUTED = '#5f7267';
const BORDER = '#dbe5de';

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

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  protected volume(v: number): string {
    return volumeFmt.format(v);
  }

  private createChart(el: HTMLCanvasElement): Chart<'line'> {
    return new Chart(el, {
      type: 'line',
      data: {
        labels: this.data.labels,
        datasets: [
          {
            label: 'Total value',
            data: this.series(),
            borderColor: GREEN,
            backgroundColor: 'rgba(47, 111, 42, 0.12)',
            borderWidth: 2,
            fill: true,
            tension: 0.25,
            pointRadius: 3,
            pointHoverRadius: 5,
            pointBackgroundColor: GREEN
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
          x: { grid: { display: false }, ticks: { color: MUTED, maxTicksLimit: 7 } },
          y: {
            grid: { color: BORDER },
            ticks: { color: MUTED, callback: v => usdCompact.format(Number(v)) }
          }
        }
      }
    });
  }
}
