import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, startWith } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

interface AdminClient {
  clientId: string;
  clientName: string;
  email: string;
  joinDate: string;
  portfolioSizeRange: string | null;
  riskTolerance: string | null;
}

interface AdminAccount {
  accountId: string;
  clientId: string;
  clientName: string;
  name: string;
  cashBalance: number;
  status: string;
  openDate: string;
}

interface AdminInsights {
  clientCount: number;
  accountCount: number;
  orderCount: number;
  filledOrderCount: number;
  tradedValue: number;
}

type AdminState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; clients: AdminClient[]; accounts: AdminAccount[]; insights: AdminInsights };

@Component({
  selector: 'app-admin-overview',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './admin-overview.component.html',
  styleUrls: ['./admin-overview.component.scss']
})
export class AdminOverviewComponent {
  private readonly api = inject(ApiService);

  protected readonly state = toSignal(
    forkJoin({
      clients: this.api.get<AdminClient[]>('v1/admin/clients'),
      accounts: this.api.get<AdminAccount[]>('v1/admin/accounts'),
      insights: this.api.get<AdminInsights>('v1/admin/insights')
    }).pipe(
      map(({ clients, accounts, insights }): AdminState => ({ status: 'ready', clients, accounts, insights })),
      catchError((error: HttpErrorResponse) => of<AdminState>({
        status: 'error',
        message: error.status === 403
          ? 'Your account is not authorized to view administration data.'
          : 'Administration data could not be loaded. Check the backend and try again.'
      })),
      startWith<AdminState>({ status: 'loading' })
    ),
    { initialValue: { status: 'loading' } as AdminState }
  );

  protected readonly readyData = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current : null;
  });
  protected readonly errorMessage = computed(() => {
    const current = this.state();
    return current.status === 'error' ? current.message : null;
  });
}
