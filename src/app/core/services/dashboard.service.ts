import { Injectable, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router } from '@angular/router';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';
import { environment } from '../../../environments/environment';

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
}

/**
 * Loads the dashboard aggregate so the page does not need separate requests for each panel.
 */
@Injectable({ providedIn: 'root' })
export class DashboardService {
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

    this.api.get<DashboardResponse>(`${environment.backendBaseUrl}/dashboard`, { params: { clientId, period: '30D' } }).subscribe({
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

  readonly watchlist = signal<WatchItem[]>([]);
  readonly trades = signal<Trade[]>([]);

  readonly movers = signal<Mover[]>([]);
}
