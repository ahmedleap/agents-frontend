import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { catchError, forkJoin, interval, map, of, switchMap, takeWhile } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { DashboardService } from '../../core/services/dashboard.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
import { PortfolioApiService } from '../../core/services/portfolio-api.service';
import { CreateOrderResponse, HistoryResponseDto, InstrumentSearchResult, QuoteDto, TradingApiService } from '../../core/services/trading-api.service';
import { environment } from '../../../environments/environment';

interface Instrument {
  instrumentId: string;
  symbol: string;
  name: string;
  type: string;
  price: number;
  change: number;
  changePct: number;
  points: number[];
  chartPlaceholder: boolean;
  priceState: 'loading' | 'ready' | 'unavailable';
  changeReady: boolean;
  color: string;
}

type Side = 'buy' | 'sell';
type OrderType = 'market' | 'limit';
type ChartRange = '1D' | '1W' | '1M' | '3M' | '6M' | '1Y' | 'ALL';

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe],
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss']
})
export class TradesComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly accounts = inject(DashboardService).accounts;
  private readonly tradingApi = inject(TradingApiService);
  private readonly portfolioApi = inject(PortfolioApiService);
  private readonly orderHistory = inject(OrderHistoryService);
  private readonly route = inject(ActivatedRoute);
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );

  protected readonly account = computed(() => {
    const accounts = this.accounts();
    return accounts.find(account => account.id === this.accountIdParam()) ?? accounts[0];
  });
  protected readonly cashBalance = computed(() => this.account()?.availableBalance ?? 0);
  protected readonly searchQuery = signal('');
  protected readonly selected = signal<Instrument | null>(null);
  protected readonly side = signal<Side>('buy');
  protected readonly orderType = signal<OrderType>('market');
  protected readonly limitPrice = signal(0);
  protected readonly quantity = signal(10);
  protected readonly availableToSell = signal<number | null>(null);
  protected readonly confirmed = signal(false);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly submitting = signal(false);
  protected readonly orderStatus = signal<'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED'>('PENDING');
  protected readonly chartRange = signal<ChartRange>('1M');
  protected readonly chartRanges: ChartRange[] = ['1D', '1W', '1M', '3M', '6M', '1Y', 'ALL'];
  protected readonly chartPointsForOrder = signal<number[]>([]);
  protected readonly chartLoading = signal(false);

  protected readonly instruments = signal<Instrument[]>([]);

  protected readonly estimatedTotal = computed(() => {
    const instrument = this.selected();
    if (!instrument) return 0;
    return this.executionPrice() * this.quantity();
  });

  protected readonly executionPrice = computed(() => {
    const instrument = this.selected();
    if (!instrument) return 0;
    return this.orderType() === 'limit' ? this.limitPrice() : instrument.price;
  });

  protected readonly visibleInstruments = computed(() => this.instruments());

  constructor() {
    this.loadInstruments();
  }

  protected readonly canSubmit = computed(() => {
    const total = this.estimatedTotal();
    const sellable = this.availableToSell();
    return !!this.account()
      && !!this.selected()
      && this.quantity() > 0
      && this.executionPrice() > 0
      && (this.side() === 'buy' ? total <= this.cashBalance() : sellable !== null && this.quantity() <= sellable);
  });

  protected openOrder(instrument: Instrument): void {
    this.selected.set(instrument);
    this.availableToSell.set(null);
    this.side.set('buy');
    this.orderType.set('market');
    this.limitPrice.set(instrument.price);
    this.quantity.set(10);
    this.confirmed.set(false);
    this.error.set(null);
    this.chartRange.set('1M');
    this.chartPointsForOrder.set(instrument.points);
    this.loadOrderChart(instrument, '1M');
    this.loadAvailableToSell(instrument);
    if (instrument.price > 0) return;
    this.tradingApi.getQuote(instrument.symbol).subscribe({
      next: quote => {
        const updated = this.withQuote(instrument, quote);
        this.selected.set(updated);
        this.instruments.update(items => items.map(item => item.symbol === updated.symbol ? updated : item));
      },
      error: () => this.error.set('The latest quote could not be loaded. Review the order before submitting.')
    });
  }

  protected onSearch(event: Event): void {
    const query = (event.target as HTMLInputElement).value.trim();
    this.searchQuery.set(query);
    this.error.set(null);
    if (!query) {
      this.loadInstruments();
      return;
    }
    this.loading.set(true);
    this.tradingApi.searchInstruments(query).subscribe({
      next: response => {
        this.hydrateInstruments(response.results ?? []);
      },
      error: () => {
        this.instruments.set([]);
        this.loading.set(false);
        this.error.set('Instrument search is unavailable. Check your session and try again.');
      }
    });
  }

  protected switchAccount(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    if (accountId) this.router.navigate(['/trades', accountId]);
  }

  protected closeOrder(): void {
    this.selected.set(null);
    this.confirmed.set(false);
  }

  protected setChartRange(range: ChartRange): void {
    const instrument = this.selected();
    if (!instrument) return;
    this.chartRange.set(range);
    this.loadOrderChart(instrument, range);
  }

  protected setSide(side: Side): void {
    this.side.set(side);
    this.confirmed.set(false);
  }

  protected setOrderType(orderType: OrderType): void {
    this.orderType.set(orderType);
    this.confirmed.set(false);
  }

  protected setLimitPrice(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.limitPrice.set(Number.isFinite(value) ? Math.max(0, value) : 0);
    this.confirmed.set(false);
  }

  protected setQuantity(event: Event): void {
    const value = Number((event.target as HTMLInputElement).value);
    this.quantity.set(Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1);
    this.confirmed.set(false);
  }

  protected submitOrder(): void {
    const instrument = this.selected();
    const accountId = this.account()?.id;
    if (!this.canSubmit() || !instrument || !accountId) return;
    if (!instrument.instrumentId) {
      this.error.set('The backend did not return an instrument UUID, so this order cannot be placed.');
      return;
    }
    this.submitting.set(true);
    this.error.set(null);
    this.tradingApi.createOrder({
      accountId,
      instrumentId: instrument.instrumentId,
      quantity: this.quantity(),
      price: this.orderType() === 'limit' ? this.limitPrice() : undefined,
      orderType: this.side().toUpperCase() as 'BUY' | 'SELL'
    }).subscribe({
      next: (_response: CreateOrderResponse) => {
        this.submitting.set(false);
        this.orderStatus.set((_response.status as 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED') || 'PENDING');
        this.orderHistory.refresh(accountId);
        this.confirmed.set(true);
        if (_response.orderId) this.watchOrder(_response.orderId, accountId);
      },
      error: () => {
        this.submitting.set(false);
        this.error.set('The order was rejected by the trading service. No local balance was changed.');
      }
    });
  }

  private toInstrument(result: InstrumentSearchResult, index: number): Instrument {
    return {
      instrumentId: result.instrumentId,
      symbol: result.ticker,
      name: result.name,
      type: result.assetClass,
      price: 0,
      change: 0,
      changePct: 0,
      points: this.placeholderPoints(index),
      chartPlaceholder: true,
      priceState: 'loading',
      changeReady: false,
      color: ['#2f6f2a', '#2b6cb0', '#c0392b', '#6b46c1'][index % 4]
    };
  }

  private loadInstruments(): void {
    this.loading.set(true);
    this.error.set(null);
    this.tradingApi.listInstrumentsWithQuotes().subscribe({
      next: response => this.hydrateInstruments(response),
      error: () => {
        this.instruments.set([]);
        this.loading.set(false);
        this.error.set('Instrument list is unavailable. Check your session and try again.');
      }
    });
  }

  private loadAvailableToSell(instrument: Instrument): void {
    const accountId = this.account()?.id;
    if (!accountId) return;

    this.portfolioApi.getAccountPortfolio(environment.devClientId, accountId).subscribe({
      next: portfolio => {
        if (this.selected()?.instrumentId !== instrument.instrumentId) return;
        const holding = (portfolio.holdings ?? []).find(item => item.instrumentId === instrument.instrumentId);
        this.availableToSell.set(holding?.quantity ?? 0);
      },
      error: () => {
        if (this.selected()?.instrumentId === instrument.instrumentId) this.availableToSell.set(null);
      }
    });
  }

  private hydrateInstruments(results: InstrumentSearchResult[]): void {
    const instruments = results.map((result, index) => {
      const instrument = this.toInstrument(result, index);
      const withQuote = 'lastPrice' in result
        ? this.withQuote(instrument, result as QuoteDto)
        : instrument;
      return withQuote;
    });
    if (!instruments.length) {
      this.instruments.set([]);
      this.loading.set(false);
      return;
    }

    this.instruments.set(instruments);
    this.loading.set(false);

    for (const instrument of instruments) {
      if (!this.isTicker(instrument.symbol)) {
        this.instruments.update(current => current.map(item => item.symbol === instrument.symbol
          ? { ...item, priceState: 'unavailable' as const }
          : item));
        continue;
      }

      this.tradingApi.getQuote(instrument.symbol).pipe(
        map(quote => this.withQuote(instrument, quote)),
        catchError(() => of(instrument)),
        switchMap(quotedInstrument => forkJoin({
          month: this.tradingApi.getHistory(instrument.symbol, '1M').pipe(catchError(() => of(null as HistoryResponseDto | null))),
          day: this.tradingApi.getHistory(instrument.symbol, '1D').pipe(catchError(() => of(null as HistoryResponseDto | null)))
        }).pipe(
          map(({ month, day }) => {
            const withChart = month ? this.withHistory(quotedInstrument, month) : quotedInstrument;
            return day ? this.withDailyChange(withChart, day) : withChart;
          }),
          catchError(() => of(quotedInstrument))
        ))
      ).subscribe(updated => {
        this.instruments.update(current => current.map(item => item.symbol === updated.symbol ? updated : item));
      });
    }
  }

  private withQuote(instrument: Instrument, quote: QuoteDto): Instrument {
    const price = this.numberValue(quote.lastPrice ?? quote.currentPrice ?? quote.midPrice ?? quote.ask ?? quote.bid);
    const rawChange = quote.priceChange ?? quote.dayChange;
    const rawChangePct = quote.priceChangePercent ?? quote.dayChangePercent;
    return {
      ...instrument,
      price,
      change: this.numberValue(rawChange),
      changePct: this.numberValue(rawChangePct),
      chartPlaceholder: false,
      priceState: price > 0 ? 'ready' : 'unavailable',
      changeReady: rawChange !== undefined && rawChangePct !== undefined
    };
  }

  private withHistory(instrument: Instrument, history: HistoryResponseDto): Instrument {
    const points = history.bars
      .map(bar => this.numberValue(bar.close))
      .filter(price => Number.isFinite(price) && price > 0);
    const latest = points[points.length - 1] ?? this.numberValue(history.summary?.endPrice);
    if (points.length < 2 && latest <= 0) return instrument;

    return {
      ...instrument,
      points: points.length > 1 ? points : instrument.points,
      price: instrument.price > 0 ? instrument.price : latest,
      chartPlaceholder: points.length < 2,
      priceState: instrument.price > 0 || latest > 0 ? 'ready' : instrument.priceState,
    };
  }

  private withDailyChange(instrument: Instrument, history: HistoryResponseDto): Instrument {
    const prices = history.bars
      .map(bar => this.numberValue(bar.close))
      .filter(price => price > 0);
    const startPrice = this.numberValue(history.summary?.startPrice ?? prices[0]);
    const endPrice = this.numberValue(history.summary?.endPrice ?? prices[prices.length - 1]);
    const change = history.summary?.change ?? (startPrice > 0 && endPrice > 0 ? endPrice - startPrice : undefined);
    const changePct = history.summary?.changePercent
      ?? (change !== undefined && startPrice > 0 ? (change / startPrice) * 100 : undefined);
    if (change === undefined || changePct === undefined) return instrument;
    return {
      ...instrument,
      change: this.numberValue(change),
      changePct: this.numberValue(changePct),
      changeReady: true
    };
  }

  private loadOrderChart(instrument: Instrument, range: ChartRange): void {
    this.chartLoading.set(true);
    this.tradingApi.getHistory(instrument.symbol, range).subscribe({
      next: history => {
        const points = history.bars
          .map(bar => this.numberValue(bar.close))
          .filter(price => price > 0);
        if (points.length > 1) this.chartPointsForOrder.set(points);
        this.chartLoading.set(false);
      },
      error: () => this.chartLoading.set(false)
    });
  }

  private watchOrder(orderId: string, accountId: string): void {
    interval(1500).pipe(
      switchMap(() => this.tradingApi.getOrder(orderId)),
      takeWhile(order => {
        this.orderStatus.set(this.normalizeOrderStatus(order.status));
        return !this.isTerminalOrderStatus(order.status);
      }, true),
      catchError(() => of(null)),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(order => {
      if (!order || !this.isTerminalOrderStatus(order.status)) return;
      this.orderStatus.set(this.normalizeOrderStatus(order.status));
      this.orderHistory.refresh(accountId);
    });
  }

  private normalizeOrderStatus(status: string | undefined): 'PENDING' | 'FILLED' | 'CANCELLED' | 'REJECTED' {
    const normalized = status?.toUpperCase();
    return normalized === 'FILLED' || normalized === 'CANCELLED' || normalized === 'REJECTED' ? normalized : 'PENDING';
  }

  private isTerminalOrderStatus(status: string | undefined): boolean {
    return ['FILLED', 'CANCELLED', 'REJECTED'].includes(status?.toUpperCase() ?? '');
  }

  private numberValue(value: number | string | null | undefined): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private isTicker(value: string): boolean {
    return /^[A-Z][A-Z0-9.\-]{0,9}$/.test(value);
  }

  private placeholderPoints(index: number): number[] {
    const patterns = [
      [42, 45, 43, 47, 46, 50, 48, 52],
      [48, 46, 49, 45, 47, 43, 45, 41],
      [42, 44, 43, 46, 45, 47, 46, 49],
      [49, 47, 48, 45, 46, 44, 43, 45]
    ];
    return patterns[index % patterns.length];
  }

  protected chartPoints(points: number[]): string {
    const max = Math.max(...points);
    const min = Math.min(...points);
    const range = max - min || 1;
    return points.map((point, index) => `${(index / (points.length - 1)) * 100},${42 - ((point - min) / range) * 34}`).join(' ');
  }
}
