import { Component, DestroyRef, ElementRef, computed, effect, inject, signal, viewChild } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

/** The pop-up opens when this many seconds are left */
const WARNING_SECONDS = 60;
/** Log out after this long with no mouse, keyboard, scroll or touch activity */
const IDLE_LIMIT_MS = 60_000;
/** What counts as activity on the screen */
const ACTIVITY_EVENTS = ['mousemove', 'mousedown', 'keydown', 'wheel', 'scroll', 'touchstart'] as const;

/**
 * Header countdown to when the access token expires. With a minute left it asks the user to
 * refresh their session (POST /auth/refresh); if they don't, it logs them out (POST /auth/logout) at zero.
 * It also logs them out after a minute with no activity on the screen.
 */
@Component({
  selector: 'app-session-timer',
  standalone: true,
  templateUrl: './session-timer.component.html',
  styleUrl: './session-timer.component.scss'
})
export class SessionTimerComponent {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  private readonly now = signal(Date.now());
  protected readonly refreshing = signal(false);
  protected readonly refreshFailed = signal(false);
  private loggingOut = false;
  private lastActivity = Date.now();

  /** Whole seconds until the access token expires; null when logged out */
  protected readonly secondsLeft = computed(() => {
    const expiresAt = this.auth.accessTokenExpiresAt();
    return expiresAt === null ? null : Math.max(0, Math.ceil((expiresAt - this.now()) / 1000));
  });
  protected readonly time = computed(() => formatTime(this.secondsLeft() ?? 0));
  protected readonly warning = computed(() => {
    const left = this.secondsLeft();
    return left !== null && left <= WARNING_SECONDS;
  });

  private readonly stayButton = viewChild<ElementRef<HTMLButtonElement>>('stayButton');

  constructor() {
    const tick = setInterval(() => {
      this.now.set(Date.now());
      // No activity for a minute: end the session
      if (Date.now() - this.lastActivity >= IDLE_LIMIT_MS) this.logOut();
    }, 1000);

    // Any mouse, keyboard, scroll or touch activity restarts the idle minute
    // (capture phase, so scrolling inside a panel counts too)
    const onActivity = () => this.lastActivity = Date.now();
    for (const name of ACTIVITY_EVENTS) document.addEventListener(name, onActivity, { capture: true, passive: true });

    inject(DestroyRef).onDestroy(() => {
      clearInterval(tick);
      for (const name of ACTIVITY_EVENTS) document.removeEventListener(name, onActivity, { capture: true });
    });

    // Time's up: end the session
    effect(() => {
      if (this.secondsLeft() === 0) this.logOut();
    });

    // Put keyboard focus on "Stay logged in" when the pop-up opens
    effect(() => this.stayButton()?.nativeElement.focus());
  }

  protected stayLoggedIn(): void {
    if (this.refreshing()) return;
    this.refreshing.set(true);
    this.refreshFailed.set(false);
    // A new access token resets the countdown, which closes the pop-up
    this.auth.refreshAccessToken().subscribe({
      next: () => this.refreshing.set(false),
      error: () => {
        // AuthService has already cleared the session when a refresh fails
        this.refreshing.set(false);
        this.refreshFailed.set(true);
        void this.router.navigate(['/login']);
      }
    });
  }

  protected logOut(): void {
    if (this.loggingOut) return;
    this.loggingOut = true;
    this.auth.logoutRemote().subscribe({ error: () => this.auth.logout() });
    void this.router.navigate(['/login']);
  }
}

function formatTime(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}
