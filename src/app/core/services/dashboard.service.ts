import { Injectable, signal } from '@angular/core';

export interface AccountSummary {
  id: string;
  name: string;
  value: number;
  dayPL: number;
  dayPct: number;
  /** Daily closing values, oldest first. Same length for every account. */
  history: number[];
}

export interface WatchItem {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
}

export interface Trade {
  id: string;
  time: Date;
  side: 'Buy' | 'Sell';
  ticker: string;
  shares: number;
  price: number;
  account: string;
}

export interface Mover {
  ticker: string;
  name: string;
  price: number;
  change: number;
  changePct: number;
  volume: number;
}

// Mock market: % change into each day (13 moves => 14 data points).
const MARKET_MOVES = [0.4, -0.3, 0.8, 0.5, -0.6, 0.9, 0.2, -0.4, 1.1, 0.3, -0.2, 0.7, 0.6];

/** Rebuilds a plausible value history backwards from today's value. */
function buildHistory(current: number, beta: number, lastDayBias = 0): number[] {
  const last = MARKET_MOVES.length - 1;
  const moves = MARKET_MOVES.map((m, i) => (m * beta + (i === last ? lastDayBias : 0)) / 100);
  const history = new Array<number>(moves.length + 1);
  history[moves.length] = current;
  for (let i = moves.length; i > 0; i--) {
    history[i - 1] = history[i] / (1 + moves[i - 1]);
  }
  return history;
}

function summarise(id: string, name: string, history: number[]): AccountSummary {
  const value = history[history.length - 1];
  const prev = history[history.length - 2];
  const dayPL = value - prev;
  return { id, name, value, dayPL, dayPct: (dayPL / prev) * 100, history };
}

function daysAgo(hours: number): Date {
  return new Date(Date.now() - hours * 3_600_000);
}

/**
 * Mock data for now. When the trading API is ready, inject HttpClient here,
 * read the base URL from environment.ts, and keep these signals as the public surface
 * so the dashboard component doesn't have to change.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
  /** One label per history point, ending today. */
  readonly labels: string[] = Array.from({ length: MARKET_MOVES.length + 1 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (MARKET_MOVES.length - i));
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  });

  readonly accounts = signal<AccountSummary[]>([
    summarise('premium', 'Premium Trading Account', buildHistory(64912.5, 1.0)),
    summarise('retirement', 'Retirement Growth', buildHistory(128430.18, 0.6)),
    summarise('swing', 'Swing Trading', buildHistory(21845.6, 1.6, -1.4)),
    summarise('dividend', 'Dividend Income', buildHistory(87210.75, 0.4))
  ]);

  readonly watchlist = signal<WatchItem[]>([
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 492.44, change: 8.12, changePct: 1.68 },
    { ticker: 'AMZN', name: 'Amazon.com Inc.', price: 146.8, change: -1.35, changePct: -0.91 },
    { ticker: 'GOOGL', name: 'Alphabet Inc.', price: 139.27, change: 0.84, changePct: 0.61 },
    { ticker: 'META', name: 'Meta Platforms', price: 331.05, change: 4.9, changePct: 1.5 },
    { ticker: 'AMD', name: 'Advanced Micro Devices', price: 121.6, change: -2.2, changePct: -1.78 }
  ]);

  readonly trades = signal<Trade[]>([
    { id: 't1', time: daysAgo(1), side: 'Buy', ticker: 'AAPL', shares: 25, price: 177.9, account: 'Premium Trading Account' },
    { id: 't2', time: daysAgo(3), side: 'Sell', ticker: 'TSLA', shares: 10, price: 196.4, account: 'Swing Trading' },
    { id: 't3', time: daysAgo(6), side: 'Buy', ticker: 'MSFT', shares: 12, price: 376.2, account: 'Retirement Growth' },
    { id: 't4', time: daysAgo(27), side: 'Buy', ticker: 'KO', shares: 80, price: 59.15, account: 'Dividend Income' },
    { id: 't5', time: daysAgo(30), side: 'Sell', ticker: 'AMD', shares: 40, price: 123.8, account: 'Swing Trading' }
  ]);

  readonly movers = signal<Mover[]>([
    { ticker: 'SMCI', name: 'Super Micro Computer', price: 254.1, change: 21.3, changePct: 9.15, volume: 18_420_000 },
    { ticker: 'NVDA', name: 'NVIDIA Corp.', price: 492.44, change: 8.12, changePct: 1.68, volume: 41_950_000 },
    { ticker: 'TSLA', name: 'Tesla Inc.', price: 195.75, change: -9.4, changePct: -4.58, volume: 96_300_000 },
    { ticker: 'PFE', name: 'Pfizer Inc.', price: 28.9, change: -1.12, changePct: -3.73, volume: 37_780_000 },
    { ticker: 'AMD', name: 'Advanced Micro Devices', price: 121.6, change: -2.2, changePct: -1.78, volume: 52_110_000 }
  ]);
}
