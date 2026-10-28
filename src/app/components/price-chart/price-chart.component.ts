import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, input, model, signal } from '@angular/core';

/** One price bar; open/high/low/volume are optional (the backend doesn't always send them) */
export interface ChartBar {
  timestamp?: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export type ChartMode = 'line' | 'candles';

interface Candle {
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/** More bars than this are merged into wider candles so each one stays readable */
const MAX_CANDLES = 60;
/** The chart is 48 units tall; with volume, prices use the top and volume bars the bottom band */
const VOLUME_BAND = 12;
const PRICE_BOTTOM_WITH_VOLUME = 33;

const compactVolume = new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 });

/**
 * Price history for the order pop-up: a line chart, with candlesticks that can be layered over it,
 * and shaded volume bars along the bottom. Hovering a candle shows its open, high, low, close and volume.
 */
@Component({
  selector: 'app-price-chart',
  standalone: true,
  imports: [CurrencyPipe, DatePipe],
  templateUrl: './price-chart.component.html',
  styleUrl: './price-chart.component.scss'
})
export class PriceChartComponent {
  readonly bars = input.required<ChartBar[]>();
  /** Line colour */
  readonly color = input('#2f6f2a');
  readonly mode = model<ChartMode>('line');

  protected readonly hovered = signal<number | null>(null);

  protected readonly candles = computed(() => toCandles(this.bars()));
  /** Only draw volume when the data has some */
  protected readonly hasVolume = computed(() => this.candles().some(c => c.volume > 0));

  /** Shared vertical scale (viewBox is 100 x 48) so lines and candles line up */
  private readonly scale = computed(() => {
    const candles = this.candles();
    const max = Math.max(...candles.map(c => c.high));
    const min = Math.min(...candles.map(c => c.low));
    const range = max - min || 1;
    // Leave the bottom band free for the volume bars
    const bottom = this.hasVolume() ? PRICE_BOTTOM_WITH_VOLUME : 46;
    return (value: number) => bottom - ((value - min) / range) * (bottom - 2);
  });

  /** Shaded volume bars, one per candle, tallest = the busiest period */
  protected readonly volumeBars = computed(() => {
    if (!this.hasVolume()) return [];
    const candles = this.candles();
    const max = Math.max(...candles.map(c => c.volume));
    const slot = 100 / Math.max(candles.length, 1);
    return candles.map((c, i) => {
      const height = (c.volume / max) * VOLUME_BAND;
      return { x: i * slot + slot * 0.15, width: slot * 0.7, y: 48 - height, height, up: c.close >= c.open };
    });
  });

  protected readonly linePoints = computed(() => {
    const candles = this.candles();
    const y = this.scale();
    if (this.mode() === 'candles') {
      // Through the middle of each candle, so the line meets every close
      const slot = 100 / Math.max(candles.length, 1);
      return candles.map((c, i) => `${i * slot + slot / 2},${y(c.close)}`).join(' ');
    }
    const step = 100 / Math.max(candles.length - 1, 1);
    return candles.map((c, i) => `${i * step},${y(c.close)}`).join(' ');
  });

  protected readonly candleShapes = computed(() => {
    const candles = this.candles();
    const y = this.scale();
    const slot = 100 / Math.max(candles.length, 1);
    return candles.map((c, i) => ({
      slotX: i * slot,
      slot,
      x: i * slot + slot / 2,
      // Slim bodies (36% of each candle's column) so the line still shows between them
      bodyX: i * slot + slot * 0.32,
      bodyWidth: slot * 0.36,
      top: y(Math.max(c.open, c.close)),
      // Keep flat candles (open = close) visible as a thin bar
      height: Math.max(Math.abs(y(c.open) - y(c.close)), 0.6),
      highY: y(c.high),
      lowY: y(c.low),
      up: c.close >= c.open
    }));
  });

  /** The hovered candle, or the latest one */
  protected readonly readout = computed(() => {
    const candles = this.candles();
    return candles[this.hovered() ?? candles.length - 1] ?? null;
  });

  /** Times for a single day's bars, dates otherwise */
  protected readonly dateFormat = computed(() => {
    const days = new Set(this.candles().map(c => c.timestamp?.slice(0, 10)));
    return days.size <= 1 ? 'h:mm a' : 'MMM d, y';
  });
  /** A day's times in the computer's time zone; daily bars are stamped midnight UTC, so their dates stay in UTC */
  protected readonly dateZone = computed(() => this.dateFormat() === 'h:mm a' ? undefined : 'UTC');

  protected volumeLabel(volume: number): string {
    return compactVolume.format(volume);
  }

  protected setMode(mode: ChartMode): void {
    this.mode.set(mode);
    this.hovered.set(null);
  }
}

function toCandles(bars: ChartBar[]): Candle[] {
  const valid = bars.filter(bar => Number.isFinite(bar.close) && bar.close > 0);
  const price = (value: number | undefined) => value !== undefined && Number.isFinite(value) && value > 0 ? value : undefined;

  // Fill in missing open/high/low: open at the previous close, high/low from the open and close
  const full = valid.map((bar, i): Candle => {
    const open = price(bar.open) ?? valid[i - 1]?.close ?? bar.close;
    return {
      timestamp: bar.timestamp,
      open,
      high: Math.max(price(bar.high) ?? 0, open, bar.close),
      low: Math.min(price(bar.low) ?? Infinity, open, bar.close),
      close: bar.close,
      volume: bar.volume !== undefined && Number.isFinite(bar.volume) && bar.volume > 0 ? bar.volume : 0
    };
  });

  const size = Math.ceil(full.length / MAX_CANDLES);
  if (size <= 1) return full;
  const merged: Candle[] = [];
  for (let i = 0; i < full.length; i += size) {
    const group = full.slice(i, i + size);
    merged.push({
      timestamp: group[0].timestamp,
      open: group[0].open,
      high: Math.max(...group.map(c => c.high)),
      low: Math.min(...group.map(c => c.low)),
      close: group[group.length - 1].close,
      volume: group.reduce((sum, c) => sum + c.volume, 0)
    });
  }
  return merged;
}
