import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { Component, inject } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { catchError, map, of, startWith, switchMap } from 'rxjs';
import { AuthService } from '../../core/services/auth.service';
import { PortfolioApiService } from '../../core/services/portfolio-api.service';

interface ClientHomeState {
  status: 'loading' | 'error' | 'ready';
  message?: string;
  portfolio?: {
    totalPortfolioValue: number;
    totalCostBasis: number;
    totalGainLossDollars: number;
    totalGainLossPercent: number;
    accounts: Array<{
      accountId: string;
      accountName: string;
      totalPortfolioValue: number;
      totalGainLossDollars: number;
      totalGainLossPercent: number;
    }>;
  };
}

@Component({
  selector: 'app-client-home',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, RouterLink],
  templateUrl: './client-home.component.html',
  styleUrls: ['./client-home.component.scss']
})
export class ClientHomeComponent {
  private readonly auth = inject(AuthService);
  private readonly portfolioApi = inject(PortfolioApiService);

  protected readonly user = this.auth.currentUser;
  protected readonly today = new Date();
  protected readonly state = toSignal(
    toObservable(this.auth.clientId).pipe(
      switchMap(clientId => {
        if (!clientId) return of<ClientHomeState>({ status: 'error', message: 'Please sign in again to view your accounts.' });
        return this.portfolioApi.getEntirePortfolio(clientId).pipe(
          map(portfolio => ({ status: 'ready' as const, portfolio })),
          catchError(() => of<ClientHomeState>({ status: 'error', message: 'Could not load your accounts. Please try again.' })),
          startWith<ClientHomeState>({ status: 'loading' })
        );
      })
    ),
    { initialValue: { status: 'loading' } as ClientHomeState }
  );
}
