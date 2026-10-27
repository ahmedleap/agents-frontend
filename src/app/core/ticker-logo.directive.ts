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
    // Logos on a background of their own: swap in a transparent copy (a data: URL, which comes back
    // through here). AAPL is a black apple on a white square; ADI is a white tile with its mark cut out.
    if (!img.src.startsWith('data:')) {
      const cleaned = transparentCopy(img);
      if (cleaned) {
        img.src = cleaned;
        return;
      }
    }
    // Logos sit straight on the page. Single-colour ones are drawn black on the light theme and white on
    // the dark one. Other mostly-white ones (e.g. AMZN) get a dark circle on the light theme, and
    // mostly-black ones a light circle on the dark theme, so they don't disappear.
    const { tone, mono } = analyseLogo(img, img.src.startsWith('data:'));
    this.renderer[mono ? 'addClass' : 'removeClass'](img, 'mono');
    this.renderer[!mono && tone === 'light' ? 'addClass' : 'removeClass'](img, 'light');
    this.renderer[!mono && tone === 'dark' ? 'addClass' : 'removeClass'](img, 'dark');
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
 * A PNG data: URL of the logo with its own background made transparent, or null when it has none:
 * - on an opaque white background (all four corners white, e.g. AAPL): the white connected to the edges
 *   goes, so white inside the logo stays;
 * - a solid white tile with the mark cut out of it (e.g. ADI): the cut-out becomes the logo, in white.
 * The result is trimmed to the logo.
 */
function transparentCopy(img: HTMLImageElement): string | null {
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
    const alpha = (p: number) => data[p * 4 + 3];
    const isWhite = (p: number) => alpha(p) > 200 && Math.min(data[p * 4], data[p * 4 + 1], data[p * 4 + 2]) > 235;
    const corners = [0, w - 1, (h - 1) * w, h * w - 1];

    if (corners.every(isWhite)) {
      // White background: clear the white reachable from the edges
      floodFromEdges(w, h, isWhite, p => { data[p * 4 + 3] = 0; });
    } else if (isWhiteTile(data)) {
      // White tile: everything outside the tile (reachable from the edges through see-through pixels)
      // stays clear; the tile goes and its holes become the logo
      const outside = new Uint8Array(w * h);
      floodFromEdges(w, h, p => alpha(p) < 250, p => { outside[p] = 1; });
      for (let p = 0; p < w * h; p++) {
        const a = alpha(p);
        data[p * 4] = data[p * 4 + 1] = data[p * 4 + 2] = 255;
        data[p * 4 + 3] = outside[p] ? 0 : 255 - a;
      }
    } else {
      return null;
    }
    ctx.putImageData(image, 0, 0);
    return trimmed(canvas, data, w, h);
  } catch {
    // Can't read the pixels (e.g. no CORS): keep the logo as it is
    return null;
  }
}

/** Mostly covered (60-95%) by plain white, with see-through holes: a tile like ADI's */
function isWhiteTile(data: Uint8ClampedArray): boolean {
  let visible = 0;
  let white = 0;
  const total = data.length / 4;
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 40) continue;
    visible++;
    if (Math.min(data[i], data[i + 1], data[i + 2]) > 235) white++;
  }
  return visible > total * 0.6 && visible < total * 0.95 && white / visible > 0.97;
}

/** Visits every pixel reachable from the image's edges through pixels that pass `through` */
function floodFromEdges(w: number, h: number, through: (p: number) => boolean, visit: (p: number) => void): void {
  const seen = new Uint8Array(w * h);
  const stack: number[] = [];
  for (let x = 0; x < w; x++) stack.push(x, (h - 1) * w + x);
  for (let y = 0; y < h; y++) stack.push(y * w, y * w + w - 1);
  while (stack.length) {
    const p = stack.pop()!;
    if (seen[p] || !through(p)) continue;
    seen[p] = 1;
    visit(p);
    const x = p % w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (p >= w) stack.push(p - w);
    if (p < w * (h - 1)) stack.push(p + w);
  }
}

/** The visible part of the canvas, centred in a square so it isn't stretched, as a PNG data: URL */
function trimmed(canvas: HTMLCanvasElement, data: Uint8ClampedArray, w: number, h: number): string | null {
  let left = w, right = -1, top = h, bottom = -1;
  for (let p = 0; p < w * h; p++) {
    if (data[p * 4 + 3] < 8) continue;
    const x = p % w, y = (p - x) / w;
    if (x < left) left = x;
    if (x > right) right = x;
    if (y < top) top = y;
    if (y > bottom) bottom = y;
  }
  if (right < 0) return null;
  const width = right - left + 1;
  const height = bottom - top + 1;
  const side = Math.max(width, height);
  const square = document.createElement('canvas');
  square.width = square.height = side;
  square.getContext('2d')!.drawImage(canvas, left, top, width, height, (side - width) / 2, (side - height) / 2, width, height);
  return square.toDataURL('image/png');
}

/**
 * tone: 'light' when most of the logo's visible pixels are white, 'dark' when most are black.
 * mono: the logo is a single shade (black, white or grey), so it can be recoloured to suit the theme.
 */
function analyseLogo(img: HTMLImageElement, cutOut: boolean): { tone: 'light' | 'dark' | null; mono: boolean } {
  const none = { tone: null, mono: false };
  try {
    const size = 32;
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return none;
    ctx.drawImage(img, 0, 0, size, size);
    const data = ctx.getImageData(0, 0, size, size).data;
    let visible = 0;
    let light = 0;
    let dark = 0;
    let grey = 0;
    for (let i = 0; i < data.length; i += 4) {
      if (data[i + 3] < 40) continue;
      visible++;
      const min = Math.min(data[i], data[i + 1], data[i + 2]);
      const max = Math.max(data[i], data[i + 1], data[i + 2]);
      if (max - min < 30) grey++;
      if (min > 225) light++;
      else if (max < 60) dark++;
    }
    // A logo on its own solid square already has a background of its own (unless we just cut it out,
    // when the trimmed logo can fill the image)
    if (visible === 0 || (!cutOut && visible >= size * size * 0.95)) return none;
    // Mostly white is enough for a circle (AMZN is a white "a" with an orange smile)
    const tone = light / visible > 0.5 ? 'light' : dark / visible > 0.5 ? 'dark' : null;
    return { tone, mono: tone !== null && grey / visible > 0.97 };
  } catch {
    // Can't read the pixels (e.g. no CORS)
    return none;
  }
}

/** BRK.B -> BRK-B, BTC-USD / BTC/USD -> BTCUSD, EUR/USD -> EURUSD */
export function tickerLogoUrl(ticker: string): string {
  const t = (ticker ?? '').trim().toUpperCase();
  const symbol = /^[A-Z]+\.[A-Z]$/.test(t) ? t.replace('.', '-') : t.replace(/[^A-Z0-9]/g, '');
  return `https://financialmodelingprep.com/image-stock/${encodeURIComponent(symbol)}.png`;
}
