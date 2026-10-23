import { Component, computed, inject, input } from '@angular/core';
import { WatchlistService } from '../../core/services/watchlist.service';

/** Star button on a Trades card: adds the instrument to the watchlist, or takes it off again */
@Component({
  selector: 'app-watch-button',
  standalone: true,
  template: `
    <button type="button" class="star" [class.on]="watched()" [disabled]="!instrumentId() || pending()"
            [attr.aria-pressed]="watched()" [attr.aria-label]="label()" [attr.data-tip]="label()" (click)="toggle()">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M12 3.2l2.7 5.5 6 .9-4.4 4.2 1 6-5.3-2.8-5.3 2.8 1-6-4.4-4.2 6-.9z"/>
      </svg>
    </button>
  `,
  styleUrl: './watch-button.component.scss'
})
export class WatchButtonComponent {
  private readonly watchlist = inject(WatchlistService);

  readonly instrumentId = input.required<string>();
  readonly ticker = input.required<string>();
  readonly name = input('');

  protected readonly watched = computed(() => this.watchlist.isWatched(this.instrumentId()));
  protected readonly pending = computed(() => this.watchlist.isPending(this.instrumentId()));
  protected readonly label = computed(() => this.watched()
    ? `Remove ${this.ticker()} from watchlist`
    : `Add ${this.ticker()} to watchlist`);

  protected toggle(): void {
    const request = this.watched()
      ? this.watchlist.remove(this.instrumentId())
      : this.watchlist.add(this.instrumentId(), this.ticker(), this.name());
    // Failures show in the page's watchlist message (WatchlistService.error)
    request.subscribe({ error: () => undefined });
  }
}
