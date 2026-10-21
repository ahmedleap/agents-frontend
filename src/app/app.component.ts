<<<<<<< Updated upstream
import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
=======
import { Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { catchError, filter, map, merge, of, startWith, switchMap } from 'rxjs';
import { environment } from '../environments/environment';
import { AccountApiService } from './core/services/account-api.service';
import { PortfolioApiService } from './core/services/portfolio-api.service';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';

const isAuthUrl = (url: string) => /^\/(login|signup)(\/|\?|#|$)/.test(url);
>>>>>>> Stashed changes

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, CommonModule],
  host: {
    class: 'app-root'
  }
})
export class AppComponent {
  protected readonly title = signal('S.T.A.S.H');
  protected readonly subtitle = signal('Stash Your Cash');
  protected readonly appInitialized = signal(false);
<<<<<<< Updated upstream

  constructor() {
    this.initializeApp();
=======
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);
  private readonly portfolioApi = inject(PortfolioApiService);
  // Sidebar account list, loaded from the client's portfolio on the backend; reloads when an account is added
  protected readonly accounts = toSignal(
    merge(
      inject(AccountApiService).changed$,
      this.router.events.pipe(filter((event): event is NavigationEnd => event instanceof NavigationEnd))
    ).pipe(
      startWith(undefined),
      switchMap(() => this.loadAccounts())
    ),
    { requireSync: true }
  );

  protected readonly accountsOpen = signal(false);
  protected readonly theme = inject(ThemeService);
  // Full-width pages with no sidebar (log in, sign up). Seeded from the URL so the
  // sidebar doesn't flash on a direct load before the first navigation finishes.
  protected readonly isAuthPage = signal(isAuthUrl(inject(Location).path()));

  constructor() {
    this.initializeApp();

    // Keep the account list open while an account page is showing
    const sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.isAuthPage.set(isAuthUrl(e.urlAfterRedirects));
        if (e.urlAfterRedirects.startsWith('/portfolio')) {
          this.accountsOpen.set(true);
        }
      });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  private loadAccounts() {
    const clientId = this.auth.getClientId();
    if (!clientId) {
      return of({ status: 'ready' as const, list: [] });
    }

    return this.portfolioApi.getEntirePortfolio(clientId).pipe(
      map(p => ({
        status: 'ready' as const,
        list: (p.accounts ?? []).map(a => ({
          id: a.accountId,
          name: a.accountName,
          value: a.totalPortfolioValue,
          gain: a.totalGainLossDollars,
          pct: a.totalGainLossPercent
        }))
      })),
      catchError(err => {
        console.error('Sidebar accounts request failed', err);
        return of({ status: 'error' as const, list: [] });
      }),
      startWith({ status: 'loading' as const, list: [] })
    );
  }

  protected toggleAccounts(): void {
    this.accountsOpen.update(open => !open);
  }

  protected openHistory(event: Event, accountId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/history', accountId]);
>>>>>>> Stashed changes
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
