import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { toObservable, toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { catchError, filter, map, of, startWith, switchMap } from 'rxjs';
import { PortfolioApiService } from './core/services/portfolio-api.service';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

const isAuthUrl = (url: string) => /^\/(login|signup)(\/|\?|#|$)/.test(url);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [RouterOutlet, RouterLink, RouterLinkActive, CommonModule],
  host: {
    class: 'app-root'
  }
})
export class AppComponent {
  private readonly auth = inject(AuthService);
  private readonly portfolioApi = inject(PortfolioApiService);
  protected readonly title = signal('S.T.A.S.H.');
  protected readonly subtitle = signal('Stash Your Cash');
  protected readonly appInitialized = signal(false);
  // Sidebar account list, loaded from the client's portfolio on the backend
  protected readonly accounts = toSignal(
    toObservable(this.auth.clientId).pipe(
      switchMap(clientId => {
        if (!clientId || this.auth.currentUser()?.role !== 'CLIENT') {
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
      })
    ),
    { initialValue: { status: 'ready', list: [] } as const }
  );
  protected readonly accountsOpen = signal(false);
  protected readonly role = computed(() => this.auth.currentUser()?.role ?? null);
  protected readonly homeRoute = computed(() => this.role() === 'CLIENT' ? '/client'
    : this.role() === 'ADMIN' ? '/admin' : '/dashboard');
  protected readonly theme = inject(ThemeService);
  // Full-width pages with no sidebar (log in, sign up). Seeded from the URL so the
  // sidebar doesn't flash on a direct load before the first navigation finishes.
  protected readonly isAuthPage = signal(isAuthUrl(inject(Location).path()));

  private readonly router = inject(Router);

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

  protected toggleAccounts(): void {
    this.accountsOpen.update(open => !open);
  }

  protected signOut(): void {
    this.auth.logoutRemote().subscribe({ error: () => this.auth.logout() });
    void this.router.navigate(['/login']);
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
