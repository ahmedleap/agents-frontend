import { Component, DestroyRef, inject, signal } from '@angular/core';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { filter } from 'rxjs';
import { DashboardService } from './core/services/dashboard.service';
import { ThemeService } from './core/services/theme.service';

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
  protected readonly accounts = inject(DashboardService).accounts;
  protected readonly accountsOpen = signal(false);
  protected readonly theme = inject(ThemeService);

  private readonly router = inject(Router);

  constructor() {
    this.initializeApp();

    // Keep the account list open while an account page is showing
    const sub = this.router.events
      .pipe(filter((e): e is NavigationEnd => e instanceof NavigationEnd))
      .subscribe(e => {
        if (e.urlAfterRedirects.startsWith('/portfolio')) {
          this.accountsOpen.set(true);
        }
      });
    inject(DestroyRef).onDestroy(() => sub.unsubscribe());
  }

  protected toggleAccounts(): void {
    this.accountsOpen.update(open => !open);
  }

  protected openHistory(event: Event, accountId: string): void {
    event.preventDefault();
    event.stopPropagation();
    this.router.navigate(['/history', accountId]);
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
