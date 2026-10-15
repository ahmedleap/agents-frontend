import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';

interface Instrument {
  symbol: string;
  name: string;
  type: string;
  price: number;
  change: number;
  changePct: number;
  points: number[];
  color: string;
}

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss']
})
export class TradesComponent {
  private readonly router = inject(Router);
  private readonly accounts = inject(DashboardService).accounts;
  private readonly route = inject(ActivatedRoute);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  protected readonly account = computed(() => {
    const accounts = this.accounts();
    return accounts.find(account => account.id === this.accountIdParam()) ?? accounts[0];
  });
  private readonly cashBalances = signal<Record<string, number>>({
    'roth-ira': 24850.72,
    '401k': 18420.15,
    hsa: 11380.4,
    '529': 9250.88
  });
  protected readonly cashBalance = computed(() => this.cashBalances()[this.account()?.id ?? ''] ?? 24850.72);
  protected readonly searchQuery = signal('');
  protected readonly selected = signal<Instrument | null>(null);
  protected readonly side = signal<Side>('buy');
  protected readonly orderType = signal<OrderType>('market');
  protected readonly limitPrice = signal(0);
  protected readonly quantity = signal(10);
  protected readonly confirmed = signal(false);

  protected readonly instruments: Instrument[] = [
    { symbol: 'AAPL', name: 'Apple Inc.', type: 'NASDAQ', price: 178.25, change: 2.41, changePct: 1.37, points: [18, 24, 21, 34, 31, 42, 50, 46, 58, 66, 62, 78], color: '#2f6f2a' },
    { symbol: 'MSFT', name: 'Microsoft Corp.', type: 'NASDAQ', price: 378.5, change: 4.82, changePct: 1.29, points: [70, 62, 64, 53, 58, 48, 44, 50, 37, 30, 34, 22], color: '#2b6cb0' },
    { symbol: 'TSLA', name: 'Tesla Inc.', type: 'NASDAQ', price: 195.75, change: -3.16, changePct: -1.59, points: [24, 31, 28, 39, 36, 48, 43, 54, 50, 62, 59, 72], color: '#c0392b' },
    { symbol: 'VTI', name: 'Vanguard Total Market ETF', type: 'NYSE Arca', price: 265.18, change: 1.08, changePct: 0.41, points: [46, 42, 50, 48, 54, 52, 58, 57, 63, 60, 67, 65], color: '#6b46c1' }
  ];

  protected readonly estimatedTotal = computed(() => {
    const instrument = this.selected();
    if (!instrument) return 0;
    return this.executionPrice() * this.quantity();
  });

  protected readonly executionPrice = computed(() => {
    const instrument = this.selected();
    if (!instrument) return 0;
    return this.orderType() === 'limit' ? this.limitPrice() : instrument.price;
  });

  protected readonly visibleInstruments = computed(() => {
    const query = this.searchQuery().trim().toLowerCase();
    if (!query) return this.instruments;
    return this.instruments.filter(instrument =>
      instrument.symbol.toLowerCase().includes(query) || instrument.name.toLowerCase().includes(query)
    );
  });

  protected readonly canSubmit = computed(() => {
    const total = this.estimatedTotal();
    return !!this.selected() && this.quantity() > 0 && this.executionPrice() > 0 && (this.side() === 'sell' || total <= this.cashBalance());
  });

  protected openOrder(instrument: Instrument): void {
    this.selected.set(instrument);
    this.side.set('buy');
    this.orderType.set('market');
    this.limitPrice.set(instrument.price);
    this.quantity.set(10);
    this.confirmed.set(false);
  }

  protected onSearch(event: Event): void {
    this.searchQuery.set((event.target as HTMLInputElement).value);
  }

  protected switchAccount(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    if (accountId) this.router.navigate(['/trades', accountId]);
  }

  protected closeOrder(): void {
    this.selected.set(null);
    this.confirmed.set(false);
  }

  protected setSide(side: Side): void {
    this.side.set(side);
    this.confirmed.set(false);
  }

  protected setOrderType(orderType: OrderType): void {
    this.orderType.set(orderType);
    this.confirmed.set(false);
  }

  protected setLimitPrice(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.limitPrice.set(Number.isFinite(value) ? Math.max(0, value) : 0);
    this.confirmed.set(false);
  }

  protected setQuantity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.quantity.set(Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1);
    this.confirmed.set(false);
  }

  protected submitOrder(): void {
    if (!this.canSubmit()) return;
    if (this.side() === 'buy') {
      const accountId = this.account()?.id ?? '';
      this.cashBalances.update(balances => ({ ...balances, [accountId]: this.cashBalance() - this.estimatedTotal() }));
    }
    this.confirmed.set(true);
  }

  protected chartPoints(points: number[]): string {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    return points.map((point, index) => `${(index / (points.length - 1)) * 100},${42 - ((point - min) / range) * 34}`).join(' ');
  }
}
