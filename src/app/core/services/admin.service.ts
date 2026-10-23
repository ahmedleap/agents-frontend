import { Injectable, inject } from '@angular/core';
import { map, Observable, of } from 'rxjs';
import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

export interface AdminInsights {
  totalClients: number;
  totalAccounts: number;
  totalOrders: number;
  filledOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  totalTradingVolume: number;
  totalTradedValue: number;
  filledQuantity: number;
  orderFulfillmentRate: number;
  orderCancellationRate: number;
  averageOrderValue: number;
  averageOrderQuantity: number;
  assetsUnderManagement: number;
  averagePortfolioSize: number;
  activeClientsLast30Days: number;
  activeAccountsLast30Days: number;
}

export interface AdminClient {
  id: string;
  clientId: string;
  firstName?: string;
  middleName?: string;
  lastName?: string;
  clientName?: string;
  email: string;
  dateOfBirth?: string | null;
  joinDate?: string | null;
  ssnLastFour?: string | null;
  portfolioSize?: string | null;
  portfolioSizeRange?: string | null;
  riskTolerance?: string | null;
  portfolioValue?: number | null;
  accountIds?: string[];
  phoneNumber?: string | null;
  country?: string | null;
}

export interface AdminAccount {
  id: string;
  clientId: string;
  clientName: string;
  name: string;
  cashBalance: number;
  status: string;
  openDate: string;
}

export interface AdminOrder {
  id: string;
  accountId: string;
  clientId: string;
  clientName: string;
  instrumentId: string;
  ticker: string;
  instrumentName: string;
  side: 'BUY' | 'SELL';
  quantity: number;
  limitPrice: number;
  filledPrice?: number;
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'STOPPED' | 'REJECTED';
  createdAt: string;
  filledAt?: string;
  cancelledAt?: string;
  cancellationReason?: string;
}

export interface TopInstrument {
  ticker: string;
  instrumentName: string;
  assetClass: string;
  tradeCount: number;
  totalVolume: number;
  totalVolumeValue: number;
  averagePrice: number;
  uniqueTraders: number;
}

export interface AdminHealth {
  status: string;
  serviceName: string;
  description: string;
  timestamp: string;
}

export interface TradingActivityReport {
  totalOrders: number;
  filledOrders: number;
  pendingOrders: number;
  cancelledOrders: number;
  filledQuantity: number;
  tradedValue: number;
}

export interface TradeAuditEvent {
  id: string;
  orderId: string;
  accountId: string;
  clientId: string;
  clientName: string;
  eventType: string;
  eventTimestamp: string;
  reason?: string;
  createdAt: string;
  details?: Record<string, unknown>;
  actor?: string;
}

@Injectable({ providedIn: 'root' })
export class AdminService {
  private readonly api = inject(ApiService);
  private readonly mock = environment.features.enableMocking;

  insights(): Observable<AdminInsights> {
    return this.mock ? of(MOCK_INSIGHTS) : this.api.get<AdminInsights>('v1/admin/insights');
  }

  tradingActivity(): Observable<TradingActivityReport> {
    return this.mock ? of({ totalOrders: 18420, filledOrders: 15106, pendingOrders: 1840, cancelledOrders: 1062, filledQuantity: 12480000, tradedValue: 583400000 }) : this.api.get<TradingActivityReport>('v1/admin/reports/tradingactivity');
  }

  platformMetrics(): Observable<AdminInsights> {
    return this.mock ? of(MOCK_INSIGHTS) : this.api.get<AdminInsights>('v1/analytics/platform/metrics');
  }

  clients(): Observable<AdminClient[]> {
    return this.mock
      ? of(MOCK_CLIENTS.map(normalizeAdminClient))
      : this.api.get<unknown[]>('v1/admin/clients').pipe(map(rows => rows.map(normalizeAdminClient)));
  }

  client(id: string): Observable<AdminClient> {
    return this.mock
      ? of(normalizeAdminClient(MOCK_CLIENTS.find(client => client.id === id || client.clientId === id) ?? MOCK_CLIENTS[0]))
      : this.api.get<unknown>(`v1/admin/clients/${id}`).pipe(map(normalizeAdminClient));
  }

  accounts(): Observable<AdminAccount[]> {
    return this.mock
      ? of(MOCK_ACCOUNTS.map(normalizeAdminAccount))
      : this.api.get<unknown[]>('v1/admin/accounts').pipe(map(rows => rows.map(normalizeAdminAccount)));
  }

  account(id: string): Observable<AdminAccount> {
    return this.mock
      ? of(normalizeAdminAccount(MOCK_ACCOUNTS.find(account => account.id === id) ?? MOCK_ACCOUNTS[0]))
      : this.api.get<unknown>(`v1/admin/accounts/${id}`).pipe(map(normalizeAdminAccount));
  }

  orders(): Observable<AdminOrder[]> {
    return this.mock
      ? of(MOCK_ORDERS.map(normalizeAdminOrder))
      : this.api.get<unknown[]>('v1/admin/orders').pipe(map(rows => rows.map(normalizeAdminOrder)));
  }

  order(id: string): Observable<AdminOrder> {
    return this.mock
      ? of(normalizeAdminOrder(MOCK_ORDERS.find(order => order.id === id) ?? MOCK_ORDERS[0]))
      : this.api.get<unknown>(`v1/admin/orders/${id}`).pipe(map(normalizeAdminOrder));
  }

  topInstruments(limit = 20): Observable<TopInstrument[]> {
    return this.mock ? of(MOCK_INSTRUMENTS.slice(0, limit)) : this.api.get<TopInstrument[]>('v1/analytics/instruments/top-traded', { params: { limit } });
  }

  health(): Observable<AdminHealth> {
    return this.mock ? of({ status: 'UP', serviceName: 'Analytics service', description: 'Read-only reporting is available', timestamp: new Date().toISOString() }) : this.api.get<AdminHealth>('v1/analytics/health');
  }

  audit(tradeId: string): Observable<TradeAuditEvent[]> {
    return this.mock
      ? of(MOCK_AUDIT.filter(event => event.orderId === tradeId))
      : this.api.get<unknown[]>(`v1/admin/trades/${tradeId}/audit`).pipe(map(rows => rows.map(normalizeAuditEvent)));
  }
}

function normalizeAdminClient(value: unknown): AdminClient {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const clientId = String(row['clientId'] ?? row['id'] ?? '');
  const clientName = deduplicateRepeatedWords(String(row['clientName'] ?? '').trim());
  const nameParts = clientName ? clientName.split(/\s+/) : [];
  const firstName = deduplicateRepeatedWords(String(row['firstName'] ?? nameParts.shift() ?? ''));
  const lastName = deduplicateRepeatedWords(String(row['lastName'] ?? nameParts.pop() ?? ''));
  const middleName = deduplicateRepeatedWords(row['middleName'] == null ? nameParts.join(' ') : String(row['middleName']));

  return {
    id: clientId,
    clientId,
    firstName,
    middleName,
    lastName,
    clientName: clientName || [firstName, middleName, lastName].filter(Boolean).join(' '),
    email: String(row['email'] ?? ''),
    dateOfBirth: nullableString(row['dateOfBirth']),
    joinDate: nullableString(row['joinDate']),
    ssnLastFour: nullableString(row['ssnLastFour']),
    portfolioSize: nullableString(row['portfolioSize'] ?? row['portfolioSizeRange']),
    portfolioSizeRange: nullableString(row['portfolioSizeRange'] ?? row['portfolioSize']),
    riskTolerance: nullableString(row['riskTolerance']),
    portfolioValue: typeof row['portfolioValue'] === 'number' ? row['portfolioValue'] : null,
    accountIds: Array.isArray(row['accountIds']) ? row['accountIds'].map(String) : [],
    phoneNumber: nullableString(row['phoneNumber']),
    country: nullableString(row['country'])
  };
}

function nullableString(value: unknown): string | null {
  return value == null || value === '' ? null : String(value);
}

function deduplicateRepeatedWords(value: string): string {
  return value.trim().split(/\s+/).filter((word, index, words) =>
    index === 0 || word.toLocaleLowerCase() !== words[index - 1].toLocaleLowerCase()
  ).join(' ');
}

function normalizeAdminAccount(value: unknown): AdminAccount {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    id: String(row['accountId'] ?? row['id'] ?? ''),
    clientId: String(row['clientId'] ?? ''),
    clientName: String(row['clientName'] ?? ''),
    name: String(row['name'] ?? row['accountName'] ?? 'Account'),
    cashBalance: typeof row['cashBalance'] === 'number' ? row['cashBalance'] : 0,
    status: String(row['status'] ?? 'UNKNOWN'),
    openDate: String(row['openDate'] ?? '')
  };
}

function normalizeAdminOrder(value: unknown): AdminOrder {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  return {
    id: String(row['orderId'] ?? row['id'] ?? ''),
    accountId: String(row['accountId'] ?? ''),
    clientId: String(row['clientId'] ?? ''),
    clientName: String(row['clientName'] ?? ''),
    instrumentId: String(row['instrumentId'] ?? ''),
    ticker: String(row['ticker'] ?? row['symbol'] ?? ''),
    instrumentName: String(row['instrumentName'] ?? row['ticker'] ?? row['symbol'] ?? ''),
    side: row['side'] === 'SELL' ? 'SELL' : 'BUY',
    quantity: typeof row['quantity'] === 'number' ? row['quantity'] : 0,
    limitPrice: typeof row['limitPrice'] === 'number' ? row['limitPrice'] : 0,
    filledPrice: typeof row['filledPrice'] === 'number' ? row['filledPrice'] : undefined,
    status: normalizeOrderStatus(row['status']),
    createdAt: String(row['createdAt'] ?? ''),
    filledAt: nullableString(row['filledAt']) ?? undefined,
    cancelledAt: nullableString(row['cancelledAt'] ?? row['cancelled_at'] ?? row['stoppedAt'] ?? row['stopped_at']) ?? undefined,
    cancellationReason: nullableString(row['cancellationReason'] ?? row['cancelReason'] ?? row['cancel_reason'] ?? row['stopReason'] ?? row['stop_reason']) ?? undefined
  };
}

function normalizeOrderStatus(value: unknown): AdminOrder['status'] {
  const status = String(value ?? '').toUpperCase();
  if (status === 'CANCELED') return 'CANCELLED';
  if (status === 'STOP') return 'STOPPED';
  return status === 'FILLED' || status === 'CANCELLED' || status === 'STOPPED' || status === 'REJECTED'
    ? status
    : 'PENDING';
}

function normalizeAuditEvent(value: unknown): TradeAuditEvent {
  const row = value && typeof value === 'object' ? value as Record<string, unknown> : {};
  const details = row['details'] && typeof row['details'] === 'object'
    ? row['details'] as Record<string, unknown>
    : undefined;
  return {
    id: String(row['id'] ?? row['auditId'] ?? ''),
    orderId: String(row['orderId'] ?? ''),
    accountId: String(row['accountId'] ?? ''),
    clientId: String(row['clientId'] ?? ''),
    clientName: String(row['clientName'] ?? ''),
    eventType: String(row['eventType'] ?? row['event_type'] ?? row['action'] ?? 'Order updated'),
    eventTimestamp: String(row['eventTimestamp'] ?? row['event_timestamp'] ?? row['createdAt'] ?? row['created_at'] ?? ''),
    reason: nullableString(row['reason'] ?? row['cancel_reason'] ?? row['cancellationReason'] ?? row['stop_reason']) ?? undefined,
    createdAt: String(row['createdAt'] ?? row['created_at'] ?? row['eventTimestamp'] ?? row['event_timestamp'] ?? ''),
    details,
    actor: nullableString(row['actor'] ?? row['performedBy'] ?? row['performed_by'] ?? row['username']) ?? undefined
  };
}

const MOCK_INSIGHTS: AdminInsights = {
  totalClients: 560, totalAccounts: 894, totalOrders: 18420, filledOrders: 15106,
  pendingOrders: 1840, cancelledOrders: 1062, totalTradingVolume: 12480000,
  totalTradedValue: 583400000, filledQuantity: 12480000, orderFulfillmentRate: 82,
  orderCancellationRate: 5.8, averageOrderValue: 31684, averageOrderQuantity: 826,
  assetsUnderManagement: 184200000, averagePortfolioSize: 328929,
  activeClientsLast30Days: 238, activeAccountsLast30Days: 381
};

const MOCK_CLIENTS: AdminClient[] = [
  { id: 'clt-7f19a2', clientId: 'clt-7f19a2', firstName: 'Maya', middleName: 'R.', lastName: 'Chen', email: 'maya.chen@example.com', dateOfBirth: '1988-04-12', joinDate: '2026-10-14', ssnLastFour: '4821', portfolioSize: 'LARGE', riskTolerance: 'MODERATE', portfolioValue: 842300, accountIds: ['acc-1048', 'acc-1049'] },
  { id: 'clt-3b82de', clientId: 'clt-3b82de', firstName: 'Jordan', lastName: 'Brooks', email: 'jordan.brooks@example.com', dateOfBirth: '1992-09-21', joinDate: '2026-10-12', ssnLastFour: '1904', portfolioSize: 'MEDIUM', riskTolerance: 'AGGRESSIVE', portfolioValue: 184500, accountIds: ['acc-1047'] },
  { id: 'clt-98c4a1', clientId: 'clt-98c4a1', firstName: 'Elena', lastName: 'Rivera', email: 'elena.rivera@example.com', dateOfBirth: '1979-02-06', joinDate: '2026-10-09', ssnLastFour: '7782', portfolioSize: 'SMALL', riskTolerance: 'CONSERVATIVE', portfolioValue: 42600, accountIds: ['acc-1046'] },
  { id: 'clt-50d7f0', clientId: 'clt-50d7f0', firstName: 'Theo', middleName: 'J.', lastName: 'Martin', email: 'theo.martin@example.com', dateOfBirth: '1985-11-30', joinDate: '2026-09-28', ssnLastFour: '6340', portfolioSize: 'LARGE', riskTolerance: 'AGGRESSIVE', portfolioValue: 1245000, accountIds: ['acc-1043', 'acc-1044'] }
];

const MOCK_ACCOUNTS: AdminAccount[] = [
  { id: 'acc-1048', clientId: 'clt-7f19a2', clientName: 'Maya Chen', name: 'Growth Portfolio', cashBalance: 34200, status: 'ACTIVE', openDate: '2026-10-14' },
  { id: 'acc-1047', clientId: 'clt-3b82de', clientName: 'Jordan Brooks', name: 'Trading Account', cashBalance: 12800, status: 'ACTIVE', openDate: '2026-10-12' },
  { id: 'acc-1046', clientId: 'clt-98c4a1', clientName: 'Elena Rivera', name: 'Core Holdings', cashBalance: 9600, status: 'ACTIVE', openDate: '2026-10-09' },
  { id: 'acc-1043', clientId: 'clt-50d7f0', clientName: 'Theo Martin', name: 'Long Term', cashBalance: 88300, status: 'SUSPENDED', openDate: '2026-09-28' }
];

const MOCK_ORDERS: AdminOrder[] = [
  { id: 'ord-882104', accountId: 'acc-1048', clientId: 'clt-7f19a2', clientName: 'Maya Chen', instrumentId: 'ins-aapl', ticker: 'AAPL', instrumentName: 'Apple Inc.', side: 'BUY', quantity: 120, limitPrice: 228.4, filledPrice: 228.18, status: 'FILLED', createdAt: '2026-10-16T14:22:00Z', filledAt: '2026-10-16T14:22:04Z' },
  { id: 'ord-882103', accountId: 'acc-1047', clientId: 'clt-3b82de', clientName: 'Jordan Brooks', instrumentId: 'ins-nvda', ticker: 'NVDA', instrumentName: 'NVIDIA Corp.', side: 'SELL', quantity: 80, limitPrice: 184.2, status: 'PENDING', createdAt: '2026-10-16T14:18:00Z' },
  { id: 'ord-882102', accountId: 'acc-1046', clientId: 'clt-98c4a1', clientName: 'Elena Rivera', instrumentId: 'ins-msft', ticker: 'MSFT', instrumentName: 'Microsoft Corp.', side: 'BUY', quantity: 45, limitPrice: 510.1, status: 'CANCELLED', createdAt: '2026-10-16T13:51:00Z', cancelledAt: '2026-10-16T13:55:00Z', cancellationReason: 'Client request' },
  { id: 'ord-882101', accountId: 'acc-1043', clientId: 'clt-50d7f0', clientName: 'Theo Martin', instrumentId: 'ins-spy', ticker: 'SPY', instrumentName: 'SPDR S&P 500 ETF', side: 'BUY', quantity: 200, limitPrice: 665.3, filledPrice: 665.24, status: 'FILLED', createdAt: '2026-10-16T13:30:00Z', filledAt: '2026-10-16T13:30:03Z' }
];

const MOCK_INSTRUMENTS: TopInstrument[] = [
  { ticker: 'AAPL', instrumentName: 'Apple Inc.', assetClass: 'EQUITY', tradeCount: 2140, totalVolume: 182400, totalVolumeValue: 41610000, averagePrice: 228.18, uniqueTraders: 482 },
  { ticker: 'NVDA', instrumentName: 'NVIDIA Corp.', assetClass: 'EQUITY', tradeCount: 1948, totalVolume: 210300, totalVolumeValue: 38700000, averagePrice: 184.05, uniqueTraders: 451 },
  { ticker: 'SPY', instrumentName: 'SPDR S&P 500 ETF', assetClass: 'ETF', tradeCount: 1722, totalVolume: 145800, totalVolumeValue: 37500000, averagePrice: 665.24, uniqueTraders: 398 },
  { ticker: 'MSFT', instrumentName: 'Microsoft Corp.', assetClass: 'EQUITY', tradeCount: 1386, totalVolume: 94200, totalVolumeValue: 48000000, averagePrice: 509.55, uniqueTraders: 342 }
];

const MOCK_AUDIT: TradeAuditEvent[] = [
  { id: 'evt-1', orderId: 'ord-882104', accountId: 'acc-1048', clientId: 'clt-7f19a2', clientName: 'Maya Chen', eventType: 'Submitted', eventTimestamp: '2026-10-16T14:22:00Z', createdAt: '2026-10-16T14:22:00Z', details: { side: 'BUY', quantity: 120 } },
  { id: 'evt-2', orderId: 'ord-882104', accountId: 'acc-1048', clientId: 'clt-7f19a2', clientName: 'Maya Chen', eventType: 'Filled', eventTimestamp: '2026-10-16T14:22:04Z', createdAt: '2026-10-16T14:22:04Z', details: { filledPrice: 228.18 } }
];