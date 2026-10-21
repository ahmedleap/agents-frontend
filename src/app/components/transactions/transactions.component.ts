import { CurrencyPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { map } from 'rxjs';
import { DashboardService } from '../../core/services/dashboard.service';
import { TransactionService } from '../../core/services/transaction.service';

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
  private readonly accounts = inject(DashboardService).accounts;
  private readonly transactionService = inject(TransactionService);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  protected readonly accountId = computed(() => {
    const accountId = this.accountIdParam();
    return this.accounts().find(account => account.id === accountId)?.id ?? this.accounts()[0]?.id ?? '';
  });
  protected readonly account = computed(() => this.accounts().find(account => account.id === this.accountId()));
  protected readonly transactions = computed(() => this.transactionService.transactionsForAccount(this.accountId()));
  protected readonly cashBalance = computed(() => this.account()?.availableBalance ?? 0);
  protected readonly query = signal('');
  protected readonly sortBy = signal<SortKey>('createdAt');
  protected readonly sortDescending = signal(true);
  protected readonly showDepositForm = signal(false);
  protected readonly transactionAction = signal<TransactionAction>('DEPOSIT');
  protected readonly depositAmount = signal(0);
  protected readonly canSubmitTransaction = computed(() =>
    this.depositAmount() > 0 && (this.transactionAction() === 'DEPOSIT' || this.depositAmount() <= this.cashBalance())
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
  }

  protected addCash(): void {
    const amount = this.depositAmount();
    if (!this.canSubmitTransaction()) return;
    this.transactionService.addTransaction(this.accountId(), this.transactionAction(), amount);
    this.depositAmount.set(0);
    this.showDepositForm.set(false);
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
