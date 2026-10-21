import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { AccountApiService, AccountSummaryDto } from '../../core/services/account-api.service';
import {
  AllocationDto,
  HoldingDto,
  PortfolioApiService
} from '../../core/services/portfolio-api.service';

type SortKey = 'value' | 'ticker' | 'return';

interface PortfolioView {
  title: string;
  holdings: HoldingDto[];
  totals: { value: number; cost: number; gain: number; ret: number };
  allocation: AllocationDto;
  /** null if the cash summary couldn't be loaded; the rest of the page still shows */
  cash: AccountSummaryDto | null;
}

type LoadState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; view: PortfolioView };

// One colour per industry. Add more here as you need them.
const SECTOR_COLORS: Record<string, string> = {
  Technology: '#2b6cb0',
  Automotive: '#d97706',
  Healthcare: '#2f6f2a',
  Financials: '#6b46c1',
  Energy: '#b7791f',
  'Consumer Goods': '#c05681'
};
// Used for industries not listed above, and for holding badges (the API has no sector per holding)
const PALETTE = ['#2b6cb0', '#d97706', '#2f6f2a', '#6b46c1', '#b7791f', '#c05681', '#0e7c86', '#5f7267'];

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

@Component({
  selector: 'app-portfolio',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './portfolio.component.html',
  styleUrls: ['./portfolio.component.scss']
})
export class PortfolioComponent {
  private readonly api = inject(PortfolioApiService);
  private readonly auth = inject(AuthService);
  private readonly accountApi = inject(AccountApiService);

  protected readonly asOf = new Date();
  private readonly route = inject(ActivatedRoute);
  protected readonly accountId = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  // Loads the account whose UUID is in the URL (/portfolio/:accountId)
  protected readonly state = toSignal(
    this.route.paramMap.pipe(
      map(p => p.get('accountId')),
      switchMap(accountId => this.load(accountId)),
    ),
    { initialValue: { status: 'loading' } as LoadState }
  );

  private readonly view = computed(() => {
    const s = this.state();
    return s.status === 'ready' ? s.view : null;
  });

  protected readonly account = computed(() => this.view()?.title ?? 'Portfolio');

  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('value');

  protected readonly rows = computed(() =>
    (this.view()?.holdings ?? []).map((h, i) => ({
      ticker: h.ticker,
      name: h.name,
      shares: h.quantity,
      avgCost: h.averageCostBasis,
      price: h.currentPrice,
      value: h.currentValue,
      gain: h.gainLossDollars,
      ret: h.gainLossPercent,
      color: PALETTE[i % PALETTE.length]
    }))
  );

  protected readonly totals = computed(() => {
    const t = this.view()?.totals ?? { value: 0, cost: 0, gain: 0, ret: 0 };
    return { ...t, count: this.rows().length };
  });

  protected readonly cash = computed(() => this.view()?.cash ?? null);
  /** Hide the "available" line until the summary loads */
  protected readonly cashLoaded = computed(() => this.view() !== null);

  protected readonly allocation = computed(() =>
    (this.view()?.allocation.industryBreakdown ?? [])
      .slice()
      .sort((a, b) => b.value - a.value)
      .map((a, i) => ({
        sector: a.industry,
        value: a.value,
        weight: a.percentage,
        color: SECTOR_COLORS[a.industry] ?? PALETTE[i % PALETTE.length]
      }))
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

  private load(accountId: string | null) {
    if (!accountId || !UUID.test(accountId)) {
      return of<LoadState>({ status: 'error', message: `"${accountId ?? ''}" isn't a valid account. Pick an account from the sidebar.` });
    }

    const id = this.auth.clientId();
    if (!id) {
      return of<LoadState>({ status: 'error', message: 'Your session is no longer available. Please sign in again.' });
    }
    const request = forkJoin({
      p: this.api.getAccountPortfolio(id, accountId),
      allocation: this.api.getAccountAllocation(id, accountId),
      cash: this.accountApi.getAccountSummary(accountId).pipe(
        catchError(err => {
          console.error('Account summary request failed', err);
          return of(null);
        })
      )
    }).pipe(map(({ p, allocation, cash }): PortfolioView => ({
      title: p.accountName,
      holdings: p.holdings ?? [],
      totals: { value: p.totalPortfolioValue, cost: p.totalCostBasis, gain: p.totalGainLossDollars, ret: p.totalGainLossPercent },
      allocation,
      cash
    })));

    return request.pipe(
      map((view): LoadState => ({ status: 'ready', view })),
      catchError((err: HttpErrorResponse) => {
        console.error('Portfolio request failed', err);
        return of<LoadState>({ status: 'error', message: describeError(err) });
      }),
      startWith<LoadState>({ status: 'loading' })
    );
  }
}

function describeError(err: HttpErrorResponse): string {
  // Status 0 means the browser never got a usable response: backend down, or blocked by CORS
  if (err.status === 0) {
    return `Couldn't reach the backend at ${environment.apiUrl}. If it is running, check the browser console for a CORS error.`;
  }
  return `The backend returned ${err.status} for ${err.url ?? 'the request'}.`;
}
