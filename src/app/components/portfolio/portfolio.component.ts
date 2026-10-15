import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';

interface Holding {
  ticker: string;
  name: string;
  sector: string;
  shares: number;
  avgCost: number;
  price: number;
}

type SortKey = 'value' | 'ticker' | 'return';

// One colour per sector. Add more sectors here as you need them.
const SECTOR_COLORS: Record<string, string> = {
  Technology: '#2b6cb0',
  Automotive: '#d97706',
  Healthcare: '#2f6f2a',
  Financials: '#6b46c1',
  Energy: '#b7791f',
  'Consumer Goods': '#c05681'
};
const DEFAULT_COLOR = '#5f7267';

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent {
  private readonly accounts = inject(DashboardService).accounts;
  private readonly route = inject(ActivatedRoute);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(p => p.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  // Falls back to the first account for /portfolio or an unknown id
  protected readonly accountId = computed(() => {
    const list = this.accounts();
    return list.find(account => account.id === this.accountIdParam())?.id ?? list[0]?.id ?? '';
  });

  protected readonly account = computed(() => {
    const list = this.accounts();
    return list.find(account => account.id === this.accountId())?.name ?? '';
  });
  protected readonly asOf = new Date();

  // Replace with your real holdings
  private readonly holdings = signal<Holding[]>([
    { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', shares: 150, avgCost: 145, price: 178.25 },
    { ticker: 'MSFT', name: 'Microsoft Corp.', sector: 'Technology', shares: 75, avgCost: 310, price: 378.5 },
    { ticker: 'TSLA', name: 'Tesla Inc.', sector: 'Automotive', shares: 50, avgCost: 240, price: 195.75 }
  ]);

  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('value');

  protected readonly rows = computed(() =>
    this.holdings().map(h => {
      const value = h.shares * h.price;
      const cost = h.shares * h.avgCost;
      const gain = value - cost;
      return {
        ...h,
        value,
        cost,
        gain,
        ret: (gain / cost) * 100,
        color: SECTOR_COLORS[h.sector] ?? DEFAULT_COLOR
      };
    })
  );

  protected readonly totals = computed(() => {
    const rows = this.rows();
    const value = rows.reduce((s, r) => s + r.value, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const gain = value - cost;
    return { value, cost, gain, ret: (gain / cost) * 100, count: rows.length };
  });

  // Groups holdings by sector and works out each sector's share of the portfolio
  protected readonly allocation = computed(() => {
    const total = this.totals().value;
    const groups = new Map<string, { sector: string; value: number; tickers: string[]; color: string }>();

    for (const r of this.rows()) {
      const group = groups.get(r.sector) ?? { sector: r.sector, value: 0, tickers: [], color: r.color };
      group.value += r.value;
      group.tickers.push(r.ticker);
      groups.set(r.sector, group);
    }

    return [...groups.values()]
      .sort((a, b) => b.value - a.value)
      .map(g => ({ ...g, weight: (g.value / total) * 100 }));
  });

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