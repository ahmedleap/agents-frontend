import { DestroyRef, Injectable, computed, inject, signal } from '@angular/core';
import { marketStatus } from '../market-hours';

/** US stock market open/closed for the header badge and the Trades page (rules in core/market-hours.ts) */
@Injectable({ providedIn: 'root' })
export class MarketHoursService {
  private readonly now = signal(new Date());
  readonly status = computed(() => marketStatus(this.now()));
  readonly isOpen = computed(() => this.status().open);

  constructor() {
    // Re-check every 30 seconds so the badge flips at the open and close
    const tick = setInterval(() => this.now.set(new Date()), 30_000);
    inject(DestroyRef).onDestroy(() => clearInterval(tick));
  }
}
