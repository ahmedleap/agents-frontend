import { Injectable, inject } from '@angular/core';
import { Observable, of } from 'rxjs';
import { addDays, eachDayOfInterval, format, parseISO } from 'date-fns';

import { ApiService } from './api.service';
import { environment } from '../../../environments/environment';

// ---------- Response shapes (mirror the warehouse DTOs) ----------

export interface TotalVolumeResponse {
  totalQuantityTraded: number;
  totalValueTraded: number;
  totalOrdersExecuted: number;
  averageOrderQuantity: number;
  averageOrderValue: number;
}

export interface TotalTradesResponse {
  totalTrades: number;
  filledTrades: number;
  cancelledTrades: number;
  fulfillmentRate: number;
  buyPercentage: number;
  sellPercentage: number;
}

export interface ActiveClientsResponse {
  totalActiveClients: number;
  totalClients: number;
  activeClientPercentage: number;
  activeAccounts: number;
}

export interface InstrumentTrendResponse {
  date: string;
  ticker: string;
  instrumentName?: string;
  assetClass?: string;
  tradeCount: number;
  totalQuantity?: number;
  totalValue: number;
  uniqueTraders: number;
}

export interface VolumeTrendResponse {
  date: string;
  totalQuantityTraded: number;
  totalValueTraded: number;
  tradeCount: number;
  buyCount: number;
  sellCount: number;
}

export type SegmentType = 'RISK_TOLERANCE' | 'PORTFOLIO_SIZE';

export interface SegmentTrendResponse {
  date: string;
  segment: string;
  tradeCount: number;
  totalVolume: number;
  activeClientCount: number;
  averageOrderValue: number;
}

export interface FulfillmentTrendResponse {
  date: string;
  totalOrders: number;
  filledOrders: number;
  cancelledOrders: number;
  fulfillmentRate: number;
  averageOrderDurationSeconds: number;
  peakTradingTime: string;
}

/** Dates are passed to the API as YYYY-MM-DD. */
export function isoDate(d: Date): string {
  return format(d, 'yyyy-MM-dd');
}

const BASE = 'v1/analytics/dashboard';

/**
 * Analytics warehouse endpoints (GET /api/v1/analytics/dashboard/*).
 *
 * With environment.features.enableMocking on, every call returns generated data
 * instead, so the page can be worked on before the backend is running.
 */
@Injectable({ providedIn: 'root' })
export class AnalyticsService {
  private readonly api = inject(ApiService);
  private readonly mock = environment.features.enableMocking;

  totalVolume(date: string): Observable<TotalVolumeResponse> {
    if (this.mock) return of(mockTotalVolume(date));
    return this.get('total-volume', { date });
  }

  totalTrades(date: string): Observable<TotalTradesResponse> {
    if (this.mock) return of(mockTotalTrades(date));
    return this.get('total-trades', { date });
  }

  activeClients(date: string): Observable<ActiveClientsResponse> {
    if (this.mock) return of(mockActiveClients(date));
    return this.get('active-clients', { date });
  }

  mostActiveInstruments(date: string, limit = 20): Observable<InstrumentTrendResponse[]> {
    if (this.mock) return of(mockInstruments(date).slice(0, limit));
    return this.get('most-active-instruments', { date, limit });
  }

  volumeTrend(startDate: string, endDate: string): Observable<VolumeTrendResponse[]> {
    if (this.mock) return of(days(startDate, endDate).map(mockVolumeDay));
    return this.get('volume-trend', { startDate, endDate });
  }

  instrumentTrend(startDate: string, endDate: string): Observable<InstrumentTrendResponse[]> {
    if (this.mock) return of(days(startDate, endDate).flatMap(mockInstruments));
    return this.get('instrument-trend', { startDate, endDate });
  }

  segmentTrends(segmentType: SegmentType, startDate: string, endDate: string): Observable<SegmentTrendResponse[]> {
    if (this.mock) return of(days(startDate, endDate).flatMap(d => mockSegments(d, segmentType)));
    return this.get('segment-trends', { segmentType, startDate, endDate });
  }

  fulfillmentTrends(startDate: string, endDate: string): Observable<FulfillmentTrendResponse[]> {
    if (this.mock) return of(days(startDate, endDate).map(mockFulfillmentDay));
    return this.get('fulfillment-trends', { startDate, endDate });
  }

  private get<T>(endpoint: string, query: Record<string, string | number>): Observable<T> {
    return this.api.get<T>(`${BASE}/${endpoint}`, { params: query });
  }
}

// ---------- Mock data (deterministic per date, so reloads look the same) ----------

function days(start: string, end: string): string[] {
  return eachDayOfInterval({ start: parseISO(start), end: parseISO(end) }).map(isoDate);
}

/** Stable pseudo-random number in [0, 1) for a given key. */
function rand(key: string): number {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return ((h >>> 0) % 10_000) / 10_000;
}

/** Weekend trading is much lighter. */
function dayWeight(date: string): number {
  const dow = parseISO(date).getDay();
  return dow === 0 || dow === 6 ? 0.25 : 0.85 + rand(date) * 0.3;
}

const INSTRUMENTS = [
  { ticker: 'AAPL', instrumentName: 'Apple Inc.', assetClass: 'EQUITY', price: 178, weight: 1 },
  { ticker: 'MSFT', instrumentName: 'Microsoft Corp.', assetClass: 'EQUITY', price: 376, weight: 0.8 },
  { ticker: 'NVDA', instrumentName: 'NVIDIA Corp.', assetClass: 'EQUITY', price: 492, weight: 0.75 },
  { ticker: 'TSLA', instrumentName: 'Tesla Inc.', assetClass: 'EQUITY', price: 196, weight: 0.7 },
  { ticker: 'AMZN', instrumentName: 'Amazon.com Inc.', assetClass: 'EQUITY', price: 147, weight: 0.6 },
  { ticker: 'SPY', instrumentName: 'SPDR S&P 500 ETF', assetClass: 'ETF', price: 452, weight: 0.55 },
  { ticker: 'GOOGL', instrumentName: 'Alphabet Inc.', assetClass: 'EQUITY', price: 139, weight: 0.45 },
  { ticker: 'META', instrumentName: 'Meta Platforms', assetClass: 'EQUITY', price: 331, weight: 0.4 },
  { ticker: 'QQQ', instrumentName: 'Invesco QQQ Trust', assetClass: 'ETF', price: 389, weight: 0.35 },
  { ticker: 'AMD', instrumentName: 'Advanced Micro Devices', assetClass: 'EQUITY', price: 122, weight: 0.3 },
  { ticker: 'TLT', instrumentName: 'iShares 20+ Yr Treasury', assetClass: 'FIXED_INCOME', price: 91, weight: 0.2 },
  { ticker: 'KO', instrumentName: 'Coca-Cola Co.', assetClass: 'EQUITY', price: 59, weight: 0.15 }
];

function mockInstruments(date: string): InstrumentTrendResponse[] {
  const w = dayWeight(date);
  return INSTRUMENTS.map(i => {
    const tradeCount = Math.round(900 * i.weight * w * (0.8 + rand(date + i.ticker) * 0.4));
    const totalQuantity = tradeCount * Math.round(40 + rand(i.ticker + date) * 30);
    return {
      date,
      ticker: i.ticker,
      instrumentName: i.instrumentName,
      assetClass: i.assetClass,
      tradeCount,
      totalQuantity,
      totalValue: totalQuantity * i.price,
      uniqueTraders: Math.round(tradeCount * (0.22 + rand(date + i.ticker + 't') * 0.08))
    };
  }).sort((a, b) => b.totalValue - a.totalValue);
}

function mockVolumeDay(date: string): VolumeTrendResponse {
  const rows = mockInstruments(date);
  const tradeCount = rows.reduce((s, r) => s + r.tradeCount, 0);
  const buyShare = 0.5 + (rand(date + 'buy') - 0.5) * 0.2;
  return {
    date,
    totalQuantityTraded: rows.reduce((s, r) => s + (r.totalQuantity ?? 0), 0),
    totalValueTraded: rows.reduce((s, r) => s + r.totalValue, 0),
    tradeCount,
    buyCount: Math.round(tradeCount * buyShare),
    sellCount: tradeCount - Math.round(tradeCount * buyShare)
  };
}

function mockFulfillmentDay(date: string): FulfillmentTrendResponse {
  const filledOrders = mockVolumeDay(date).tradeCount;
  const fulfillmentRate = 84 + rand(date + 'fr') * 10;
  const totalOrders = Math.round(filledOrders / (fulfillmentRate / 100));
  const cancelledOrders = Math.round((totalOrders - filledOrders) * 0.75);
  return {
    date,
    totalOrders,
    filledOrders,
    cancelledOrders,
    fulfillmentRate,
    averageOrderDurationSeconds: Math.round(110 + rand(date + 'dur') * 80),
    peakTradingTime: rand(date + 'peak') > 0.5 ? '09:30' : '15:45'
  };
}

function mockTotalVolume(date: string): TotalVolumeResponse {
  const d = mockVolumeDay(date);
  return {
    totalQuantityTraded: d.totalQuantityTraded,
    totalValueTraded: d.totalValueTraded,
    totalOrdersExecuted: d.tradeCount,
    averageOrderQuantity: d.totalQuantityTraded / d.tradeCount,
    averageOrderValue: d.totalValueTraded / d.tradeCount
  };
}

function mockTotalTrades(date: string): TotalTradesResponse {
  const f = mockFulfillmentDay(date);
  const v = mockVolumeDay(date);
  return {
    totalTrades: f.totalOrders,
    filledTrades: f.filledOrders,
    cancelledTrades: f.cancelledOrders,
    fulfillmentRate: f.fulfillmentRate,
    buyPercentage: (v.buyCount / v.tradeCount) * 100,
    sellPercentage: (v.sellCount / v.tradeCount) * 100
  };
}

function mockActiveClients(date: string): ActiveClientsResponse {
  const totalClients = 560;
  const totalActiveClients = Math.round(totalClients * 0.42 * dayWeight(date));
  return {
    totalActiveClients,
    totalClients,
    activeClientPercentage: (totalActiveClients / totalClients) * 100,
    activeAccounts: Math.round(totalActiveClients * 1.6)
  };
}

const SEGMENTS: Record<SegmentType, [string, number][]> = {
  RISK_TOLERANCE: [['CONSERVATIVE', 0.32], ['MODERATE', 0.48], ['AGGRESSIVE', 0.2]],
  PORTFOLIO_SIZE: [['SMALL', 0.38], ['MEDIUM', 0.41], ['LARGE', 0.21]]
};

function mockSegments(date: string, type: SegmentType): SegmentTrendResponse[] {
  const total = mockVolumeDay(date);
  return SEGMENTS[type].map(([segment, share]) => {
    const s = share * (0.9 + rand(date + segment) * 0.2);
    const tradeCount = Math.round(total.tradeCount * s);
    return {
      date,
      segment,
      tradeCount,
      totalVolume: Math.round(total.totalQuantityTraded * s),
      activeClientCount: Math.round(235 * s * dayWeight(date)),
      averageOrderValue: tradeCount ? (total.totalValueTraded * s) / tradeCount : 0
    };
  });
}

/** The day before a YYYY-MM-DD date. */
export function previousDay(date: string): string {
  return isoDate(addDays(parseISO(date), -1));
}
