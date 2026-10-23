import { Injectable, computed, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { catchError, combineLatest, map, of, startWith, switchMap } from 'rxjs';
import { AccountApiService } from './account-api.service';
import { AuthService } from './auth.service';
import { PortfolioApiService } from './portfolio-api.service';

/** Activity pages use the same account source as the sidebar, not the dashboard aggregate. */
@Injectable({ providedIn: 'root' })
export class ActivityAccountsService {
  private readonly auth = inject(AuthService);
  private readonly accountApi = inject(AccountApiService);
  private readonly portfolioApi = inject(PortfolioApiService);
  private readonly state = toSignal(
    combineLatest([
      toObservable(this.auth.clientId),
      this.accountApi.changed$.pipe(startWith(undefined))
    ]).pipe(
      switchMap(([clientId]) => clientId
        ? this.portfolioApi.getEntirePortfolio(clientId).pipe(
            map(portfolio => ({
              accounts: (portfolio.accounts ?? []).map(account => ({
                id: account.accountId,
                name: account.accountName
              })),
              error: null as string | null
            })),
            catchError(() => of({ accounts: [], error: 'Account names could not be loaded. Please reload to try again.' }))
          )
        : of({ accounts: [], error: null }))
    ),
    { initialValue: { accounts: [], error: null } }
  );

  readonly accounts = computed(() => this.state().accounts);
  readonly error = computed(() => this.state().error);
}