import { Injectable, inject, signal } from '@angular/core';
import { TradingApiService } from './trading-api.service';

export type OrderStatus = 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
export type OrderType = 'BUY' | 'SELL';

export interface Order {
  orderId: string;
  instrument: string;
  createdAt: string;
  orderType: OrderType;
  quantity: number;
  limitPrice: number | null;
  filledPrice: number | null;
  status: OrderStatus;
}

/** Account-scoped order history loaded from the orders API. */
@Injectable({ providedIn: 'root' })
export class OrderHistoryService {
  private readonly api = inject(TradingApiService);
  private readonly ordersByAccount = signal<Record<string, Order[]>>({});

  ordersForAccount(accountId: string): Order[] {
    if (accountId && !this.loadedAccounts.has(accountId)) {
      this.load(accountId);
    }
    return this.ordersByAccount()[accountId] ?? [];
  }

  refresh(accountId: string): void {
    if (!accountId) return;
    this.load(accountId);
  }

  private load(accountId: string): void {
      this.loadedAccounts.add(accountId);
      this.api.getOrderHistory(accountId).subscribe({
        next: orders => this.ordersByAccount.update(current => ({
          ...current,
          [accountId]: orders.map(order => ({
            orderId: order.orderId,
            instrument: this.tickerFor(order),
            createdAt: order.submittedAt,
            orderType: order.orderType,
            quantity: order.quantity,
            limitPrice: order.limitPrice ?? null,
            filledPrice: order.filledPrice ?? null,
            status: order.status as OrderStatus
          }))
        })),
        error: error => console.error('Order history request failed', error)
      });
  }

  private tickerFor(order: {
    ticker?: string;
    instrumentTicker?: string;
    instrument?: string | { ticker?: string; symbol?: string };
  }): string {
    if (order.ticker) return order.ticker;
    if (order.instrumentTicker) return order.instrumentTicker;
    if (typeof order.instrument === 'string') return order.instrument;
    return order.instrument?.ticker ?? order.instrument?.symbol ?? 'Instrument unavailable';
  }

  private readonly loadedAccounts = new Set<string>();
}
