import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, map, of, switchMap } from 'rxjs';
import { AccountApiService } from '../../core/services/account-api.service';
import { ActivityAccountsService } from '../../core/services/activity-accounts.service';
import { TransactionService } from '../../core/services/transaction.service';
import { downloadCsv } from '../../core/utils/csv-export';

type SortKey = 'createdAt' | 'amount' | 'type';
type TransactionAction = 'DEPOSIT' | 'WITHDRAWAL';

@Component({
  selector: 'app-transactions',
  standalone: true,
  imports: [CurrencyPipe],
  templateUrl: './transactions.component.html',
  styleUrls: ['./transactions.component.scss']
})
export class TransactionsComponent {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly activityAccounts = inject(ActivityAccountsService);
  protected readonly accounts = this.activityAccounts.accounts;
  protected readonly accountsError = this.activityAccounts.error;
  private readonly accountApi = inject(AccountApiService);
  private readonly transactionService = inject(TransactionService);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  protected readonly accountId = computed(() => {
    const accountId = this.accountIdParam();
    return accountId || this.accounts()[0]?.id || '';
  });
  protected readonly account = computed(() => this.accounts().find(account => account.id === this.accountId()));
  protected readonly transactions = computed(() => this.transactionService.transactionsForAccount(this.accountId()));
  private readonly accountSummary = toSignal(toObservable(this.accountId).pipe(
    switchMap(accountId => accountId
      ? this.accountApi.getAccountSummary(accountId).pipe(
          catchError(() => of(null)),
          map(summary => ({ accountId, summary }))
        )
      : of(null))
  ), { initialValue: null });
  protected readonly cashBalance = computed(() => {
    const summary = this.accountSummary();
    return this.transactionService.balanceForAccount(this.accountId(),
      summary?.accountId === this.accountId() ? summary.summary?.availableBalance ?? 0 : 0);
  });
  protected readonly depositCount = computed(() => this.transactions().filter(transaction => transaction.txnType === 'DEPOSIT').length);
  protected readonly withdrawalCount = computed(() => this.transactions().filter(transaction => transaction.txnType === 'WITHDRAWAL').length);
  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('createdAt');
  protected readonly sortDescending = signal(true);
  protected readonly showDepositForm = signal(false);
  protected readonly showConfirmation = signal(false);
  protected readonly transactionAction = signal<TransactionAction>('DEPOSIT');
  protected readonly depositAmount = signal(0);
  protected readonly canSubmitTransaction = computed(() =>
    !!this.accountId() && this.depositAmount() > 0 && (this.transactionAction() === 'DEPOSIT' || this.depositAmount() <= this.cashBalance())
  );

  protected readonly visibleTransactions = computed(() => {
    const query = this.query().trim().toLowerCase();
    const sortBy = this.sortBy();
    return this.transactions()
      .filter(transaction => [transaction.txnType, String(transaction.amount)]
        .some(value => value.toLowerCase().includes(query)))
      .sort((left, right) => {
        let comparison = sortBy === 'amount'
          ? left.amount - right.amount
          : sortBy === 'type'
            ? left.txnType.localeCompare(right.txnType)
            : left.createdAt.localeCompare(right.createdAt);
        return this.sortDescending() ? -comparison : comparison;
      });
  });

  protected switchAccount(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    if (accountId) this.router.navigate(['/transactions', accountId]);
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onSort(event: Event): void {
    this.sortBy.set((event.target as HTMLSelectElement).value as SortKey);
    this.sortDescending.set(true);
  }

  protected setDepositAmount(event: Event): void {
    const amount = Number((event.target as HTMLInputElement).value);
    this.depositAmount.set(Number.isFinite(amount) ? Math.max(0, amount) : 0);
  }

  protected setTransactionAction(action: TransactionAction): void {
    this.transactionAction.set(action);
    this.depositAmount.set(0);
    this.showConfirmation.set(false);
  }

  protected addCash(): void {
    if (!this.canSubmitTransaction()) return;
    this.showConfirmation.set(true);
  }

  protected confirmCashTransaction(): void {
    if (!this.canSubmitTransaction()) return;
    this.transactionService.addTransaction(this.accountId(), this.transactionAction(), this.depositAmount());
    this.depositAmount.set(0);
    this.showConfirmation.set(false);
    this.showDepositForm.set(false);
  }

  protected cancelCashConfirmation(): void {
    this.showConfirmation.set(false);
  }

  protected exportTransactions(): void {
    const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' });
    downloadCsv(
      `transactions-${this.account()?.name ?? 'account'}.csv`.replace(/[^a-z0-9._-]+/gi, '-'),
      ['Transaction ID', 'Account', 'Type', 'Amount', 'Created'],
      this.visibleTransactions().map(transaction => [
        transaction.transactionId,
        this.account()?.name ?? '',
        transaction.txnType,
        currency.format(transaction.amount),
        this.centralTime(transaction.createdAt)
      ])
    );
  }

  protected centralTime(value: string): string {
    const timestamp = /(?:Z|[+-]\d{2}:?\d{2})$/.test(value) ? value : `${value}Z`;
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'America/Chicago',
      dateStyle: 'medium',
      timeStyle: 'short'
    }).format(new Date(timestamp));
  }
}
