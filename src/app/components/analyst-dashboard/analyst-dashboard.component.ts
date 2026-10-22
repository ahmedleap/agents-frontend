import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { Component, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, startWith } from 'rxjs';
import { ApiService } from '../../core/services/api.service';

interface PlatformMetrics {
  totalClients: number;
  activeClientsLast30Days: number;
  totalAccounts: number;
  activeAccountsLast30Days: number;
  totalAssetsUnderManagement: number;
  averagePortfolioSize: number;
  totalOrders: number;
  totalFilledOrders: number;
  orderFulfillmentRate: number;
  totalValueTraded: number;
}

interface DailyVolume {
  totalQuantityTraded: number;
  totalValueTraded: number;
  totalOrdersExecuted: number;
  percentChangeYTD: number;
}

interface DailyTrades {
  totalTrades: number;
  filledTrades: number;
  cancelledTrades: number;
  pendingTrades: number;
  fulfillmentRate: number;
  cancellationRate: number;
  buyOrderCount: number;
  sellOrderCount: number;
}

type AnalystDashboardState =
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; platform: PlatformMetrics; volume: DailyVolume; trades: DailyTrades };

@Component({
  selector: 'app-analyst-dashboard',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe],
  templateUrl: './analyst-dashboard.component.html',
  styleUrls: ['./analyst-dashboard.component.scss']
})
export class AnalystDashboardComponent {
  private readonly api = inject(ApiService);

  protected readonly state = toSignal(
    forkJoin({
      platform: this.api.get<PlatformMetrics>('v1/analytics/platform/metrics'),
      volume: this.api.get<DailyVolume>('v1/analytics/dashboard/total-volume'),
      trades: this.api.get<DailyTrades>('v1/analytics/dashboard/total-trades')
    }).pipe(
      map(data => ({ status: 'ready' as const, ...data })),
      catchError((error: HttpErrorResponse) => of<AnalystDashboardState>({
        status: 'error',
        message: error.status === 403
          ? 'Your analyst role is not authorized for these analytics.'
          : 'Analytics are temporarily unavailable. Please try again later.'
      })),
      startWith<AnalystDashboardState>({ status: 'loading' })
    ),
    { initialValue: { status: 'loading' } as AnalystDashboardState }
  );

  protected readonly ready = () => {
    const current = this.state();
    return current.status === 'ready' ? current : null;
  };
  protected readonly errorMessage = () => {
    const current = this.state();
    return current.status === 'error' ? current.message : null;
  };
  protected readonly today = new Date();
}
