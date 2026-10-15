import { Injectable, signal } from '@angular/core';

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

/** Account-scoped order history. Replace the mock source with the orders endpoint when its URL is available. */
@Injectable({ providedIn: 'root' })
export class OrderHistoryService {
  private readonly ordersByAccount = signal<Record<string, Order[]>>({
    'roth-ira': [
      { orderId: '550e8400-e29b-41d4-a716-446655440400', instrument: 'AAPL', createdAt: '2026-10-15T14:30:00Z', orderType: 'BUY', quantity: 100, limitPrice: 140, filledPrice: null, status: 'PENDING' },
      { orderId: '550e8400-e29b-41d4-a716-446655440401', instrument: 'MSFT', createdAt: '2026-10-14T16:10:00Z', orderType: 'BUY', quantity: 25, limitPrice: 177.5, filledPrice: 177.5, status: 'FILLED' },
      { orderId: '550e8400-e29b-41d4-a716-446655440403', instrument: 'TSLA', createdAt: '2026-10-13T11:45:00Z', orderType: 'SELL', quantity: 12, limitPrice: null, filledPrice: 196.4, status: 'FILLED' },
      { orderId: '550e8400-e29b-41d4-a716-446655440404', instrument: 'VTI', createdAt: '2026-10-12T09:20:00Z', orderType: 'SELL', quantity: 30, limitPrice: 185, filledPrice: null, status: 'PENDING' }
    ],
    '401k': [
      { orderId: '550e8400-e29b-41d4-a716-446655440402', instrument: 'MSFT', createdAt: '2026-10-15T10:15:00Z', orderType: 'SELL', quantity: 40, limitPrice: 380, filledPrice: 381.25, status: 'FILLED' },
      { orderId: '550e8400-e29b-41d4-a716-446655440405', instrument: 'AAPL', createdAt: '2026-10-11T13:00:00Z', orderType: 'BUY', quantity: 8, limitPrice: null, filledPrice: null, status: 'PENDING' }
    ],
    hsa: [],
    '529': []
  });

  ordersForAccount(accountId: string): Order[] {
    return this.ordersByAccount()[accountId] ?? [];
  }
}
