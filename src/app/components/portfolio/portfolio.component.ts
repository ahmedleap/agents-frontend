import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { catchError, forkJoin, map, of, startWith, switchMap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthService } from '../../core/services/auth.service';
import { AccountApiService, AccountSummaryDto } from '../../core/services/account-api.service';
import { NamedAccount, findAccountWithName } from '../../core/account-names';
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

  /** Name saved with the Rename button, shown until the page reloads the account */
  private readonly renamed = signal<{ accountId: string; name: string } | null>(null);

  protected readonly account = computed(() => {
    const r = this.renamed();
    return r && r.accountId === this.accountId() ? r.name : this.view()?.title ?? 'Portfolio';
  });

  // Rename: the title turns into a text box with Save / Cancel
  protected readonly canRename = computed(() => this.view() !== null);
  protected readonly renaming = signal(false);
  protected readonly renameDraft = signal('');
  protected readonly renameSaving = signal(false);
  protected readonly renameError = signal<string | null>(null);
  /** The client's other accounts, loaded when renaming starts; names must stay unique */
  private readonly otherAccounts = signal<NamedAccount[]>([]);
  /** Another account already using the typed name (this account's own name doesn't count) */
  protected readonly renameDuplicate = computed(() =>
    findAccountWithName(this.renameDraft(), this.otherAccounts(), this.accountId()));

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

  protected startRename(): void {
    this.renameDraft.set(this.account());
    this.renameError.set(null);
    this.renaming.set(true);
    // If this fails the backend still renames; we just can't warn about a duplicate name
    this.otherAccounts.set([]);
    this.accountApi.listAccounts().subscribe({
      next: accounts => this.otherAccounts.set(accounts.map(a => ({ accountId: a.accountId, name: a.name }))),
      error: () => this.otherAccounts.set([])
    });
    setTimeout(() => {
      const input = document.getElementById('rename-input') as HTMLInputElement | null;
      input?.focus();
      input?.select();
    });
  }

  protected cancelRename(): void {
    if (this.renameSaving()) return;
    this.renaming.set(false);
    this.renameError.set(null);
  }

  protected saveRename(): void {
    const accountId = this.accountId();
    const name = this.renameDraft().trim();
    if (!accountId || this.renameSaving()) return;
    if (!name) {
      this.renameError.set("The account name can't be blank.");
      return;
    }
    if (name.length > MAX_ACCOUNT_NAME) {
      this.renameError.set(`Keep the name under ${MAX_ACCOUNT_NAME} characters.`);
      return;
    }
    if (this.renameDuplicate()) return; // the message is already showing
    if (name === this.account()) {
      this.cancelRename();
      return;
    }

    this.renameSaving.set(true);
    this.renameError.set(null);
    this.accountApi.renameAccount(accountId, name).subscribe({
      next: account => {
        this.renamed.set({ accountId, name: account.name ?? name });
        this.renameSaving.set(false);
        this.renaming.set(false);
      },
      error: (err: HttpErrorResponse) => {
        this.renameSaving.set(false);
        this.renameError.set(renameErrorMessage(err));
      }
    });
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

// Same limit as the add-account form
const MAX_ACCOUNT_NAME = 100;

function renameErrorMessage(err: HttpErrorResponse): string {
  if (err.status === 0) return "Couldn't reach the server. Check that the backend is running.";
  if (err.status === 401) return 'Your session has expired. Log in again.';
  if (err.status === 403 || err.status === 404) return "This account couldn't be renamed.";
  const detail = typeof err.error === 'object' ? err.error?.message : null;
  return detail ? `Couldn't rename: ${detail}` : "Couldn't rename the account. Try again.";
}
