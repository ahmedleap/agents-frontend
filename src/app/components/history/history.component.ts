import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrderHistoryService } from '../../core/services/order-history.service';

type SortKey = 'side' | 'kind' | 'quantity' | 'limitPrice' | 'status' | 'createdAt';

@Component({
  selector: 'app-history',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly accounts = inject(DashboardService).accounts;
  private readonly orderHistory = inject(OrderHistoryService);
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
}
