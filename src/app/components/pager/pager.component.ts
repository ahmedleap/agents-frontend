import { Component, booleanAttribute, computed, input, model } from '@angular/core';

/**
 * Page number buttons with Previous / Next and a "Showing 1–12 of 40" line. `page` is zero-based.
 * `compact` is for narrow cards: just ‹ 1 of 3 › (page 1 of 3 pages).
 */
@Component({
  selector: 'app-pager',
  standalone: true,
  template: `
    @if (pageCount() > 1 && compact()) {
      <nav class="pager compact" [attr.aria-label]="label()">
        <button type="button" class="step" [disabled]="page() === 0" (click)="go(page() - 1)" aria-label="Previous page">&#8249;</button>
        <span class="range" [attr.aria-label]="'Page ' + (page() + 1) + ' of ' + pageCount()">{{ page() + 1 }} of {{ pageCount() }}</span>
        <button type="button" class="step" [disabled]="page() >= pageCount() - 1" (click)="go(page() + 1)" aria-label="Next page">&#8250;</button>
      </nav>
    } @else if (pageCount() > 1) {
      <nav class="pager" [attr.aria-label]="label()">
        <span class="range">Showing {{ first() }}–{{ last() }} of {{ total() }}</span>
        <div class="buttons">
          <button type="button" class="step" [disabled]="page() === 0" (click)="go(page() - 1)" aria-label="Previous page">
            <span aria-hidden="true">&#8249;</span> Prev
          </button>
          @for (p of pages(); track $index) {
            @if (p === null) {
              <span class="gap" aria-hidden="true">&hellip;</span>
            } @else {
              <button type="button" class="num" [class.active]="p === page()" [attr.aria-current]="p === page() ? 'page' : null"
                      [attr.aria-label]="'Page ' + (p + 1)" (click)="go(p)">{{ p + 1 }}</button>
            }
          }
          <button type="button" class="step" [disabled]="page() >= pageCount() - 1" (click)="go(page() + 1)" aria-label="Next page">
            Next <span aria-hidden="true">&#8250;</span>
          </button>
        </div>
      </nav>
    }
  `,
  styleUrl: './pager.component.scss'
})
export class PagerComponent {
  readonly page = model(0);
  readonly total = input.required<number>();
  readonly pageSize = input(12);
  readonly label = input('Pages');
  readonly compact = input(false, { transform: booleanAttribute });

  protected readonly pageCount = computed(() => Math.max(1, Math.ceil(this.total() / this.pageSize())));
  protected readonly first = computed(() => this.total() ? this.page() * this.pageSize() + 1 : 0);
  protected readonly last = computed(() => Math.min(this.total(), (this.page() + 1) * this.pageSize()));

  /** First, last, and the pages around the current one; null marks a gap ("…") */
  protected readonly pages = computed<(number | null)[]>(() => {
    const count = this.pageCount();
    const current = this.page();
    const shown = new Set([0, count - 1, current - 1, current, current + 1].filter(p => p >= 0 && p < count));
    const sorted = [...shown].sort((a, b) => a - b);
    const result: (number | null)[] = [];
    sorted.forEach((p, i) => {
      if (i > 0 && p - sorted[i - 1] > 1) result.push(null);
      result.push(p);
    });
    return result;
  });

  protected go(page: number): void {
    this.page.set(Math.min(Math.max(page, 0), this.pageCount() - 1));
  }
}
