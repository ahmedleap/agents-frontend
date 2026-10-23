import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of } from 'rxjs';
import { InstrumentSearchResult, NewsItemDto, TradingApiService } from '../../core/services/trading-api.service';

const POPULAR_TICKERS = ['AAPL', 'MSFT', 'NVDA', 'AMZN', 'GOOGL', 'META', 'TSLA', 'AMD', 'SPY', 'NFLX'];

@Component({
  selector: 'app-news',
  standalone: true,
  imports: [DatePipe, DecimalPipe],
  templateUrl: './news.component.html',
  styleUrls: ['./news.component.scss']
})
export class NewsComponent {
  private readonly tradingApi = inject(TradingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly instruments = signal<InstrumentSearchResult[]>([]);
  protected readonly ticker = signal('');
  protected readonly sort = signal<'latest' | 'popular'>('latest');
  protected readonly articles = signal<NewsItemDto[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  constructor() {
    this.tradingApi.listInstruments().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: response => {
        const instruments = response.results ?? [];
        this.instruments.set(instruments);
        const firstTicker = 'ALL';
        if (firstTicker) {
          this.ticker.set(firstTicker);
          this.loadNews(firstTicker);
        }
      },
      error: () => this.error.set('Instrument list is unavailable.')
    });
  }

  protected selectTicker(event: Event): void {
    const ticker = (event.target as HTMLSelectElement).value;
    this.ticker.set(ticker);
    this.loadNews(ticker);
  }

  protected selectSort(event: Event): void {
    this.sort.set((event.target as HTMLSelectElement).value as 'latest' | 'popular');
    this.loadNews(this.ticker());
  }

  protected loadNews(ticker: string): void {
    if (!ticker) return;
    this.loading.set(true);
    this.error.set(null);
    const request = ticker === 'ALL'
      ? forkJoin(POPULAR_TICKERS.map(symbol => this.tradingApi.getNews(symbol, 5, this.sort()).pipe(catchError(() => of([])))))
          .pipe(map(groups => [...new Map(groups.flat().map(article => [article.guid || article.link, article])).values()]
            .sort((left, right) => Date.parse(right.publishedAt) - Date.parse(left.publishedAt))
            .slice(0, 30)))
      : this.tradingApi.getNews(ticker, 10, this.sort());

    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: articles => {
        this.articles.set(articles);
        this.loading.set(false);
      },
      error: () => {
        this.articles.set([]);
        this.loading.set(false);
        this.error.set('News is temporarily unavailable.');
      }
    });
  }
}
