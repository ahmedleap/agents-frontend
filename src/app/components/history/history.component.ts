import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
import { OrderDetailDto, TradingApiService } from '../../core/services/trading-api.service';
import { downloadCsv } from '../../core/utils/csv-export';

type SortKey = 'side' | 'kind' | 'quantity' | 'limitPrice' | 'status' | 'createdAt';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accounts = inject(DashboardService).accounts;
  private readonly orderHistory = inject(OrderHistoryService);
  private readonly tradingApi = inject(TradingApiService);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  protected readonly accountId = computed(() => {
    const accountId = this.accountIdParam();
    return this.accounts().find(account => account.id === accountId)?.id ?? this.accounts()[0]?.id ?? '';
  });

  protected readonly account = computed(() =>
    this.accounts().find(account => account.id === this.accountId())
  );

  protected readonly orders = computed(() => this.orderHistory.ordersForAccount(this.accountId()));
  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('createdAt');
  protected readonly sortDescending = signal(true);
  protected readonly quantityDescending = signal(true);
  protected readonly limitPriceDescending = signal(true);
  protected readonly pendingCancellation = signal<string | null>(null);
  protected readonly expandedOrderId = signal<string | null>(null);
  protected readonly orderDetails = signal<Record<string, OrderDetailDto | null>>({});
  protected readonly orderDetailsLoading = signal<string | null>(null);
  protected readonly visibleOrders = computed(() => {
    const query = this.query().trim().toLowerCase();
    const sortKey = this.sortBy();
    const filtered = this.orders().filter(order => {
      const kind = order.limitPrice === null ? 'market' : 'limit';
      return [order.instrument, order.orderType, kind, order.status, String(order.quantity), String(order.limitPrice ?? '')]
        .some(value => value.toLowerCase().includes(query));
    });

    return filtered.sort((left, right) => {
      let comparison = 0;
      if (sortKey === 'quantity') {
        comparison = left.quantity - right.quantity;
        if (comparison === 0) {
          comparison = (left.limitPrice ?? -1) - (right.limitPrice ?? -1);
          return this.limitPriceDescending() ? -comparison : comparison;
        }
        return this.quantityDescending() ? -comparison : comparison;
      }
      if (sortKey === 'limitPrice') {
        comparison = (left.limitPrice ?? -1) - (right.limitPrice ?? -1);
        if (comparison === 0) {
          comparison = left.quantity - right.quantity;
          return this.quantityDescending() ? -comparison : comparison;
        }
        return this.limitPriceDescending() ? -comparison : comparison;
      }
      if (sortKey === 'side') comparison = left.orderType.localeCompare(right.orderType);
      if (sortKey === 'kind') {
        comparison = (left.limitPrice === null ? 'Market' : 'Limit').localeCompare(right.limitPrice === null ? 'Market' : 'Limit');
      }
      if (sortKey === 'status') comparison = left.status.localeCompare(right.status);
      if (sortKey === 'createdAt') comparison = left.createdAt.localeCompare(right.createdAt);
      return this.sortDescending() ? -comparison : comparison;
    });
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortKey);
    this.sortDescending.set(true);
  }

  protected sortByColumn(column: 'quantity' | 'limitPrice'): void {
    if (column === 'quantity') this.quantityDescending.update(descending => !descending);
    if (column === 'limitPrice') this.limitPriceDescending.update(descending => !descending);
    this.sortBy.set(column);
  }

  protected switchAccount(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    if (accountId) this.router.navigate(['/history', accountId]);
  }

  protected centralTime(value: string): string {
    const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }

  protected cancelOrder(orderId: string): void {
    this.pendingCancellation.set(orderId);
  }

  protected confirmCancellation(): void {
    const orderId = this.pendingCancellation();
    const accountId = this.accountId();
    if (!orderId || !accountId) return;
    this.pendingCancellation.set(null);
    this.orderHistory.cancel(orderId, accountId);
  }

  protected dismissCancellation(): void {
    this.pendingCancellation.set(null);
  }

  protected exportOrders(): void {
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    downloadCsv(
      `orders-${this.account()?.name ?? 'account'}.csv`.replace(/[^a-z0-9._-]+/gi, '-'),
      ['Order ID', 'Account', 'Instrument', 'Created', 'Type', 'Order Type', 'Quantity', 'Limit Price', 'Filled Price', 'Status'],
      this.visibleOrders().map(order => [
        order.orderId,
        this.account()?.name ?? '',
        order.instrument,
        this.centralTime(order.createdAt),
        order.orderType,
        order.limitPrice === null ? 'Market' : 'Limit',
        order.quantity,
        order.limitPrice == null ? '' : currency.format(order.limitPrice),
        order.filledPrice == null ? '' : currency.format(order.filledPrice),
        order.status
      ])
    );
  }

  protected toggleDetails(orderId: string): void {
    if (this.expandedOrderId() === orderId) {
      this.expandedOrderId.set(null);
      return;
    }

    this.expandedOrderId.set(orderId);
    if (this.orderDetails()[orderId]) return;
    this.orderDetailsLoading.set(orderId);
    this.tradingApi.getOrder(orderId).subscribe({
      next: detail => {
        this.orderDetails.update(details => ({ ...details, [orderId]: detail }));
        if (this.orderDetailsLoading() === orderId) this.orderDetailsLoading.set(null);
      },
      error: () => {
        this.orderDetails.update(details => ({ ...details, [orderId]: null }));
        if (this.orderDetailsLoading() === orderId) this.orderDetailsLoading.set(null);
      }
    });
  }
}
