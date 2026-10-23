import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';
import { DashboardService } from './dashboard.service';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  transactionId: string;
  accountId: string;
  txnType: TransactionType;
  amount: number;
  createdAt: string;
}

interface TransactionItemDto {
  transactionId: string;
  type: TransactionType;
  amount: number;
  createdAt: string;
}

interface CashMutationResponse {
  message: string;
  newCashBalance: number;
  transactionType: TransactionType;
}

/** Account-scoped cash activity loaded from the accounts API. */
@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly api = inject(ApiService);
  private readonly dashboard = inject(DashboardService);
  private readonly transactionsByAccount = signal<Record<string, Transaction[]>>({});

  private readonly balancesByAccount = signal<Record<string, number>>({});

  private readonly loadedAccounts = new Set<string>();

  transactionsForAccount(accountId: string): Transaction[] {
    this.loadTransactions(accountId);
    return this.transactionsByAccount()[accountId] ?? [];
  }

  balanceForAccount(accountId: string, fallback = 0): number {
    return this.balancesByAccount()[accountId] ?? fallback;
  }

  addTransaction(accountId: string, txnType: TransactionType, amount: number): void {
    const endpoint = `accounts/${encodeURIComponent(accountId)}/${txnType === 'DEPOSIT' ? 'deposit' : 'withdraw'}`;
    this.api.patch<CashMutationResponse>(endpoint, { amount }).subscribe({
      next: response => {
        this.balancesByAccount.update(balances => ({ ...balances, [accountId]: response.newCashBalance }));
        this.dashboard.updateAvailableCash(accountId, response.newCashBalance);
        this.loadTransactions(accountId, true);
      },
      error: error => console.error('Cash transaction request failed', error)
    });
  }

  private loadTransactions(accountId: string, reload = false): void {
    if (!accountId || (!reload && this.loadedAccounts.has(accountId))) return;
    this.loadedAccounts.add(accountId);
    this.api.get<TransactionItemDto[]>(`accounts/${encodeURIComponent(accountId)}/transactions`, {
      params: { limit: 100 }
    }).subscribe({
      next: transactions => this.transactionsByAccount.update(current => ({
        ...current,
        [accountId]: transactions.map(transaction => ({
          transactionId: transaction.transactionId,
          accountId,
          txnType: transaction.type,
          amount: transaction.amount,
          createdAt: transaction.createdAt
        }))
      })),
      error: error => console.error('Transaction history request failed', error)
    });
  }
}
