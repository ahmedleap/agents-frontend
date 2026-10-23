import { Component, computed, inject, signal } from '@angular/core';
import { CurrencyPipe, DatePipe, DecimalPipe } from '@angular/common';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, map, of } from 'rxjs';
import { AdminAccount, AdminClient, AdminOrder, AdminService, TradeAuditEvent } from '../../core/services/admin.service';

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
  protected readonly auditEvents = signal<TradeAuditEvent[]>([]);
  protected readonly auditLoading = signal(false);
  protected readonly auditError = signal<string | null>(null);
  protected readonly refreshKey = signal(0);

  protected readonly data = rxResource({
    params: () => this.refreshKey(),
    stream: () => forkJoin({
      clients: this.admin.clients(),
      accounts: this.admin.accounts(),
      orders: this.admin.orders().pipe(
        map(rows => ({ rows, available: true })),
        catchError(() => of({ rows: [] as AdminOrder[], available: false }))
      ),
      health: this.admin.health().pipe(catchError(() => of(null)))
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
    const rows = this.data.value()?.orders.rows ?? [];
    const query = this.search().trim().toLowerCase();
    return rows.filter(order => (!query || [order.id, order.accountId, order.clientName, order.ticker].some(value => value.toLowerCase().includes(query)))
      && (this.orderFilter() === 'ALL' || order.status === this.orderFilter() || order.side === this.orderFilter()));
  });

  protected readonly selectedClientAccounts = computed(() => {
    const client = this.selectedClient();
    if (!client) return [];
    const accountIds = new Set(client.accountIds ?? []);
    return (this.data.value()?.accounts ?? []).filter(account =>
      account.clientId === client.clientId || accountIds.has(account.id)
    );
  });

  protected readonly selectedClientOrders = computed(() => {
    const client = this.selectedClient();
    if (!client) return [];
    const accountIds = new Set(this.selectedClientAccounts().map(account => account.id));
    return (this.data.value()?.orders.rows ?? []).filter(order =>
      order.clientId === client.clientId || accountIds.has(order.accountId)
    );
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
    const name = [client.firstName, client.middleName, client.lastName].filter(Boolean).join(' ') || client.clientName || '';
    return name.split(/\s+/).filter((word, index, words) =>
      index === 0 || word.toLocaleLowerCase() !== words[index - 1].toLocaleLowerCase()
    ).join(' ') || 'Unnamed client';
  }

  protected searchClients(value: string): void { this.search.set(value.trim()); }

  protected selectClient(client: AdminClient): void { this.selectedClient.set(client); }
  protected selectAccount(account: AdminAccount): void { this.selectedAccount.set(account); }
  protected selectOrder(order: AdminOrder): void {
    this.selectedOrder.set(order);
    this.auditEvents.set([]);
    this.auditError.set(null);
    this.auditLoading.set(true);
    this.admin.audit(order.id).subscribe({
      next: events => { this.auditEvents.set(events); this.auditLoading.set(false); },
      error: () => { this.auditError.set('Audit history is unavailable for this order.'); this.auditLoading.set(false); }
    });
  }

  protected auditDetails(event: TradeAuditEvent): string[] {
    return Object.entries(event.details ?? {}).map(([key, value]) => `${this.label(key)}: ${String(value)}`);
  }

  protected label(value: string): string {
    return value.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/[_-]+/g, ' ').replace(/^./, char => char.toUpperCase());
  }

  protected closeDetails(): void {
    this.selectedClient.set(null);
    this.selectedAccount.set(null);
    this.selectedOrder.set(null);
    this.auditEvents.set([]);
    this.auditLoading.set(false);
    this.auditError.set(null);
  }

  protected percent(value: number | undefined): number { return value ?? 0; }
  protected bar(value: number, total: number): number { return total ? Math.min(100, (value / total) * 100) : 0; }
}