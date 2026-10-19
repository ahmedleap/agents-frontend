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

/** AccountController: /api/accounts */
@Injectable({ providedIn: 'root' })
export class AccountApiService {
  private readonly api = inject(ApiService);
  private readonly changedSubject = new Subject<void>();

  /** Emits after an account is added, so lists (like the sidebar) can reload. */
  readonly changed$ = this.changedSubject.asObservable();

  createAccount(request: CreateAccountRequest): Observable<AccountDto> {
    return this.api.post<AccountDto>('accounts', request).pipe(tap(() => this.changedSubject.next()));
  }
}
