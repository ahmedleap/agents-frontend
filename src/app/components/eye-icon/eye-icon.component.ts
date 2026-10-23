import { Component, input } from '@angular/core';

/**
 * Eye for show/hide buttons on password-style boxes: open while the text is hidden,
 * closed (lid down, lashes) once it's showing. It blinks when it changes, and hovering
 * (or tabbing to) its button shows a "Show" / "Hide" label.
 */
@Component({
  selector: 'app-eye-icon',
  standalone: true,
  template: `
    @if (closed()) {
      <svg class="closed" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2.5 10c2.3 3.7 5.6 5.6 9.5 5.6s7.2-1.9 9.5-5.6"/>
        <path d="M12 15.6v2.9M7.3 14.6l-1.4 2.4M16.7 14.6l1.4 2.4M3.9 12.4l-2 1.7M20.1 12.4l2 1.7"/>
      </svg>
    } @else {
      <svg class="open" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M2.5 13c2.2-4.3 5.6-6.5 9.5-6.5s7.3 2.2 9.5 6.5c-2.2 4.3-5.6 6.5-9.5 6.5S4.7 17.3 2.5 13z"/>
        <!-- Lashes along the upper lid -->
        <path d="M12 6.5V3.8M7.7 7.6L6.4 5.3M16.3 7.6l1.3-2.3M4.6 9.6L2.8 8M19.4 9.6l1.8-1.6"/>
        <circle cx="12" cy="13" r="3.4"/>
        <circle class="pupil" cx="12" cy="13" r="1.5"/>
        <circle class="shine" cx="13.3" cy="11.7" r="0.6"/>
      </svg>
    }
    <!-- Hover label: what clicking will do (the button's aria-label says the same for screen readers) -->
    <span class="tip" aria-hidden="true">{{ closed() ? 'Hide' : 'Show' }}</span>
  `,
  styles: `
    :host { display: grid; place-items: center; }

    svg {
      width: 1.35rem;
      height: 1.35rem;
      fill: none;
      stroke: currentColor;
      stroke-width: 1.8;
      stroke-linecap: round;
      stroke-linejoin: round;
      animation: blink 0.18s ease-out;
    }

    .pupil { fill: currentColor; stroke: none; }
    .shine { fill: var(--pf-card, #fff); stroke: none; }

    // Squeeze shut and back open as the icon swaps
    @keyframes blink {
      from { transform: scaleY(0.2); opacity: 0.4; }
      to { transform: scaleY(1); opacity: 1; }
    }

    // Below the button, shown while the button is hovered or keyboard-focused
    .tip {
      position: absolute;
      top: calc(100% + 0.35rem);
      right: 0;
      z-index: 5;
      padding: 0.25rem 0.55rem;
      border-radius: 4px;
      background: var(--pf-text);
      color: var(--pf-card);
      font-size: 0.75rem;
      font-weight: 600;
      line-height: 1.2;
      white-space: nowrap;
      pointer-events: none;
      opacity: 0;
      transform: translateY(-0.2rem);
      transition: opacity 0.15s, transform 0.15s;
    }
    :host-context(button:hover) .tip,
    :host-context(button:focus-visible) .tip {
      opacity: 1;
      transform: none;
    }

    @media (prefers-reduced-motion: reduce) {
      svg { animation: none; }
      .tip { transition: none; }
    }
  `
})
export class EyeIconComponent {
  /** true once the text is showing (the click "closed" the eye) */
  readonly closed = input(false);
}
