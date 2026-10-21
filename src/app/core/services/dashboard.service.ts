<<<<<<< Updated upstream
import { Injectable, signal } from '@angular/core';
=======
import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';
>>>>>>> Stashed changes

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
  price?: number;
  change?: number;
  changePct?: number;
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
  volume?: number;
}

<<<<<<< Updated upstream
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
=======
interface AccountListItemDto {
  accountId: string;
  name: string;
  status: string;
  cashBalance: number;
  availableBalance: number;
  totalValue: number;
}

interface DashboardResponse {
  accounts: AccountListItemDto[];
  marketMovers: Array<{
    ticker: string;
    instrumentName: string;
    currentPrice: number;
    priceChange: number;
    priceChangePercent: number;
  }>;
  watchlist: Array<{
    ticker: string;
    instrumentName: string;
  }>;
  recentTrades: Array<{
    orderId: string;
    accountName: string;
    ticker: string;
    orderType: 'BUY' | 'SELL';
    quantity: number;
    limitPrice: number;
    filledPrice: number;
    createdAt: string;
  }>;
  portfolioHistory: Array<{ date: string; totalValue: number }>;
  todayProfitLoss: number;
  todayProfitLossPercent: number;
>>>>>>> Stashed changes
}

/**
 * Loads the dashboard aggregate so the page does not need separate requests for each panel.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
<<<<<<< Updated upstream
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
=======
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  readonly labels = signal<string[]>([]);
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly todayProfitLoss = signal(0);
  readonly todayProfitLossPercent = signal(0);

  readonly accounts = signal<AccountSummary[]>([]);
  readonly portfolioHistory = signal<number[]>([]);

  constructor() {
    const clientId = this.auth.getClientId();
    if (!clientId || !this.auth.getToken()) {
      this.loading.set(false);
      this.redirectToLogin();
      return;
    }

    this.api.get<DashboardResponse>(environment.dashboardUrl, { params: { clientId, period: '30D' } }).subscribe({
      next: dashboard => this.applyDashboard(dashboard),
      error: error => this.handleError(error)
    });
  }

  private applyDashboard(dashboard: DashboardResponse): void {
    this.accounts.set((dashboard.accounts ?? []).map(account => ({
      id: account.accountId,
      name: account.name,
      value: account.totalValue,
      cashBalance: account.cashBalance,
      availableBalance: account.availableBalance,
      status: account.status,
      dayPL: 0,
      dayPct: 0,
      history: [account.totalValue]
    })));
    this.todayProfitLoss.set(dashboard.todayProfitLoss ?? 0);
    this.todayProfitLossPercent.set(dashboard.todayProfitLossPercent ?? 0);
    this.portfolioHistory.set((dashboard.portfolioHistory ?? []).map(point => point.totalValue));
    this.labels.set((dashboard.portfolioHistory ?? []).map(point => new Date(`${point.date}T00:00:00`).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric'
    })));
    this.watchlist.set((dashboard.watchlist ?? []).map(item => ({
      ticker: item.ticker,
      name: item.instrumentName
    })));
    this.trades.set((dashboard.recentTrades ?? []).map(trade => ({
      id: trade.orderId,
      time: new Date(trade.createdAt),
      side: trade.orderType === 'BUY' ? 'Buy' : 'Sell',
      ticker: trade.ticker,
      shares: trade.quantity,
      price: trade.filledPrice || trade.limitPrice,
      account: trade.accountName
    })));
    this.movers.set((dashboard.marketMovers ?? []).map(mover => ({
      ticker: mover.ticker,
      name: mover.instrumentName,
      price: mover.currentPrice,
      change: mover.priceChange,
      changePct: mover.priceChangePercent,
    })));
    this.loading.set(false);
  }

  private handleError(error: HttpErrorResponse): void {
    this.loading.set(false);
    if (error.status === 401 || error.status === 403) {
      this.redirectToLogin();
      return;
    }

    this.error.set(error.status === 400
      ? 'The selected dashboard period is invalid.'
      : 'The dashboard could not be loaded.');
  }

  private redirectToLogin(): void {
    this.auth.logout();
    void this.router.navigate(['/login']);
  }

  updateAvailableCash(accountId: string, availableBalance: number): void {
    this.accounts.update(accounts => accounts.map(account => account.id === accountId
      ? { ...account, availableBalance, cashBalance: availableBalance }
      : account));
  }
>>>>>>> Stashed changes

  readonly watchlist = signal<WatchItem[]>([]);

<<<<<<< Updated upstream
  readonly trades = signal<Trade[]>([
    { id: 't1', time: daysAgo(1), side: 'Buy', ticker: 'AAPL', shares: 25, price: 177.9, account: 'Premium Trading Account' },
    { id: 't2', time: daysAgo(3), side: 'Sell', ticker: 'TSLA', shares: 10, price: 196.4, account: 'Swing Trading' },
    { id: 't3', time: daysAgo(6), side: 'Buy', ticker: 'MSFT', shares: 12, price: 376.2, account: 'Retirement Growth' },
    { id: 't4', time: daysAgo(27), side: 'Buy', ticker: 'KO', shares: 80, price: 59.15, account: 'Dividend Income' },
    { id: 't5', time: daysAgo(30), side: 'Sell', ticker: 'AMD', shares: 40, price: 123.8, account: 'Swing Trading' }
  ]);
=======
  readonly trades = signal<Trade[]>([]);
>>>>>>> Stashed changes

  readonly movers = signal<Mover[]>([]);
}
