import { CurrencyPipe, DecimalPipe } from '@angular/common';
import { Component, ElementRef, computed, effect, inject, signal, untracked, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router } from '@angular/router';
import { Observable, Subject, Subscription, catchError, concat, forkJoin, interval, map, mergeMap, of, switchMap, takeWhile } from 'rxjs';
import { DestroyRef } from '@angular/core';
import { AccountApiService } from '../../core/services/account-api.service';
import { AuthService } from '../../core/services/auth.service';
import { AccountSummary, DashboardService } from '../../core/services/dashboard.service';
import { OrderHistoryService } from '../../core/services/order-history.service';
import { PortfolioApiService } from '../../core/services/portfolio-api.service';
import { CreateOrderResponse, HistoryResponseDto, InstrumentSearchResult, QuoteDto, TradingApiService } from '../../core/services/trading-api.service';
import { ChartBar, ChartMode, PriceChartComponent } from '../price-chart/price-chart.component';
import { AssetFilter, AssetFilterComponent, matchesAssetFilter } from '../asset-filter/asset-filter.component';
import { WatchButtonComponent } from '../watch-button/watch-button.component';
import { PagerComponent } from '../pager/pager.component';
import { WatchlistService } from '../../core/services/watchlist.service';
import { MarketHoursService } from '../../core/services/market-hours.service';

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

/** How many cards load their market data at the same time; the rest wait their turn, top to bottom */
const CARD_LOAD_CONCURRENCY = 3;
/** Cards per page: three rows of four */
const PAGE_SIZE = 12;

@Component({
  selector: 'app-trades',
  standalone: true,
  imports: [CurrencyPipe, DecimalPipe, PriceChartComponent, AssetFilterComponent, WatchButtonComponent, PagerComponent],
  templateUrl: './trades.component.html',
  styleUrls: ['./trades.component.scss']
})
export class TradesComponent {
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  private readonly dashboard = inject(DashboardService);
  private readonly accounts = this.dashboard.accounts;
  private readonly accountApi = inject(AccountApiService);
  private readonly auth = inject(AuthService);
  private readonly tradingApi = inject(TradingApiService);
  private readonly portfolioApi = inject(PortfolioApiService);
  private readonly orderHistory = inject(OrderHistoryService);
  /** Star buttons on the cards; failures show as a message on this page */
  protected readonly watchlistError = inject(WatchlistService).error;
  /** US market open/closed, shared with the header badge */
  protected readonly market = inject(MarketHoursService);
  private readonly route = inject(ActivatedRoute);
  /**
   * Holdings on the account page link here with ?ticker=AAPL&side=sell: once the stock list and the account
   * are ready, that stock's order pop-up opens with Sell selected. Handled once, then taken off the URL.
   */
  private pendingOrderLink: { ticker: string; side: Side } | null = (() => {
    const params = this.route.snapshot.queryParamMap;
    const ticker = params.get('ticker')?.trim().toUpperCase();
    return ticker ? { ticker, side: params.get('side') === 'sell' ? 'sell' : 'buy' } : null;
  })();
  private readonly accountIdParam = toSignal(
    this.route.paramMap.pipe(map(params => params.get('accountId'))),
    { initialValue: this.route.snapshot.paramMap.get('accountId') }
  );
  private readonly routeAccountName = toSignal(
    this.route.queryParamMap.pipe(map(params => params.get('accountName'))),
    { initialValue: this.route.snapshot.queryParamMap.get('accountName') }
  );
  private readonly routeAccount = toSignal(
    this.route.paramMap.pipe(
      map(params => params.get('accountId')),
      switchMap(accountId => accountId
        ? forkJoin({
            summary: this.accountApi.getAccountSummary(accountId),
            portfolio: this.portfolioApi.getAccountPortfolio(this.auth.clientId() ?? '', accountId)
          }).pipe(
            map(({ summary, portfolio }): AccountSummary => ({
              id: accountId,
              name: portfolio.accountName,
              value: summary.totalValue,
              cashBalance: summary.cashBalance,
              availableBalance: summary.availableBalance,
              status: 'ACTIVE',
              dayPL: 0,
              dayPct: 0,
              history: [summary.totalValue]
            })),
            catchError(() => of(null))
          )
        : of(null)
      )
    ),
    { initialValue: null }
  );

  protected readonly selectableAccounts = computed(() => {
    const accounts = this.accounts();
    const routeAccount = this.routeAccount() ?? this.routeAccountFallback();
    if (!routeAccount || accounts.some(account => account.id === routeAccount.id)) return accounts;
    return [routeAccount, ...accounts];
  });

  private readonly routeAccountFallback = computed<AccountSummary | null>(() => {
    const id = this.accountIdParam();
    const name = this.routeAccountName();
    return id && name ? {
      id,
      name,
      value: 0,
      cashBalance: 0,
      availableBalance: 0,
      status: 'ACTIVE',
      dayPL: 0,
      dayPct: 0,
      history: [0]
    } : null;
  });

  private readonly baseAccount = computed(() => {
    const accounts = this.selectableAccounts();
    const routeAccountId = this.accountIdParam();
    return accounts.find(account => account.id === routeAccountId)
      ?? this.routeAccount()
      ?? this.routeAccountFallback()
      ?? (routeAccountId ? undefined : accounts[0]);
  });
  private readonly accountId = computed(() => this.baseAccount()?.id);

  /**
   * Latest balances from GET /api/accounts/{id}/summary. The dashboard's account list is loaded once at
   * login, so it goes stale after a trade; these are fetched when the account is opened and after every order.
   */
  private readonly latestBalances = signal<Record<string, { cashBalance: number; availableBalance: number }>>({});

  protected readonly account = computed(() => {
    const account = this.baseAccount();
    const latest = account ? this.latestBalances()[account.id] : undefined;
    return account && latest ? { ...account, ...latest } : account;
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
  protected readonly chartBarsForOrder = signal<ChartBar[]>([]);
  protected readonly chartLoading = signal(false);
  /** Line or candlesticks in the order pop-up; kept when switching instruments */
  protected readonly chartMode = signal<ChartMode>('line');
  /** The current instrument list or search request, and the card data being loaded for it */
  private listRequest?: Subscription;
  private cardRequests?: Subscription;
  /** Cards waiting for their market data, and the ones already asked for (per list) */
  private cardQueue = new Subject<Instrument>();
  private requestedCards = new Set<string>();

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

  /** Stocks / crypto / forex filter; works on the full list and on search results */
  protected readonly assetFilter = signal<AssetFilter>('ALL');
  protected readonly assetCounts = computed(() => {
    const instruments = this.instruments();
    const count = (filter: AssetFilter) => instruments.filter(item => matchesAssetFilter(item.type, filter)).length;
    return { ALL: instruments.length, STOCK: count('STOCK'), CRYPTO: count('CRYPTO'), FOREX: count('FOREX') };
  });
  protected readonly visibleInstruments = computed(() =>
    this.instruments().filter(instrument => matchesAssetFilter(instrument.type, this.assetFilter())));

  /** Pagination: only this page's cards are shown, and only they load market data */
  protected readonly pageSize = PAGE_SIZE;
  protected readonly page = signal(0);
  protected readonly pagedInstruments = computed(() => {
    const all = this.visibleInstruments();
    const lastPage = Math.max(0, Math.ceil(all.length / PAGE_SIZE) - 1);
    const page = Math.min(this.page(), lastPage);
    return all.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  });
  private readonly grid = viewChild<ElementRef<HTMLElement>>('grid');
  protected readonly assetFilterLabel = computed(() =>
    ({ ALL: 'instruments', STOCK: 'stocks', CRYPTO: 'crypto', FOREX: 'forex pairs' })[this.assetFilter()]);

  constructor() {
    this.loadInstruments();

    // Open the linked stock's order once the list has loaded and we know which account is trading
    effect(() => {
      const link = this.pendingOrderLink;
      if (!link || this.loading() || !this.account()) return;
      const instruments = this.instruments();
      untracked(() => this.openLinkedOrder(link, instruments));
    });

    // Load market data for the cards on the current page, top to bottom (each card once per list)
    effect(() => {
      for (const instrument of this.pagedInstruments()) {
        if (this.requestedCards.has(instrument.symbol)) continue;
        this.requestedCards.add(instrument.symbol);
        untracked(() => this.cardQueue.next(instrument));
      }
    });

    // A different filter shows a different list: back to page 1
    effect(() => {
      this.assetFilter();
      untracked(() => this.page.set(0));
    });

    // Fresh balance whenever a different account is shown
    effect(() => {
      const accountId = this.accountId();
      if (accountId) untracked(() => this.refreshBalance(accountId));
    });
  }

  /** Re-reads the account's cash from the backend and shares it with the dashboard */
  private refreshBalance(accountId: string): void {
    this.accountApi.getAccountSummary(accountId).pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: summary => {
        const balances = { cashBalance: summary.cashBalance, availableBalance: summary.availableBalance };
        this.latestBalances.update(all => ({ ...all, [accountId]: balances }));
        this.dashboard.updateBalances(accountId, balances.cashBalance, balances.availableBalance);
      },
      // Keep showing the last known balance
      error: () => undefined
    });
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
    // The card's 1M closes until the full bars arrive
    this.chartBarsForOrder.set(instrument.points.map(close => ({ close })));
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
    this.listRequest?.unsubscribe();
    this.listRequest = this.tradingApi.searchInstruments(query).subscribe({
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

  /** Pager click: show that page and bring the top of the cards into view */
  protected goToPage(page: number): void {
    this.page.set(page);
    this.grid()?.nativeElement.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  protected switchAccount(event: Event): void {
    const accountId = (event.target as HTMLSelectElement).value;
    if (accountId) this.router.navigate(['/trades', accountId]);
  }

  private openLinkedOrder(link: { ticker: string; side: Side }, instruments: Instrument[]): void {
    this.pendingOrderLink = null;
    // Take ticker/side off the address so a reload doesn't open the order again
    void this.router.navigate([], {
      relativeTo: this.route, queryParams: { ticker: null, side: null }, queryParamsHandling: 'merge', replaceUrl: true
    });

    const open = (instrument: Instrument) => {
      this.openOrder(instrument);
      this.setSide(link.side);
    };
    const listed = instruments.find(item => item.symbol.toUpperCase() === link.ticker);
    if (listed) {
      open(listed);
      return;
    }
    // Not in the list (e.g. the list failed to load): look the ticker up directly
    this.tradingApi.searchInstruments(link.ticker).subscribe({
      next: response => {
        const match = (response.results ?? []).find(result => result.ticker.toUpperCase() === link.ticker);
        if (match) open(this.toInstrument(match, 0));
        else this.error.set(`${link.ticker} couldn't be found to trade.`);
      },
      error: () => this.error.set(`${link.ticker} couldn't be loaded to trade. Search for it below.`)
    });
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
    const input = event.target as HTMLInputElement;
    const selectionStart = input.selectionStart;
    const selectionEnd = input.selectionEnd;
    const value = Number(input.value);
    this.limitPrice.set(Number.isFinite(value) ? Math.max(0, value) : 0);
    this.confirmed.set(false);

    // The bound value is refreshed when the signal changes; restore the caret after that refresh.
    requestAnimationFrame(() => {
      if (document.activeElement === input && selectionStart !== null && selectionEnd !== null) {
        input.setSelectionRange(selectionStart, selectionEnd);
      }
    });
  }

  /** Selling: fill in every share owned */
  protected sellAll(): void {
    const owned = this.availableToSell();
    if (!owned) return;
    this.quantity.set(owned);
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
        // The order changes the cash (or holds it while pending)
        this.refreshBalance(accountId);
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
    this.listRequest?.unsubscribe();
    this.listRequest = this.tradingApi.listInstruments().subscribe({
      next: response => this.hydrateInstruments(response.results ?? []),
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

    this.portfolioApi.getAccountPortfolio(this.auth.clientId() ?? '', accountId).subscribe({
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
    // A new list replaces the old one: stop loading the old cards
    this.cardRequests?.unsubscribe();
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

    // Cards are filled in a few at a time, as their page is shown (see the constructor), so the
    // visible cards are ready quickly and cards on other pages don't load until they're needed
    this.cardQueue = new Subject<Instrument>();
    this.requestedCards = new Set<string>();
    this.cardRequests = this.cardQueue.pipe(
      mergeMap(instrument => this.isTicker(instrument.symbol)
        ? this.loadCard(instrument)
        : of({ ...instrument, priceState: 'unavailable' as const }), CARD_LOAD_CONCURRENCY),
      takeUntilDestroyed(this.destroyRef)
    ).subscribe(updated => {
      this.instruments.update(current => current.map(item => item.symbol === updated.symbol ? updated : item));
    });

    this.page.set(0);
    this.instruments.set(instruments);
    this.loading.set(false);
  }

  /** One card's data: emits once with the name and price, then again with the 1M chart and 1D change */
  private loadCard(instrument: Instrument): Observable<Instrument> {
    return forkJoin({
      details: this.tradingApi.getInstrumentDetails(instrument.symbol).pipe(catchError(() => of(null))),
      quote: this.tradingApi.getQuote(instrument.symbol).pipe(catchError(() => of(null)))
    }).pipe(
      map(({ details, quote }) => {
        const named = details?.name && details.name !== details.ticker
          ? { ...instrument, name: details.name, type: details.assetClass }
          : instrument;
        return quote ? this.withQuote(named, quote) : named;
      }),
      switchMap(quoted => concat(
        of(quoted),
        forkJoin({
          month: this.tradingApi.getHistory(quoted.symbol, '1M').pipe(catchError(() => of(null as HistoryResponseDto | null))),
          day: this.tradingApi.getHistory(quoted.symbol, '1D').pipe(catchError(() => of(null as HistoryResponseDto | null)))
        }).pipe(map(({ month, day }) => {
          const withChart = month ? this.withHistory(quoted, month) : quoted;
          const done = day ? this.withDailyChange(withChart, day) : withChart;
          // Nothing came back with a price: stop showing "Loading price..."
          return done.priceState === 'loading' ? { ...done, priceState: 'unavailable' as const } : done;
        }))
      ))
    );
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
      .map(bar => ({ price: this.numberValue(bar.close), timestamp: bar.timestamp }))
      .filter(point => Number.isFinite(point.price) && point.price > 0);
    const prices = points.map(point => point.price);
    const latest = prices[prices.length - 1] ?? this.numberValue(history.summary?.endPrice);
    if (points.length < 2 && latest <= 0) return instrument;

    return {
      ...instrument,
      points: prices.length > 1 ? prices : instrument.points,
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
        // Ignore an answer for an instrument or range the user has already moved away from
        if (this.selected()?.symbol !== instrument.symbol || this.chartRange() !== range) return;
        // Full bars (open/high/low/close) so the chart can also draw candlesticks
        const bars = history.bars
          .map(bar => ({
            timestamp: bar.timestamp,
            open: this.numberValue(bar.open),
            high: this.numberValue(bar.high),
            low: this.numberValue(bar.low),
            close: this.numberValue(bar.close),
            volume: this.numberValue(bar.volume)
          }))
          .filter(bar => bar.close > 0);
        if (bars.length > 1) this.chartBarsForOrder.set(bars);
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
      // Filled, cancelled or rejected: the cash has settled
      this.refreshBalance(accountId);
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
    // Stocks (AAPL, BRK.B), crypto (BTC, BTC-USD) and forex (EUR/USD, EURUSD=X)
    return /^[A-Z][A-Z0-9.\-\/=]{0,11}$/.test(value);
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
