import { Injectable, signal } from '@angular/core';

export type TransactionType = 'DEPOSIT' | 'WITHDRAWAL';

export interface Transaction {
  transactionId: string;
  accountId: string;
  txnType: TransactionType;
  amount: number;
  createdAt: string;
}

/** Account-scoped cash activity. Replace the mock source with the transactions API when available. */
@Injectable({ providedIn: 'root' })
export class TransactionService {
  private readonly transactionsByAccount = signal<Record<string, Transaction[]>>({
    'roth-ira': [
      { transactionId: 'txn-1001', accountId: 'roth-ira', txnType: 'DEPOSIT', amount: 5000, createdAt: '2026-10-15T09:30:00Z' },
      { transactionId: 'txn-1002', accountId: 'roth-ira', txnType: 'WITHDRAWAL', amount: 750, createdAt: '2026-10-04T13:15:00Z' },
      { transactionId: 'txn-1003', accountId: 'roth-ira', txnType: 'DEPOSIT', amount: 2500, createdAt: '2026-09-20T15:45:00Z' }
    ],
    '401k': [
      { transactionId: 'txn-2001', accountId: '401k', txnType: 'DEPOSIT', amount: 3200, createdAt: '2026-10-10T12:00:00Z' }
    ],
    hsa: [],
    '529': []
  });

  private readonly balancesByAccount = signal<Record<string, number>>({
    'roth-ira': 16850.72,
    '401k': 18420.15,
    hsa: 11380.4,
    '529': 9250.88
  });

  transactionsForAccount(accountId: string): Transaction[] {
    return this.transactionsByAccount()[accountId] ?? [];
  }

  balanceForAccount(accountId: string): number {
    return this.balancesByAccount()[accountId] ?? 0;
  }

  addTransaction(accountId: string, txnType: TransactionType, amount: number): void {
    const transaction: Transaction = {
      transactionId: crypto.randomUUID(),
      accountId,
      txnType,
      amount,
      createdAt: new Date().toISOString()
    };

    this.transactionsByAccount.update(transactions => ({
      ...transactions,
      [accountId]: [transaction, ...(transactions[accountId] ?? [])]
    }));
    this.balancesByAccount.update(balances => ({
      ...balances,
      [accountId]: (balances[accountId] ?? 0) + (txnType === 'DEPOSIT' ? amount : -amount)
    }));
  }
}
