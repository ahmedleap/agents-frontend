import { Injectable, inject, signal } from '@angular/core';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

export interface AccountSummary {
  id: string;
  name: string;
  value: number;
  cashBalance: number;
  availableBalance: number;
  status: string;
  dayPL: number | null;
  dayPct: number | null;
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
  price?: number;
  account: string;
}

export interface Mover {
  ticker: string;
  name?: string;
  price: number;
  change?: number;
  changePct: number;
  volume?: number;
}

interface DashboardResponse {
  accounts: AccountListItemDto[];
  watchlist: WatchlistDto[];
  recentTrades: RecentTradeDto[];
  portfolioHistory: PortfolioHistoryPointDto[];
  todayProfitLoss: number;
  todayProfitLossPercent: number;
}

interface AccountListItemDto {
  accountId: string;
  name: string;
  status: string;
  cashBalance: number;
  availableBalance: number;
  totalValue: number;
}

interface MarketMoverDto {
  ticker: string;
  price: number;
  changePercent: number;
}

interface MarketMoversResponse {
  marketMovers: MarketMoverDto[];
  asOf: string;
  refreshedAt: string;
  isStale: boolean;
}

interface WatchlistDto {
  ticker: string;
  instrumentName: string;
}

interface RecentTradeDto {
  orderId: string;
  accountName: string;
  ticker: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
  limitPrice?: number;
  filledPrice?: number;
  createdAt: string;
}

interface PortfolioHistoryPointDto {
  date: string;
  totalValue: number;
}

@Injectable({ providedIn: 'root' })
export class DashboardService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  readonly loading = signal(true);
  readonly error = signal<string | null>(null);
  readonly labels = signal<string[]>([]);
  readonly accounts = signal<AccountSummary[]>([]);
  readonly watchlist = signal<WatchItem[]>([]);
  readonly trades = signal<Trade[]>([]);
  readonly movers = signal<Mover[]>([]);
  readonly moversLoading = signal(false);
  readonly moversError = signal<string | null>(null);
  readonly todayProfitLoss = signal(0);
  readonly todayProfitLossPercent = signal(0);
  readonly portfolioHistory = signal<number[]>([]);

  constructor() {
    const clientId = this.auth.clientId();
    if (!clientId) {
      this.loading.set(false);
      this.error.set('Your session is no longer available. Please sign in again.');
      return;
    }

    this.moversLoading.set(true);
    this.api.get<MarketMoversResponse>('instruments/market-movers').subscribe({
      next: response => {
        this.movers.set((response.marketMovers ?? []).map(mover => ({
          ticker: mover.ticker,
          price: mover.price,
          changePct: mover.changePercent
        })));
        this.moversLoading.set(false);
      },
      error: () => {
        this.moversLoading.set(false);
        this.moversError.set('Market movers are temporarily unavailable.');
      }
    });

    this.api.getRoot<DashboardResponse>('dashboard', {
      params: { clientId, period: '30D' }
    }).subscribe({
      next: response => this.applyDashboard(response),
      error: error => {
        console.error('Dashboard request failed', error);
        this.loading.set(false);
        this.error.set('Dashboard data is temporarily unavailable. Please try again later.');
      }
    });
  }

  readonly accountData = this.accounts.asReadonly();
  readonly watchlistData = this.watchlist.asReadonly();
  readonly tradeData = this.trades.asReadonly();
  readonly moverData = this.movers.asReadonly();

  /** After a trade: the account's cash and available-to-trade amounts from its summary */
  updateBalances(accountId: string, cashBalance: number, availableBalance: number): void {
    this.accounts.update(accounts => accounts.map(account => account.id === accountId
      ? { ...account, cashBalance, availableBalance }
      : account));
  }

  updateAvailableCash(accountId: string, availableBalance: number): void {
    this.accounts.update(accounts => accounts.map(account => account.id === accountId
      ? { ...account, availableBalance, cashBalance: availableBalance }
      : account));
  }

  private applyDashboard(response: DashboardResponse): void {
    this.accounts.set((response.accounts ?? []).map(account => ({
      id: account.accountId,
      name: account.name,
      value: account.totalValue,
      cashBalance: account.cashBalance,
      availableBalance: account.availableBalance,
      status: account.status,
      dayPL: null,
      dayPct: null,
      history: []
    })));
    this.watchlist.set((response.watchlist ?? []).map(item => ({
      ticker: item.ticker,
      name: item.instrumentName
    })));
    this.trades.set((response.recentTrades ?? []).map(trade => ({
      id: trade.orderId,
      time: new Date(trade.createdAt),
      side: trade.orderType === 'BUY' ? 'Buy' : 'Sell',
      ticker: trade.ticker,
      shares: trade.quantity,
      price: trade.filledPrice ?? trade.limitPrice,
      account: trade.accountName
    })));
    const history = (response.portfolioHistory ?? []).slice().sort((a, b) => a.date.localeCompare(b.date));
    this.labels.set(history.map(point => point.date));
    this.portfolioHistory.set(history.map(point => point.totalValue));
    this.todayProfitLoss.set(response.todayProfitLoss ?? 0);
    this.todayProfitLossPercent.set(response.todayProfitLossPercent ?? 0);
    this.error.set(null);
    this.loading.set(false);
  }
}
