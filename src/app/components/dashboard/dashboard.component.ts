import {
  Component,
  DestroyRef,
  ElementRef,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
  untracked,
  viewChild
} from '@angular/core';
import { RouterLink } from '@angular/router';
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

import { DashboardService, WatchItem } from '../../core/services/dashboard.service';
import { ThemeService } from '../../core/services/theme.service';
import { TradingApiService } from '../../core/services/trading-api.service';
import { WatchlistService } from '../../core/services/watchlist.service';
import { PagerComponent } from '../pager/pager.component';
import { TickerLogoDirective } from '../../core/ticker-logo.directive';

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
const shortDate = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });

/** The dashboard asks the backend for this many days of history (DashboardService: period=30D) */
const HISTORY_DAYS = 30;

/** Today as YYYY-MM-DD in the user's time zone, to match the backend's snapshot dates */
function todayIso(): string {
  return new Date().toLocaleDateString('en-CA');
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink, PagerComponent, TickerLogoDirective],
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent {
  private readonly data = inject(DashboardService);
  private readonly theme = inject(ThemeService);

  protected readonly asOf = new Date();

  protected readonly accounts = this.data.accounts;
  private readonly watchlistApi = inject(WatchlistService);
  private readonly tradingApi = inject(TradingApiService);
  /** Prices for watchlist entries the dashboard response didn't include (e.g. just added) */
  private readonly quotes = signal<Record<string, Pick<WatchItem, 'price' | 'change' | 'changePct'>>>({});
  private readonly quoteRequested = new Set<string>();

  /** The live watchlist (so stars on the Trades page and removals here show straight away), with prices */
  protected readonly watchlist = computed(() => {
    const prices = new Map(this.data.watchlist().map(item => [item.ticker, item]));
    const quotes = this.quotes();
    return this.watchlistApi.entries().map(entry => ({
      ...prices.get(entry.ticker),
      ...quotes[entry.ticker],
      instrumentId: entry.instrumentId,
      ticker: entry.ticker,
      name: entry.instrumentName
    }));
  });
  /** Watchlist pages: a few rows at a time, so the card keeps its size */
  protected readonly watchPageSize = 4;
  protected readonly watchPage = signal(0);
  protected readonly pagedWatchlist = computed(() => {
    const all = this.watchlist();
    // Removing the last row on a page moves back a page
    const lastPage = Math.max(0, Math.ceil(all.length / this.watchPageSize) - 1);
    const page = Math.min(this.watchPage(), lastPage);
    return all.slice(page * this.watchPageSize, (page + 1) * this.watchPageSize);
  });
  protected readonly watchlistLoaded = this.watchlistApi.loaded;
  protected readonly watchlistError = this.watchlistApi.error;
  /** Edit mode shows a remove button on each watchlist row */
  protected readonly editingWatchlist = signal(false);
  protected readonly trades = computed(() => this.data.trades().slice(0, 5));
  protected readonly movers = this.data.movers;
  protected readonly visibleMovers = computed(() => this.movers().slice(0, 3));
  protected readonly moversLoading = this.data.moversLoading;
  protected readonly moversError = this.data.moversError;
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

  protected readonly historyDays = HISTORY_DAYS;

  /**
   * Combined value for each day, oldest first: the backend's daily snapshots, ending with today's
   * live total (snapshots are only recorded once a day, so today's is usually missing or out of date).
   */
  private readonly history = computed(() => {
    const dates = this.data.labels();
    const values = this.data.portfolioHistory();
    const points = dates.map((date, i) => ({ date, value: values[i] }));
    if (!this.loading() && this.accounts().length) {
      const today = todayIso();
      const live = { date: today, value: this.totals().value };
      if (points.at(-1)?.date === today) points[points.length - 1] = live;
      else points.push(live);
    }
    return points;
  });

  /** Total value of all accounts for each day, oldest first. */
  protected readonly series = computed(() => this.history().map(point => point.value));
  private readonly chartLabels = computed(() => this.history().map(point => shortDate.format(new Date(point.date))));

  /** Change over the period; null until there are at least two days to compare */
  protected readonly period = computed(() => {
    const s = this.series();
    if (s.length < 2 || !s[0]) return null;
    const change = s[s.length - 1] - s[0];
    return { change, pct: (change / s[0]) * 100 };
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
      this.chart.data.labels = this.chartLabels();
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

    // Fetch a price for any watchlist entry on the current page that doesn't have one yet
    effect(() => {
      for (const item of this.pagedWatchlist()) {
        if (item.price !== undefined || this.quoteRequested.has(item.ticker)) continue;
        this.quoteRequested.add(item.ticker);
        this.tradingApi.getQuote(item.ticker).subscribe({
          next: quote => {
            const price = Number(quote.lastPrice ?? quote.currentPrice ?? quote.midPrice);
            const change = quote.priceChange ?? quote.dayChange;
            const changePct = quote.priceChangePercent ?? quote.dayChangePercent;
            this.quotes.update(all => ({
              ...all,
              [item.ticker]: {
                price: Number.isFinite(price) && price > 0 ? price : undefined,
                change: change === undefined ? undefined : Number(change),
                changePct: changePct === undefined ? undefined : Number(changePct)
              }
            }));
          },
          error: () => undefined
        });
      }
    });

    // Keep the page in range after removals
    effect(() => {
      const lastPage = Math.max(0, Math.ceil(this.watchlist().length / this.watchPageSize) - 1);
      if (untracked(() => this.watchPage()) > lastPage) this.watchPage.set(lastPage);
    });

    // Nothing left to edit: leave edit mode
    effect(() => {
      if (!this.watchlist().length) this.editingWatchlist.set(false);
    });

    inject(DestroyRef).onDestroy(() => this.chart?.destroy());
  }

  protected toggleWatchlistEdit(): void {
    this.editingWatchlist.update(on => !on);
  }

  protected isRemoving(instrumentId: string): boolean {
    return this.watchlistApi.isPending(instrumentId);
  }

  protected removeFromWatchlist(instrumentId: string): void {
    // Failures show in the card (WatchlistService.error)
    this.watchlistApi.remove(instrumentId).subscribe({ error: () => undefined });
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
        labels: this.chartLabels(),
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
