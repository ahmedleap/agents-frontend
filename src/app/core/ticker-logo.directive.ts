import { Directive, ElementRef, OnInit, Renderer2, inject, input } from '@angular/core';

/**
 * Company / coin / currency logo for a ticker, from Financial Modeling Prep's public image service
 * (no API key, frontend only). Put it inside an existing letter badge:
 *
 *   <span class="badge">{{ ticker[0] }}<img appTickerLogo [ticker]="ticker"></span>
 *
 * The logo covers the badge once it loads. Tickers without a logo (404) remove the image, so the letter
 * badge shows as before.
 */
@Directive({
  selector: 'img[appTickerLogo]',
  host: {
    class: 'ticker-logo',
    alt: '',
    loading: 'lazy',
    decoding: 'async',
    // Lets onLoad read the pixels (the image service allows any origin)
    crossorigin: 'anonymous',
    referrerpolicy: 'no-referrer',
    '[src]': 'src()',
    '(load)': 'onLoad()',
    '(error)': 'onError()'
  }
})
export class TickerLogoDirective implements OnInit {
  readonly ticker = input.required<string>();

  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);
  private readonly renderer = inject(Renderer2);

  protected src(): string {
    return tickerLogoUrl(this.ticker());
  }

  ngOnInit(): void {
    // The badge clips the logo to its own shape (circle or rounded square)
    const badge = this.el.nativeElement.parentElement;
    if (badge) {
      this.renderer.setStyle(badge, 'position', 'relative');
      this.renderer.setStyle(badge, 'overflow', 'hidden');
    }
  }

  protected onLoad(): void {
    const img = this.el.nativeElement;
    // Logos drawn on a solid white square (e.g. AAPL): swap in a copy with the square cut out. That copy
    // loads as a data: URL and comes back through here.
    if (!img.src.startsWith('data:')) {
      const cutOut = withoutWhiteBackground(img);
      if (cutOut) {
        img.src = cutOut;
        return;
      }
    }
    // Logos sit straight on the page. All-white ones (e.g. ABBV) get a dark circle in light mode, and
    // all-black ones (e.g. AAPL) a light circle in dark mode, so they don't disappear.
    const tone = logoTone(img, img.src.startsWith('data:'));
    this.renderer[tone === 'light' ? 'addClass' : 'removeClass'](img, 'light');
    this.renderer[tone === 'dark' ? 'addClass' : 'removeClass'](img, 'dark');
    this.renderer.addClass(img, 'loaded');
    // Hide the letter badge's circle and letter behind the logo
    const badge = img.parentElement;
    if (badge) this.renderer.addClass(badge, 'has-logo');
  }

  protected onError(): void {
    const img = this.el.nativeElement;
    this.renderer.removeClass(img, 'loaded');
    if (img.parentElement) this.renderer.removeClass(img.parentElement, 'has-logo');
  }
}

/**
 * For a logo on an opaque white background (all four corners white), a PNG data: URL of the logo with
 * that background made transparent; otherwise null. Only white connected to the edges goes, so white
 * inside the logo stays.
 */
function withoutWhiteBackground(img: HTMLImageElement): string | null {
  try {
    const w = img.naturalWidth;
    const h = img.naturalHeight;
    if (!w || !h) return null;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0);
    const image = ctx.getImageData(0, 0, w, h);
    const data = image.data;
    const isWhite = (p: number) => data[p * 4 + 3] > 200 && Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) > 235;
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];
    if (!corners.every(isWhite)) return null;

    // Flood fill from every edge pixel through white pixels, clearing them
    const seen = new Uint8Array(w * h);
    const stack: number[] = [];
    for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
    for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
    while (stack.length) {
      const p = stack.pop()!;
      if (seen[p] || !isWhite(p)) continue;
      seen[p] = 1;
      data[p * 4 + 3] = 0;
      const x = p % w;
      if (x > 0) stack.push(p - 1);
      if (x < w - 1) stack.push(p + 1);
      if (p >= w) stack.push(p - w);
      if (p < w * (h - 1)) stack.push(p + w);
    }
    ctx.putImageData(image, 0, 0);

    // Trim the empty space the square left around the logo, keeping it square so it isn't stretched
    let left = w, right = -1, top = h, bottom = -1;
    for (let p = 0; p < w * h; p++) {
      if (data[p * 4 + 3] === 0) continue;
      const x = p % w, y = (p - x) / w;
      if (x < left) left = x;
      if (x > right) right = x;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
    }
    if (right < 0) return null;
    const side = Math.max(right - left, bottom - top) + 1;
    const cropped = document.createElement('canvas');
    cropped.width = cropped.height = side;
    cropped.getContext('2d')!.drawImage(canvas, left, top, right - left + 1, bottom - top + 1,
      (side - (right - left + 1)) / 2, (side - (bottom - top + 1)) / 2, right - left + 1, bottom - top + 1);
    return cropped.toDataURL('image/png');
  } catch {
    // Can't read the pixels (e.g. no CORS): keep the logo as it is
    return null;
  }
}

/** 'light' when most of the logo's visible pixels are white, 'dark' when most are black */
function logoTone(img: HTMLImageElement, cutOut: boolean): 'light' | 'dark' | null {
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let visible = 0;
    let light = 0;
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue;
      visible++;
      if (Math.min(data[i], data[i + 1], data[i + 2]) > 225) light++;
      else if (Math.max(data[i], data[i + 1], data[i + 2]) < 60) dark++;
    }
    // A logo on its own solid square already has a background of its own (unless we just cut it out,
    // when the trimmed logo can fill the image)
    if (visible === 0 || (!cutOut && visible >= size * size * 0.95)) return null;
    // Mostly white is enough (AMZN is a white "a" with an orange smile)
    if (light / visible > 0.5) return 'light';
    if (dark / visible > 0.5) return 'dark';
    return null;
  } catch {
    // Can't read the pixels (e.g. no CORS)
    return null;
  }
}

/** BRK.B -> BRK-B, BTC-USD / BTC/USD -> BTCUSD, EUR/USD -> EURUSD */
export function tickerLogoUrl(ticker: string): string {
  const t = (ticker ?? '').trim().toUpperCase();
  const symbol = /^[A-Z]+\.[A-Z]$/.test(t) ? t.replace('.', '-') : t.replace(/[^A-Z0-9]/g, '');
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`;
}
