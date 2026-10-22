import { Injectable, inject } from '@angular/core';
import { Observable, Subject, tap } from 'rxjs';
import { ApiService } from './api.service';

// Mirrors com.agentsbackend.DTO.requests.AccountsRequest.CreateAccount
export interface CreateAccountRequest {
  clientId: string;
  name: string;
  /** Must be greater than 0 */
  initialCashBalance: number;
}

// Mirrors com.agentsbackend.DTO.response.AccountsResponse.Account
export interface AccountDto {
  accountId: string;
  clientId: string;
  name: string;
  cashBalance: number;
  status: string;
  openDate: string;
}

// Mirrors com.agentsbackend.DTO.response.AccountsResponse.Summary
export interface AccountSummaryDto {
  cashBalance: number;
  /** Cash minus money reserved for open buy orders */
  availableBalance: number;
  holdingsValue: number;
  /** Cash + holdings */
  totalValue: number;
  summaryDate: string;
}

/** AccountController: /api/accounts */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly api = inject(ApiService);
  private readonly changedSubject = new Subject<void>();

  /** Emits after an account is added or renamed, so lists (like the sidebar) can reload. */
  readonly changed$ = this.changedSubject.asObservable();

  getAccountSummary(accountId: string): Observable<AccountSummaryDto> {
    return this.api.get<AccountSummaryDto>(`accounts/${accountId}/summary`);
  }

  createAccount(request: CreateAccountRequest): Observable<AccountDto> {
    return this.api.post<AccountDto>('accounts', request).pipe(tap(() => this.changedSubject.next()));
  }

  /** PUT /api/accounts/{accountId}; the backend only allows the logged-in client's own accounts */
  renameAccount(accountId: string, name: string): Observable<AccountDto> {
    return this.api.put<AccountDto>(`accounts/${accountId}`, { name }).pipe(tap(() => this.changedSubject.next()));
  }
}
