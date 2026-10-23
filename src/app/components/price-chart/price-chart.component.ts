import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, input, model, signal } from '@angular/core';

/** One price bar; open/high/low are optional (the backend doesn't always send them) */
export interface ChartBar {
  timestamp?: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
}

export type ChartMode = 'line' | 'candles';

interface Candle {
  timestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
}

/** More bars than this are merged into wider candles so each one stays readable */
const MAX_CANDLES = 60;

/**
 * Price history for the order pop-up: a line chart, with candlesticks that can be layered over it.
 * Candles show each period's open, high, low and close; hovering one shows its numbers.
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

  /** Shared vertical scale (viewBox is 100 x 48) so lines and candles line up */
  private readonly scale = computed(() => {
    const candles = this.candles();
    const max = Math.max(...candles.map(c => c.high));
    const min = Math.min(...candles.map(c => c.low));
    const range = max - min || 1;
    return (value: number) => 46 - ((value - min) / range) * 44;
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
      close: bar.close
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
      close: group[group.length - 1].close
    });
  }
  return merged;
}
