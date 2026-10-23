import { Component, input, model } from '@angular/core';

export type AssetFilter = 'ALL' | 'STOCK' | 'CRYPTO' | 'FOREX';

/** Which backend asset classes (AssetClass enum) each filter shows; All shows everything, including ETFs and funds */
const ASSET_CLASSES: Record<Exclude<AssetFilter, 'ALL'>, string[]> = {
  STOCK: ['STOCK', 'EQUITY'],
  CRYPTO: ['CRYPTO'],
  FOREX: ['FOREX']
};

export function matchesAssetFilter(assetClass: string | undefined, filter: AssetFilter): boolean {
  return filter === 'ALL' || ASSET_CLASSES[filter].includes((assetClass ?? '').toUpperCase());
}

/** All / Stocks / Crypto / Forex buttons for narrowing the instrument list */
@Component({
  selector: 'app-asset-filter',
  standalone: true,
  template: `
    <div class="filters" role="group" aria-label="Filter by asset type">
      @for (option of options; track option.value) {
        <button type="button" [class.active]="value() === option.value" [attr.aria-pressed]="value() === option.value"
                (click)="value.set(option.value)">
          {{ option.label }}<span class="count">{{ counts()[option.value] ?? 0 }}</span>
        </button>
      }
    </div>
  `,
  styleUrl: './asset-filter.component.scss'
})
export class AssetFilterComponent {
  readonly value = model<AssetFilter>('ALL');
  /** How many instruments each filter would show */
  readonly counts = input<Partial<Record<AssetFilter, number>>>({});

  protected readonly options: { value: AssetFilter; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: 'STOCK', label: 'Stocks' },
    { value: 'CRYPTO', label: 'Crypto' },
    { value: 'FOREX', label: 'Forex' }
  ];
}
