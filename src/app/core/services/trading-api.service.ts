import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { ApiService } from './api.service';

export interface InstrumentSearchResult {
  instrumentId: string;
  ticker: string;
  name: string;
  assetClass: string;
  industry?: string;
}

export interface QuoteDto {
  ticker: string;
  bid?: number;
  ask?: number;
  midPrice?: number;
  lastPrice?: number;
  currentPrice?: number;
  priceChange?: number;
  priceChangePercent?: number;
  dayChange?: number;
  dayChangePercent?: number;
  volume?: number;
  timestamp?: string;
  stale?: boolean;
}

export interface QuoteEnvelope {
  data?: QuoteDto;
  quote?: QuoteDto;
}

export interface HistoricalBarDto {
  timestamp: string;
  open?: number;
  high?: number;
  low?: number;
  close: number;
  volume?: number;
}

export interface HistoryResponseDto {
  ticker: string;
  period: string;
  barCount: number;
  bars: HistoricalBarDto[];
  summary?: {
    startPrice?: number;
    endPrice?: number;
    change?: number;
    changePercent?: number;
  };
}

export interface CreateOrderRequest {
  accountId: string;
  instrumentId: string;
  quantity: number;
  price?: number;
  orderType: 'BUY' | 'SELL';
}

export interface CreateOrderResponse {
  orderId?: string;
  accountId?: string;
  instrumentId?: string;
  quantity?: number;
  price?: number;
  totalValue?: number;
  orderType?: string;
  status?: string;
  createdAt?: string;
  message?: string;
}

export interface OrderSummaryDto {
  orderId: string;
  accountId: string;
  ticker?: string;
  instrumentTicker?: string;
  instrument?: string | { ticker?: string; symbol?: string };
  submittedAt: string;
  orderType: 'BUY' | 'SELL';
  quantity: number;
  limitPrice?: number | null;
  filledPrice?: number | null;
  status: string;
}

export interface OrderDetailDto extends OrderSummaryDto {
  createdAt: string;
  instrument?: { ticker?: string; name?: string };
}

@Injectable({ providedIn: 'root' })
export class TradingApiService {
  private readonly api = inject(ApiService);

  searchInstruments(query: string): Observable<{ results: InstrumentSearchResult[] }> {
    return this.api.get<{ results: InstrumentSearchResult[] }>('instruments/search', {
      params: { q: query }
    });
  }

  listInstruments(): Observable<{ results: InstrumentSearchResult[] }> {
    return this.api.get<{ results: InstrumentSearchResult[] }>('instruments');
  }

  getQuote(ticker: string): Observable<QuoteDto> {
    return this.api.get<QuoteDto>(`instruments/${encodeURIComponent(ticker)}/quote`);
  }

  getHistory(ticker: string, period = '1M'): Observable<HistoryResponseDto> {
    return this.api.get<HistoryResponseDto>(`instruments/${encodeURIComponent(ticker)}/history`, {
      params: { period }
    });
  }

  createOrder(request: CreateOrderRequest): Observable<CreateOrderResponse> {
    return this.api.post<CreateOrderResponse>('v1/orders', request);
  }

  getOrderHistory(accountId: string): Observable<OrderSummaryDto[]> {
    return this.api.get<OrderSummaryDto[]>('v1/orders', { params: { accountId } });
  }

  getOrder(orderId: string): Observable<OrderDetailDto> {
    return this.api.get<OrderDetailDto>(`v1/orders/${encodeURIComponent(orderId)}`);
  }
}