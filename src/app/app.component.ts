import { Component, DestroyRef, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { catchError, filter, map, of, startWith } from 'rxjs';
import { environment } from '../environments/environment';
import { PortfolioApiService } from './core/services/portfolio-api.service';
import { ThemeService } from './core/services/theme.service';
import { AuthService } from './core/services/auth.service';

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
  protected readonly title = signal('S.T.A.S.H.');
  protected readonly subtitle = signal('Stash Your Cash');
  protected readonly appInitialized = signal(false);
  // Sidebar account list, loaded from the client's portfolio on the backend
  protected readonly accounts = toSignal(
    inject(PortfolioApiService).getEntirePortfolio(environment.devClientId).pipe(
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
    ),
    { requireSync: true }
  );
  protected readonly accountsOpen = signal(false);
  protected readonly theme = inject(ThemeService);
  // Full-width pages with no sidebar (sign up, later log in)
  protected readonly isAuthPage = signal(false);
  protected readonly isAnalyst = inject(AuthService).isAnalyst;

  private readonly router = inject(Router);

  constructor() {
    this.initializeApp();

    // Keep the account list open while an account page is showing
    const sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        this.isAuthPage.set(e.urlAfterRedirects.startsWith('/signup'));
        if (e.urlAfterRedirects.startsWith('/portfolio')) {
          this.accountsOpen.set(true);
        }
      });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected toggleAccounts(): void {
    this.accountsOpen.update(open => !open);
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
