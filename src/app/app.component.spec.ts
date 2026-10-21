
import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from '@angular/router';
import { CommonModule, Location } from '@angular/common';
import { filter } from 'rxjs';

import { ThemeService } from './core/services/theme.service';

const isAuthUrl = (url: string) =>
  /^\/(login|signup)(\/|\?|#|$)/.test(url);

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss'],
  standalone: true,
  imports: [
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    CommonModule
  ],
  host: {
    class: 'app-root'
  }
})
export class AppComponent {
  protected readonly title = signal('S.T.A.S.H.');
  protected readonly subtitle = signal('Stash Your Cash');
  protected readonly appInitialized = signal(false);

  // Keep the sidebar structure without making an
  // unauthenticated portfolio request on startup.
  protected readonly accounts = signal({
    status: 'ready' as const,
    list: [] as Array<{
      id: string;
      name: string;
      value: number;
      gain: number;
      pct: number;
    }>
  });

  protected readonly accountsOpen = signal(false);
  protected readonly theme = inject(ThemeService);

  protected readonly isAuthPage = signal(
    isAuthUrl(inject(Location).path())
  );

  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  constructor() {
    this.initializeApp();

    const sub = this.router.events
      .pipe(
        filter(
          (e): e is NavigationEnd =>
            e instanceof NavigationEnd
        )
      )
      .subscribe(e => {
        this.isAuthPage.set(
          isAuthUrl(e.urlAfterRedirects)
        );

        if (
          e.urlAfterRedirects.startsWith('/portfolio')
        ) {
          this.accountsOpen.set(true);
        }
      });

    this.destroyRef.onDestroy(() => {
      sub.unsubscribe();
    });
  }

  protected toggleAccounts(): void {
    this.accountsOpen.update(open => !open);
  }

  private initializeApp(): void {
    console.log('App initialized:', this.title());
    this.appInitialized.set(true);
  }
}
