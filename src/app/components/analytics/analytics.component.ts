import {
  Component,
  DestroyRef,
  ElementRef,
  Signal,
  afterRenderEffect,
  computed,
  inject,
  signal,
  viewChild
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { DecimalPipe } from '@angular/common';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { format, parseISO, startOfMonth, startOfWeek, subDays } from 'date-fns';
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

import {
  AnalyticsService,
  InstrumentTrendResponse,
  SegmentType,
  VolumeTrendResponse,
  isoDate
} from '../../core/services/analytics.service';
import { ThemeService } from '../../core/services/theme.service';
import { TickerLogoDirective } from '../../core/ticker-logo.directive';

Chart.register(LineController, LineElement, PointElement, LinearScale, CategoryScale, Filler, Tooltip);

type Preset = 'today' | 'week' | 'month' | 'custom';
type InstrumentSort = 'totalValue' | 'totalQuantity' | 'uniqueTraders';

/** How many tickers / segments get their own line. Matches the --pf-series-N tokens. */
const MAX_SERIES = 5;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1
});
const compact = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });
const centralHour = new Intl.DateTimeFormat('en-US', {
  timeZone: 'America/Chicago',
  hour: 'numeric',
  hour12: true
});

/** Rates may arrive as 0-1 or 0-100; always show them as 0-100. */
function asPercent(v: number): number {
  return v <= 1 ? v * 100 : v;
}

/** Lets one failing endpoint blank out its own card instead of the whole page. */
function orNull<T>(obs: Observable<T>): Observable<T | null> {
  return obs.pipe(catchError(() => of(null)));
}

function titleCase(s: string): string {
  if (s.length <= 3) return s.toUpperCase(); // ETF, not Etf
  return s.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function shortDate(iso: string): string {
  return format(parseISO(iso), 'MMM d');
}

/** Groups rows by date (sorted) and series key into a value grid for a multi-line chart. */
function pivot<T extends { date: string }>(
  rows: T[],
  key: (r: T) => string,
  value: (r: T) => number,
  seriesKeys: string[]
) {
  const dates = [...new Set(rows.map(r => r.date))].sort();
  const index = new Map(dates.map((d, i) => [d, i]));
  const series = seriesKeys.map(k => ({ key: k, data: new Array<number>(dates.length).fill(0) }));
  const byKey = new Map(series.map(s => [s.key, s]));
  for (const r of rows) {
    const s = byKey.get(key(r));
    if (s) s.data[index.get(r.date)!] += value(r);
  }
  return { labels: dates.map(shortDate), series };
}

interface LineChartSpec {
  labels: string[];
  series: { label: string; data: number[]; color: string }[];
  stacked?: boolean;
  format: (v: number) => string;
  yMin?: number;
  yMax?: number;
}

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

@Component({
  selector: 'app-analytics',
  standalone: true,
  imports: [DecimalPipe, TickerLogoDirective],
  templateUrl: './analytics.component.html',
  styleUrls: ['./analytics.component.scss']
})
export class AnalyticsComponent {
  private readonly api = inject(AnalyticsService);
  private readonly theme = inject(ThemeService).theme;

  protected readonly today = isoDate(new Date());

  // ---------- Date selector ----------

  protected readonly presets: { id: Preset; label: string }[] = [
    { id: 'today', label: 'Today' },
    { id: 'week', label: 'This Week' },
    { id: 'month', label: 'This Month' },
    { id: 'custom', label: 'Custom' }
  ];
  protected readonly preset = signal<Preset>('month');
  protected readonly customStart = signal(isoDate(subDays(new Date(), 29)));
  protected readonly customEnd = signal(this.today);

  /**
   * KPI cards and the instruments table are daily, so they use the last day of the range.
  * Trend charts use the whole range; "Today" is limited to the current trading day.
   */
  protected readonly range = computed(() => {
    const now = new Date();
    switch (this.preset()) {
      case 'today':
        return { start: this.today, end: this.today, label: 'Today' };
      case 'week':
        return { start: isoDate(startOfWeek(now, { weekStartsOn: 1 })), end: this.today, label: 'This week' };
      case 'month':
        return { start: isoDate(startOfMonth(now)), end: this.today, label: 'This month' };
      case 'custom': {
        const [start, end] = [this.customStart(), this.customEnd()].sort();
        return { start, end, label: `${format(parseISO(start), 'MMM d, y')} – ${format(parseISO(end), 'MMM d, y')}` };
      }
      default:
        return { start: this.today, end: this.today, label: 'Today' };
    }
  });

  protected readonly day = computed(() => this.range().end);
  protected readonly dayLabel = computed(() =>
    this.day() === this.today ? 'Today' : format(parseISO(this.day()), 'MMM d, y')
  );

  protected setPreset(p: Preset): void {
    this.preset.set(p);
  }

  protected setCustom(which: 'start' | 'end', value: string): void {
    if (!value) return;
    (which === 'start' ? this.customStart : this.customEnd).set(value > this.today ? this.today : value);
  }

  // ---------- Daily KPIs ----------

  protected readonly kpis = rxResource({
    params: () => this.day(),
    stream: ({ params: date }) =>
      forkJoin({
        clients: orNull(this.api.activeClients(date))
      })
  });

  // ---------- Most active instruments ----------

  protected readonly instrumentSort = signal<InstrumentSort>('uniqueTraders');
  protected readonly sortOptions: { id: InstrumentSort; label: string }[] = [
    { id: 'totalValue', label: 'Value' },
    { id: 'totalQuantity', label: 'Volume' },
    { id: 'uniqueTraders', label: 'Traders' }
  ];

  protected readonly instruments = rxResource({
    params: () => 20,
    stream: ({ params: limit }) => this.api.topTradedInstruments(limit)
  });

  protected readonly instrumentRows = computed(() => {
    const res = this.instruments.value();
    if (!res) return [];
    const key = this.instrumentSort();
    return [...res]
      .sort((a, b) => (b[key] ?? 0) - (a[key] ?? 0))
      .map((r, i) => {
        return { ...r, rank: i + 1, change: r.dayChangePercent ?? null };
      });
  });

  // ---------- Volume trend ----------

  protected readonly volumeTrend = rxResource({
    params: () => this.range(),
    stream: ({ params: r }) => this.preset() === 'today'
      ? this.api.intradayVolume(r.start).pipe(
          map(rows => rows.map(row => ({
            date: row.bucketStart,
            totalQuantityTraded: row.totalQuantityTraded,
            totalValueTraded: row.totalValueTraded,
            tradeCount: row.tradeCount,
            buyCount: row.buyCount,
            sellCount: row.sellCount
          } satisfies VolumeTrendResponse)))
        )
      : this.api.volumeTrend(r.start, r.end)
  });

  protected readonly volumeTotals = computed(() => {
    const rows = this.volumeTrend.value() ?? [];
    const trades = rows.reduce((s, r) => s + r.tradeCount, 0);
    const buys = rows.reduce((s, r) => s + r.buyCount, 0);
    const sells = rows.reduce((s, r) => s + r.sellCount, 0);
    return {
      quantity: rows.reduce((s, r) => s + r.totalQuantityTraded, 0),
      value: rows.reduce((s, r) => s + r.totalValueTraded, 0),
      trades,
      buys,
      sells,
      buyPercent: trades ? (buys / trades) * 100 : 0,
      sellPercent: trades ? (sells / trades) * 100 : 0
    };
  });

  private readonly volumeChart = computed<LineChartSpec>(() => {
    const rows = [...(this.volumeTrend.value() ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    this.theme();
    return {
      labels: rows.map(r => this.preset() === 'today' ? centralHour.format(parseISO(r.date)) : shortDate(r.date)),
      series: [{ label: 'Value traded', data: rows.map(r => r.totalValueTraded), color: token('--pf-chart') }],
      format: v => usdCompact.format(v)
    };
  });

  // ---------- Instrument trend (top tickers over the range) ----------

  protected readonly instrumentTrend = rxResource({
    params: () => this.range(),
    stream: ({ params: r }) => this.api.instrumentTrend(r.start, r.end)
  });

  /** The top tickers by value over the range, in a stable order so colours stay put. */
  protected readonly trendTickers = computed(() => {
    const totals = new Map<string, number>();
    for (const r of this.instrumentTrend.value() ?? []) {
      totals.set(r.ticker, (totals.get(r.ticker) ?? 0) + r.totalValue);
    }
    return [...totals.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_SERIES)
      .map(([ticker, total], i) => ({ ticker, total, color: `var(--pf-series-${i + 1})`, slot: i + 1 }));
  });

  private readonly instrumentChart = computed<LineChartSpec>(() => {
    const tickers = this.trendTickers();
    this.theme();
    const { labels, series } = pivot(
      this.instrumentTrend.value() ?? [],
      (r: InstrumentTrendResponse) => r.ticker,
      r => r.totalValue,
      tickers.map(t => t.ticker)
    );
    return {
      labels,
      series: series.map((s, i) => ({ label: s.key, data: s.data, color: token(`--pf-series-${i + 1}`) })),
      format: v => usdCompact.format(v)
    };
  });

  // ---------- Client segments ----------

  protected readonly segmentType = signal<SegmentType>('RISK_TOLERANCE');

  protected readonly segments = rxResource({
    params: () => ({ ...this.range(), type: this.segmentType() }),
    stream: ({ params: p }) => this.api.segmentTrends(p.type, p.start, p.end)
  });

  protected readonly segmentSummary = computed(() => {
    const totals = new Map<string, { volume: number; value: number; trades: number }>();
    for (const r of this.segments.value() ?? []) {
      const t = totals.get(r.segment) ?? { volume: 0, value: 0, trades: 0 };
      t.volume += r.totalVolume;
      t.value += r.averageOrderValue * r.tradeCount;
      t.trades += r.tradeCount;
      totals.set(r.segment, t);
    }
    const all = [...totals.values()].reduce((s, t) => s + t.volume, 0) || 1;
    // Keep the API's segment order (e.g. Conservative -> Aggressive) so colours follow the segment
    return [...totals.entries()].slice(0, MAX_SERIES).map(([segment, t], i) => ({
      segment,
      label: titleCase(segment),
      ...t,
      pct: (t.volume / all) * 100,
      color: `var(--pf-series-${i + 1})`,
      slot: i + 1
    }));
  });

  private readonly segmentChart = computed<LineChartSpec>(() => {
    const summary = this.segmentSummary();
    this.theme();
    const { labels, series } = pivot(
      this.segments.value() ?? [],
      r => r.segment,
      r => r.totalVolume,
      summary.map(s => s.segment)
    );
    return {
      labels,
      stacked: true,
      series: series.map((s, i) => ({ label: summary[i].label, data: s.data, color: token(`--pf-series-${i + 1}`) })),
      format: v => `${compact.format(v)} shares`
    };
  });

  // ---------- Order fulfillment ----------

  protected readonly fulfillment = rxResource({
    params: () => this.range(),
    stream: ({ params: r }) => this.api.fulfillmentTrends(r.start, r.end)
  });

  protected readonly fulfillmentTotals = computed(() => {
    const rows = this.fulfillment.value() ?? [];
    const total = rows.reduce((s, r) => s + r.totalOrders, 0);
    const filled = rows.reduce((s, r) => s + r.filledOrders, 0);
    const cancelled = rows.reduce((s, r) => s + r.cancelledOrders, 0);
    const pending = Math.max(0, total - filled - cancelled);
    const weightedSecs = rows.reduce((s, r) => s + r.averageOrderDurationSeconds * r.totalOrders, 0);
    const pct = (n: number) => (total ? (n / total) * 100 : 0);
    return {
      total,
      filled,
      cancelled,
      pending,
      filledPct: pct(filled),
      cancelledPct: pct(cancelled),
      pendingPct: pct(pending),
      avgMinutes: total ? weightedSecs / total / 60 : 0
    };
  });

  private readonly fulfillmentChart = computed<LineChartSpec>(() => {
    const rows = [...(this.fulfillment.value() ?? [])].sort((a, b) => a.date.localeCompare(b.date));
    this.theme();
    const rates = rows.map(r => asPercent(r.fulfillmentRate));
    return {
      labels: rows.map(r => shortDate(r.date)),
      series: [{ label: 'Fulfillment rate', data: rates, color: token('--pf-chart') }],
      format: v => `${v.toFixed(1)}%`,
      yMin: rates.length ? Math.max(0, Math.floor(Math.min(...rates) / 5) * 5 - 5) : 0,
      yMax: 100
    };
  });

  // ---------- Charts ----------

  private readonly charts = new Map<string, Chart<'line'>>();

  private readonly volumeCanvas = viewChild<ElementRef<HTMLCanvasElement>>('volumeCanvas');
  private readonly instrumentCanvas = viewChild<ElementRef<HTMLCanvasElement>>('instrumentCanvas');
  private readonly segmentCanvas = viewChild<ElementRef<HTMLCanvasElement>>('segmentCanvas');
  private readonly fulfillmentCanvas = viewChild<ElementRef<HTMLCanvasElement>>('fulfillmentCanvas');

  constructor() {
    this.bindChart('volume', this.volumeCanvas, this.volumeChart);
    this.bindChart('instrument', this.instrumentCanvas, this.instrumentChart);
    this.bindChart('segment', this.segmentCanvas, this.segmentChart);
    this.bindChart('fulfillment', this.fulfillmentCanvas, this.fulfillmentChart);

    inject(DestroyRef).onDestroy(() => this.charts.forEach(c => c.destroy()));
  }

  protected usd(v: number): string {
    return usd.format(v);
  }

  protected usdCompact(v: number): string {
    return usdCompact.format(v);
  }

  protected compact(v: number): string {
    return compact.format(v);
  }

  protected percent(v: number): number {
    return asPercent(v);
  }

  protected assetClass(v?: string): string {
    return v ? titleCase(v) : '—';
  }

  /** Creates the chart the first time its canvas and data exist, then keeps it in sync. */
  private bindChart(
    key: string,
    canvas: Signal<ElementRef<HTMLCanvasElement> | undefined>,
    spec: Signal<LineChartSpec>
  ): void {
    afterRenderEffect(() => {
      const el = canvas()?.nativeElement;
      const s = spec();
      if (!el) return;

      const existing = this.charts.get(key);
      if (existing && existing.canvas !== el) {
        existing.destroy();
        this.charts.delete(key);
      }
      const chart = this.charts.get(key);
      if (chart) {
        this.applySpec(chart, s);
        chart.update();
      } else {
        this.charts.set(key, this.createChart(el, s));
      }
    });
  }

  private datasets(s: LineChartSpec) {
    const single = s.series.length === 1;
    return s.series.map(series => ({
      label: series.label,
      data: series.data,
      borderColor: series.color,
      backgroundColor: single || s.stacked ? series.color + (single ? '1f' : '59') : series.color,
      pointBackgroundColor: series.color,
      borderWidth: 2,
      fill: single ? true : s.stacked ? 'stack' : false,
      tension: 0.25,
      pointRadius: s.labels.length > 31 ? 0 : 2.5,
      pointHoverRadius: 5
    }));
  }

  private applySpec(chart: Chart<'line'>, s: LineChartSpec): void {
    const muted = token('--pf-muted');
    const border = token('--pf-border');
    chart.data.labels = s.labels;
    chart.data.datasets = this.datasets(s) as Chart<'line'>['data']['datasets'];
    const { x, y } = chart.options.scales!;
    x!.ticks!.color = muted;
    y!.ticks!.color = muted;
    y!.grid!.color = border;
    y!.min = s.yMin;
    y!.max = s.yMax;
    (y as { stacked?: boolean }).stacked = !!s.stacked;
  }

  private createChart(el: HTMLCanvasElement, s: LineChartSpec): Chart<'line'> {
    const muted = token('--pf-muted');
    const border = token('--pf-border');
    return new Chart<'line'>(el, {
      type: 'line',
      data: { labels: s.labels, datasets: this.datasets(s) as Chart<'line'>['data']['datasets'] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: { display: false },
          tooltip: {
            displayColors: s.series.length > 1,
            callbacks: {
              label: ctx => {
                const v = s.format(ctx.parsed.y ?? 0);
                return s.series.length > 1 ? `${ctx.dataset.label}: ${v}` : v;
              }
            }
          }
        },
        scales: {
          x: { grid: { display: false }, ticks: { color: muted, maxTicksLimit: 8, maxRotation: 0 } },
          y: {
            stacked: !!s.stacked,
            beginAtZero: true,
            min: s.yMin,
            max: s.yMax,
            grid: { color: border },
            ticks: { color: muted, maxTicksLimit: 6, callback: v => s.format(Number(v)).replace(' shares', '') }
          }
        }
      }
    });
  }
}
