import { Injectable, computed, effect, inject, signal } from '@angular/core';
import { Observable, catchError, map, of, tap, throwError } from 'rxjs';
import { ApiService } from './api.service';
import { AuthService } from './auth.service';

// Mirrors com.agentsbackend.DTO.response.WatchlistResponse
export interface WatchlistEntry {
  watchlistId: string;
  clientId: string;
  instrumentId: string;
  ticker: string;
  instrumentName: string;
  addedAt: string;
}

/**
 * The logged-in client's watchlist (WatchlistController: /api/watchlists).
 * Shared by the Trades page (star buttons) and the dashboard (edit/remove), so both stay in step.
 */
@Injectable({ providedIn: 'root' })
export class WatchlistService {
  private readonly api = inject(ApiService);
  private readonly auth = inject(AuthService);

  private readonly entriesState = signal<WatchlistEntry[]>([]);
  readonly entries = this.entriesState.asReadonly();
  readonly loaded = signal(false);
  readonly error = signal<string | null>(null);
  /** instrumentIds with an add or remove in progress */
  readonly pending = signal<ReadonlySet<string>>(new Set());

  private readonly watchedIds = computed(() => new Set(this.entriesState().map(entry => entry.instrumentId)));

  constructor() {
    // Load for whoever logs in; clear on logout
    effect(() => {
      const clientId = this.auth.clientId();
      const isClient = this.auth.currentUser()?.role === 'CLIENT';
      this.entriesState.set([]);
      this.loaded.set(false);
      if (clientId && isClient) this.load(clientId);
    });
  }

  isWatched(instrumentId: string): boolean {
    return this.watchedIds().has(instrumentId);
  }

  isPending(instrumentId: string): boolean {
    return this.pending().has(instrumentId);
  }

  /** GET /api/watchlists/{clientId} */
  reload(): void {
    const clientId = this.auth.clientId();
    if (clientId) this.load(clientId);
  }

  /** POST /api/watchlists; adding something already on the list is harmless (the backend ignores duplicates) */
  add(instrumentId: string, ticker: string, instrumentName: string): Observable<void> {
    const clientId = this.auth.clientId();
    if (!clientId) return throwError(() => new Error('Not logged in'));
    this.setPending(instrumentId, true);
    this.error.set(null);
    return this.api.post<WatchlistEntry>('watchlists', { clientId, instrumentId }).pipe(
      tap(entry => this.entriesState.update(entries => entries.some(e => e.instrumentId === instrumentId)
        ? entries
        // Newest first, like the backend's order
        : [{ ...entry, ticker: entry.ticker ?? ticker, instrumentName: entry.instrumentName ?? instrumentName }, ...entries])),
      map(() => undefined),
      catchError(error => {
        this.error.set(`${ticker} couldn't be added to your watchlist. Please try again.`);
        return throwError(() => error);
      }),
      tap({ finalize: () => this.setPending(instrumentId, false) })
    );
  }

  /** DELETE /api/watchlists/{clientId}/{instrumentId} */
  remove(instrumentId: string): Observable<void> {
    const clientId = this.auth.clientId();
    if (!clientId) return throwError(() => new Error('Not logged in'));
    const entry = this.entriesState().find(e => e.instrumentId === instrumentId);
    this.setPending(instrumentId, true);
    this.error.set(null);
    return this.api.delete<void>(`watchlists/${clientId}/${instrumentId}`).pipe(
      // 404 means it was already gone, which is what we wanted
      catchError(error => error?.status === 404 ? of(undefined) : throwError(() => error)),
      tap(() => this.entriesState.update(entries => entries.filter(e => e.instrumentId !== instrumentId))),
      map(() => undefined),
      catchError(error => {
        this.error.set(`${entry?.ticker ?? 'That instrument'} couldn't be removed from your watchlist. Please try again.`);
        return throwError(() => error);
      }),
      tap({ finalize: () => this.setPending(instrumentId, false) })
    );
  }

  private load(clientId: string): void {
    this.api.get<WatchlistEntry[]>(`watchlists/${clientId}`).subscribe({
      next: entries => {
        this.entriesState.set(entries ?? []);
        this.loaded.set(true);
      },
      error: () => {
        this.loaded.set(true);
        this.error.set('Your watchlist could not be loaded.');
      }
    });
  }

  private setPending(instrumentId: string, on: boolean): void {
    this.pending.update(current => {
      const next = new Set(current);
      if (on) next.add(instrumentId); else next.delete(instrumentId);
      return next;
    });
  }
}
