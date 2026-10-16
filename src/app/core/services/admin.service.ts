import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
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
  firstName: string;
  middleName?: string;
  lastName: string;
  email: string;
  dateOfBirth: string;
  joinDate: string;
  ssnLastFour: string;
  portfolioSize: string;
  riskTolerance: string;
  portfolioValue: number;
  accountIds: string[];
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
  status: 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED';
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
    return this.mock ? of(MOCK_CLIENTS) : this.api.get<AdminClient[]>('v1/admin/clients');
  }

  client(id: string): Observable<AdminClient> {
    return this.mock ? of(MOCK_CLIENTS.find(client => client.id === id) ?? MOCK_CLIENTS[0]) : this.api.get<AdminClient>(`v1/admin/clients/${id}`);
  }

  accounts(): Observable<AdminAccount[]> {
    return this.mock ? of(MOCK_ACCOUNTS) : this.api.get<AdminAccount[]>('v1/admin/accounts');
  }

  account(id: string): Observable<AdminAccount> {
    return this.mock ? of(MOCK_ACCOUNTS.find(account => account.id === id) ?? MOCK_ACCOUNTS[0]) : this.api.get<AdminAccount>(`v1/admin/accounts/${id}`);
  }

  orders(): Observable<AdminOrder[]> {
    return this.mock ? of(MOCK_ORDERS) : this.api.get<AdminOrder[]>('v1/admin/orders');
  }

  order(id: string): Observable<AdminOrder> {
    return this.mock ? of(MOCK_ORDERS.find(order => order.id === id) ?? MOCK_ORDERS[0]) : this.api.get<AdminOrder>(`v1/admin/orders/${id}`);
  }

  topInstruments(limit = 20): Observable<TopInstrument[]> {
    return this.mock ? of(MOCK_INSTRUMENTS.slice(0, limit)) : this.api.get<TopInstrument[]>('v1/analytics/instruments/top-traded', { params: { limit } });
  }

  health(): Observable<AdminHealth> {
    return this.mock ? of({ status: 'UP', serviceName: 'Analytics service', description: 'Read-only reporting is available', timestamp: new Date().toISOString() }) : this.api.get<AdminHealth>('v1/analytics/health');
  }

  audit(tradeId: string): Observable<TradeAuditEvent[]> {
    return this.mock ? of(MOCK_AUDIT.filter(event => event.orderId === tradeId)) : this.api.get<TradeAuditEvent[]>(`v1/admin/trades/${tradeId}/audit`);
  }
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
  { id: 'clt-7f19a2', firstName: 'Maya', middleName: 'R.', lastName: 'Chen', email: 'maya.chen@example.com', dateOfBirth: '1988-04-12', joinDate: '2026-10-14', ssnLastFour: '4821', portfolioSize: 'LARGE', riskTolerance: 'MODERATE', portfolioValue: 842300, accountIds: ['acc-1048', 'acc-1049'] },
  { id: 'clt-3b82de', firstName: 'Jordan', lastName: 'Brooks', email: 'jordan.brooks@example.com', dateOfBirth: '1992-09-21', joinDate: '2026-10-12', ssnLastFour: '1904', portfolioSize: 'MEDIUM', riskTolerance: 'AGGRESSIVE', portfolioValue: 184500, accountIds: ['acc-1047'] },
  { id: 'clt-98c4a1', firstName: 'Elena', lastName: 'Rivera', email: 'elena.rivera@example.com', dateOfBirth: '1979-02-06', joinDate: '2026-10-09', ssnLastFour: '7782', portfolioSize: 'SMALL', riskTolerance: 'CONSERVATIVE', portfolioValue: 42600, accountIds: ['acc-1046'] },
  { id: 'clt-50d7f0', firstName: 'Theo', middleName: 'J.', lastName: 'Martin', email: 'theo.martin@example.com', dateOfBirth: '1985-11-30', joinDate: '2026-09-28', ssnLastFour: '6340', portfolioSize: 'LARGE', riskTolerance: 'AGGRESSIVE', portfolioValue: 1245000, accountIds: ['acc-1043', 'acc-1044'] }
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