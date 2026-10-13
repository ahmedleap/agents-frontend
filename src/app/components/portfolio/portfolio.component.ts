import { Component, computed, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';

interface Holding {
  ticker: string;
  name: string;
  shares: number;
  avgCost: number;
  price: number;
  color: string;
}

type SortKey = 'value' | 'ticker' | 'return';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent {
  protected readonly account = 'Premium Trading Account';
  protected readonly asOf = new Date();

  // Replace with your real holdings
  private readonly holdings = signal<Holding[]>([
    { ticker: 'AAPL', name: 'Apple Inc.', shares: 150, avgCost: 145, price: 178.25, color: '#2f6f2a' },
    { ticker: 'MSFT', name: 'Microsoft Corp.', shares: 75, avgCost: 310, price: 378.5, color: '#2b6cb0' },
    { ticker: 'TSLA', name: 'Tesla Inc.', shares: 50, avgCost: 240, price: 195.75, color: '#d97706' }
  ]);

  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('value');

  protected readonly rows = computed(() =>
    this.holdings().map(h => {
      const value = h.shares * h.price;
      const cost = h.shares * h.avgCost;
      const gain = value - cost;
      return { ...h, value, cost, gain, ret: (gain / cost) * 100 };
    })
  );

  protected readonly totals = computed(() => {
    const rows = this.rows();
    const value = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const gain = value - cost;
    return { value, cost, gain, ret: (gain / cost) * 100, count: rows.length };
  });

  protected readonly allocation = computed(() =>
    [...this.rows()]
      .sort((a, b) => b.value - a.value)
      .map(r => ({ ...r, weight: (r.value / this.totals().value) * 100 }))
  );

  protected readonly visibleRows = computed(() => {
    const q = this.query().trim().toLowerCase();
    const key = this.sortBy();
    return this.rows()
      .filter(r => r.ticker.toLowerCase().includes(q) || r.name.toLowerCase().includes(q))
      .sort((a, b) =>
        key === 'ticker' ? a.ticker.localeCompare(b.ticker)
        : key === 'return' ? b.ret - a.ret
        : b.value - a.value
      );
  });

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortKey);
  }
}