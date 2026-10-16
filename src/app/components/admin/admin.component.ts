import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { AdminAccount, AdminClient, AdminOrder, AdminService } from '../../core/services/admin.service';

type View = 'clients' | 'accounts' | 'orders';

@Component({
  selector: 'app-admin',
  standalone: true,
  imports: [CurrencyPipe, DatePipe, DecimalPipe, FormsModule],
  templateUrl: './admin.component.html',
  styleUrls: ['./admin.component.scss']
})
export class AdminComponent {
  private readonly admin = inject(AdminService);
  protected readonly view = signal<View>('clients');
  protected readonly search = signal('');
  protected readonly risk = signal('ALL');
  protected readonly portfolio = signal('ALL');
  protected readonly accountStatus = signal('ALL');
  protected readonly orderFilter = signal('ALL');
  protected readonly selectedClient = signal<AdminClient | null>(null);
  protected readonly selectedAccount = signal<AdminAccount | null>(null);
  protected readonly selectedOrder = signal<AdminOrder | null>(null);
  protected readonly refreshKey = signal(0);

  protected readonly data = rxResource({
    params: () => this.refreshKey(),
    stream: () => forkJoin({
      insights: this.admin.insights(),
      platform: this.admin.platformMetrics(),
      report: this.admin.tradingActivity(),
      clients: this.admin.clients(),
      accounts: this.admin.accounts(),
      orders: this.admin.orders(),
      instruments: this.admin.topInstruments(20),
      health: this.admin.health()
    }).pipe(catchError(() => of(null)))
  });

  protected readonly clients = computed(() => {
    const rows = this.data.value()?.clients ?? [];
    const query = this.search().trim().toLowerCase();
    return rows.filter(client => {
      const name = this.clientName(client).toLowerCase();
      return (!query || name.includes(query) || client.email.toLowerCase().includes(query) || client.id.toLowerCase().includes(query))
        && (this.risk() === 'ALL' || client.riskTolerance === this.risk())
        && (this.portfolio() === 'ALL' || client.portfolioSize === this.portfolio());
    });
  });

  protected readonly accounts = computed(() => {
    const rows = this.data.value()?.accounts ?? [];
    const query = this.search().trim().toLowerCase();
    return rows.filter(account => (!query || [account.id, account.clientId, account.clientName].some(value => value.toLowerCase().includes(query)))
      && (this.accountStatus() === 'ALL' || account.status === this.accountStatus()));
  });

  protected readonly orders = computed(() => {
    const rows = this.data.value()?.orders ?? [];
    const query = this.search().trim().toLowerCase();
    return rows.filter(order => (!query || [order.id, order.accountId, order.clientName, order.ticker].some(value => value.toLowerCase().includes(query)))
      && (this.orderFilter() === 'ALL' || order.status === this.orderFilter() || order.side === this.orderFilter()));
  });

  protected setView(view: View): void {
    this.view.set(view);
    this.search.set('');
    this.clearFilters();
  }

  protected refresh(): void { this.refreshKey.update(value => value + 1); }

  protected clearFilters(): void {
    this.risk.set('ALL'); this.portfolio.set('ALL'); this.accountStatus.set('ALL'); this.orderFilter.set('ALL');
  }

  protected clientName(client: AdminClient): string {
    return [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ');
  }

  protected selectClient(client: AdminClient): void { this.selectedClient.set(client); }
  protected selectAccount(account: AdminAccount): void { this.selectedAccount.set(account); }
  protected selectOrder(order: AdminOrder): void { this.selectedOrder.set(order); }
  protected closeDetails(): void { this.selectedClient.set(null); this.selectedAccount.set(null); this.selectedOrder.set(null); }

  protected copy(value: string): void { void navigator.clipboard?.writeText(value); }

  protected percent(value: number | undefined): number { return value ?? 0; }
  protected bar(value: number, total: number): number { return total ? Math.min(100, (value / total) * 100) : 0; }
}