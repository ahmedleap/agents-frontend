import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { catchError, from, map, mergeMap, of, toArray } from 'rxjs';
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
        this.ticker.set('ALL');
        this.loadNews('ALL');
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
      ? this.loadPopularNews()
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

  private loadPopularNews() {
    const availableTickers = this.instruments().map(instrument => instrument.ticker).filter(Boolean);
    const symbols = [...new Set([...POPULAR_TICKERS, ...availableTickers])].slice(0, 15);

    return from(symbols).pipe(
      mergeMap(symbol => this.tradingApi.getNews(symbol, 5, this.sort()).pipe(
        map(articles => ({ articles, failed: false })),
        catchError(() => of({ articles: [] as NewsItemDto[], failed: true }))
      ), 3),
      toArray(),
      map(results => {
        if (results.length && results.every(result => result.failed)) {
          throw new Error('News service unavailable');
        }
        const articles = [...new Map(results.flatMap(result => result.articles)
          .map(article => [article.guid || article.link, article])).values()];
        return articles.sort((left, right) => this.sort() === 'popular'
          ? (right.relevanceScore ?? 0) - (left.relevanceScore ?? 0)
            || this.publishedTime(right.publishedAt) - this.publishedTime(left.publishedAt)
          : this.publishedTime(right.publishedAt) - this.publishedTime(left.publishedAt)
        ).slice(0, 30);
      })
    );
  }

  private publishedTime(value: string): number {
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }
}
