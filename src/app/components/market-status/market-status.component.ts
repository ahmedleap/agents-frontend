import { Component, inject } from '@angular/core';
import { MarketHoursService } from '../../core/services/market-hours.service';

/** Header badge: "Market open" (green) or "Market closed" (red); hovering says when it closes or next opens */
@Component({
  selector: 'app-market-status',
  standalone: true,
  template: `
    <div class="market" [class.closed]="!market.isOpen()" role="status"
         [attr.aria-label]="(market.isOpen() ? 'Market open. ' : 'Market closed. ') + market.status().detail"
         [attr.data-tip]="'US stock market · ' + market.status().detail">
      <span class="dot" aria-hidden="true"></span>
      <span class="label">{{ market.isOpen() ? 'Market open' : 'Market closed' }}</span>
    </div>
  `,
  styles: `
    :host { display: contents; }

    // Same height, border and corners as the header buttons beside it
    .market {
      position: relative;
      flex: none;
      display: flex;
      align-items: center;
      gap: 0.5rem;
      height: 3rem;
      padding: 0 0.9rem;
      border: 1px solid var(--pf-border);
      border-radius: 8px;
      background: var(--pf-inset);
      color: var(--pf-gain);
      font-size: 0.9rem;
      font-weight: 700;
      white-space: nowrap;

      &.closed { color: var(--pf-loss); }

      // Hover label, like the other header buttons
      &::after {
        content: attr(data-tip);
        position: absolute;
        top: calc(100% + 0.45rem);
        right: 0;
        z-index: 20;
        padding: 0.3rem 0.6rem;
        border-radius: 4px;
        background: var(--pf-text);
        color: var(--pf-card);
        font-size: 0.8rem;
        font-weight: 600;
        pointer-events: none;
        opacity: 0;
        transition: opacity 0.15s;
      }
      &:hover::after { opacity: 1; }
    }

    .dot {
      width: 0.6rem;
      height: 0.6rem;
      border-radius: 50%;
      background: currentColor;
      box-shadow: 0 0 0 3px var(--pf-buy-bg);
    }
    .closed .dot { box-shadow: 0 0 0 3px var(--pf-sell-bg); }

    // A soft pulse while the market is open
    .market:not(.closed) .dot { animation: live 2s ease-in-out infinite; }
    @keyframes live { 50% { box-shadow: 0 0 0 5px transparent; } }

    @media (prefers-reduced-motion: reduce) {
      .dot { animation: none !important; }
    }
  `
})
export class MarketStatusComponent {
  protected readonly market = inject(MarketHoursService);
}
