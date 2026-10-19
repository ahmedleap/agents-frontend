import { Injectable, inject, signal } from '@angular/core';
import { catchError, forkJoin, map, of } from 'rxjs';
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
      this.loadedAccounts.add(accountId);
      this.api.getOrderHistory(accountId).subscribe({
        next: orders => forkJoin(orders.map(order => this.api.getOrder(order.orderId).pipe(
          map(detail => ({
            orderId: detail.orderId,
            instrument: detail.instrument?.ticker ?? 'Instrument unavailable',
            createdAt: detail.createdAt,
            orderType: detail.orderType,
            quantity: detail.quantity,
            limitPrice: detail.limitPrice ?? null,
            filledPrice: detail.filledPrice ?? null,
            status: detail.status as OrderStatus
          })),
          catchError(() => of({
            orderId: order.orderId,
            instrument: 'Instrument unavailable',
            createdAt: '',
            orderType: order.orderType,
            quantity: order.quantity,
            limitPrice: order.limitPrice ?? null,
            filledPrice: order.filledPrice ?? null,
            status: order.status as OrderStatus
          }))
        ))).subscribe(enriched => this.ordersByAccount.update(current => ({ ...current, [accountId]: enriched }))),
        error: error => console.error('Order history request failed', error)
      });
    }
    return this.ordersByAccount()[accountId] ?? [];
  }

  private readonly loadedAccounts = new Set<string>();
}
