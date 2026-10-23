import { Page } from '@playwright/test';
import { test, expect, loginAsClient } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
const tickers = ['AAA', 'BBB', 'CCC', 'DDD', 'EEE', 'FFF', 'GGG', 'HHH'];

/** Five daily bars with full open/high/low/close and volume: up, down, up, down, up */
const bars = [
  { timestamp: '2026-10-19T00:00:00Z', open: 100, high: 104, low: 99, close: 103, volume: 1_000_000 },
  { timestamp: '2026-10-20T00:00:00Z', open: 103, high: 105, low: 98, close: 99, volume: 2_500_000 },
  { timestamp: '2026-10-21T00:00:00Z', open: 99, high: 108, low: 98, close: 107, volume: 4_000_000 },
  { timestamp: '2026-10-22T00:00:00Z', open: 107, high: 109, low: 101, close: 102, volume: 1_500_000 },
  { timestamp: '2026-10-23T00:00:00Z', open: 102, high: 112, low: 101, close: 110, volume: 3_200_000 }
];

/**
 * Fakes the market-data endpoints. Each instrument's data takes `delayMs`, and the test can see
 * how many instruments were loading at the same time.
 */
async function fakeMarket(page: Page, delayMs = 0) {
  const inFlight = new Set<string>();
  const stats = { maxInFlight: 0, quoteOrder: [] as string[] };
  const track = async (ticker: string, respond: () => Promise<void>) => {
    inFlight.add(ticker);
    stats.maxInFlight = Math.max(stats.maxInFlight, inFlight.size);
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await respond();
    inFlight.delete(ticker);
  };

  await page.route('**/api/instruments', route => route.fulfill({
    json: { results: tickers.map(ticker => ({ instrumentId: `id-${ticker}`, ticker, name: `${ticker} Corp`, assetClass: 'EQUITY' })) }
  }));
  await page.route(/\/api\/instruments\/[A-Z]+$/, route => {
    const ticker = new URL(route.request().url()).pathname.split('/').pop()!;
    return route.fulfill({ json: { ticker, name: `${ticker} Corporation`, assetClass: 'EQUITY' } });
  });
  await page.route(/\/api\/instruments\/[^/]+\/quote$/, route => {
    const ticker = new URL(route.request().url()).pathname.split('/')[3];
    stats.quoteOrder.push(ticker);
    return track(ticker, () => route.fulfill({ json: { ticker, lastPrice: 110, priceChange: 2, priceChangePercent: 1.85 } }));
  });
  await page.route(/\/api\/instruments\/[^/]+\/history/, route => route.fulfill({
    json: { ticker: 'X', period: '1M', barCount: bars.length, bars }
  }));
  return stats;
}

test.describe('Trades', () => {
  test('loads the cards a few at a time, top to bottom', async ({ page }) => {
    await loginAsClient(page, [account]);
    const stats = await fakeMarket(page, 300);
    await page.goto(`/trades/${account.accountId}`);

    // Every card shows straight away, then fills in
    const cards = page.locator('.instrument-card');
    await expect(cards).toHaveCount(tickers.length);
    await expect(cards.first()).toContainText('$110.00');
    await expect(cards.last()).toContainText('$110.00');

    expect(stats.maxInFlight).toBeLessThanOrEqual(3);
    // Quotes were asked for in the order the cards appear
    expect(stats.quoteOrder).toEqual(tickers);
  });

  test('the order pop-up can layer candlesticks over the line chart', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    await page.goto(`/trades/${account.accountId}`);

    const firstCard = page.locator('.instrument-card').first();
    await expect(firstCard).toContainText('$110.00');
    await firstCard.getByRole('button', { name: /Trade/ }).click();

    const dialog = page.getByRole('dialog');
    const chartType = dialog.getByRole('group', { name: 'Chart type' });
    await expect(chartType.getByRole('button', { name: 'Line', exact: true })).toHaveAttribute('aria-pressed', 'true');
    await expect(dialog.getByRole('img', { name: 'Price history line chart' })).toBeVisible();

    await expect(dialog.locator('g.candle')).toHaveCount(0);

    await chartType.getByRole('button', { name: 'Line + Candles' }).click();
    // One chart: the line is still there, with the candles drawn over it
    const candles = dialog.getByRole('img', { name: 'Price history line chart with candlesticks' });
    await expect(candles).toBeVisible();
    await expect(candles.locator('polyline')).toHaveCount(1);
    await expect(dialog.getByRole('img')).toHaveCount(1);
    // One candle per bar: three up (green) days and two down (red) days
    await expect(candles.locator('g.up')).toHaveCount(3);
    await expect(candles.locator('g.down')).toHaveCount(2);

    // The readout shows the latest candle, and the hovered one on hover
    await expect(dialog.locator('.readout')).toContainText('O$102.00');
    await expect(dialog.locator('.readout')).toContainText('C$110.00');
    await candles.locator('rect.slot').nth(1).hover();
    await expect(dialog.locator('.readout')).toContainText('Oct 20, 2026');
    await expect(dialog.locator('.readout')).toContainText('H$105.00');
    await expect(dialog.locator('.readout')).toContainText('L$98.00');
    await expect(dialog.locator('.readout')).toContainText('V2.5M');

    // Shaded volume bars along the bottom, one per day; the busiest day (Oct 21) is the tallest
    const volume = dialog.locator('rect.vol');
    await expect(volume).toHaveCount(5);
    const heights = await volume.evaluateAll(rects => rects.map(r => Number(r.getAttribute('height'))));
    expect(Math.max(...heights)).toBe(heights[2]);
    await expect(dialog.locator('rect.vol.up')).toHaveCount(3);
    // The hover highlight is drawn behind the volume bars, so it never covers them
    const order = await candles.evaluate(svg => [...svg.querySelectorAll('rect')].map(r => r.getAttribute('class') ?? ''));
    expect(order.findLastIndex(c => c.includes('slot'))).toBeLessThan(order.findIndex(c => c.includes('vol')));

    // The choice is remembered for the next instrument
    await dialog.getByRole('button', { name: 'Close order' }).click();
    await page.locator('.instrument-card').nth(1).getByRole('button', { name: /Trade/ }).click();
    await expect(page.getByRole('dialog').getByRole('img', { name: 'Price history line chart with candlesticks' })).toBeVisible();
  });

  test('filters the instruments by stocks, crypto or forex', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    const mixed = [
      { ticker: 'AAPL', assetClass: 'STOCK' }, { ticker: 'MSFT', assetClass: 'STOCK' },
      { ticker: 'BTC', assetClass: 'CRYPTO' }, { ticker: 'EUR/USD', assetClass: 'FOREX' }, { ticker: 'SPY', assetClass: 'ETF' }
    ];
    const results = mixed.map(m => ({ instrumentId: `id-${m.ticker}`, ticker: m.ticker, name: `${m.ticker} name`, assetClass: m.assetClass }));
    await page.route('**/api/instruments', route => route.fulfill({ json: { results } }));
    await page.route('**/api/instruments/search?**', route => route.fulfill({ json: { results: results.filter(r => r.ticker.includes('U')) } }));
    // Details keep the asset class
    await page.route(/\/api\/instruments\/[^/?]+$/, route => {
      const ticker = decodeURIComponent(new URL(route.request().url()).pathname.split('/').pop()!);
      return route.fulfill({ json: { ticker, name: `${ticker} name`, assetClass: mixed.find(m => m.ticker === ticker)?.assetClass ?? 'STOCK' } });
    });
    await page.goto(`/trades/${account.accountId}`);

    const filters = page.getByRole('group', { name: 'Filter by asset type' });
    const cards = page.locator('.instrument-card');
    await expect(cards).toHaveCount(5);
    await expect(filters.getByRole('button', { name: /^All/ })).toHaveAttribute('aria-pressed', 'true');
    await expect(filters.getByRole('button', { name: /^Stocks/ })).toContainText('2');

    await filters.getByRole('button', { name: /^Stocks/ }).click();
    await expect(cards).toHaveCount(2);
    await expect(page.locator('.result-count')).toHaveText('2 stocks');

    await filters.getByRole('button', { name: /^Crypto/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('BTC');

    await filters.getByRole('button', { name: /^Forex/ }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.first()).toContainText('EUR/USD');
    // Forex symbols with a slash still get a price
    await expect(cards.first()).toContainText('$110.00');

    // The filter also applies to search results
    await page.getByRole('searchbox', { name: /Search stocks, crypto or forex/ }).fill('U');
    await expect(cards).toHaveCount(1);
    await filters.getByRole('button', { name: /^Crypto/ }).click();
    await expect(cards).toHaveCount(0);
    await expect(page.locator('.empty-state')).toContainText('No crypto found');
  });

  test('the available cash updates after placing an order, and again when it fills', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    // The backend's balance: $5,000 to start, $3,900 once the order holds the cash, $3,890 once it fills
    let available = 5000;
    await page.route(`**/api/accounts/${account.accountId}/summary`, route => route.fulfill({
      json: { cashBalance: available, availableBalance: available, holdingsValue: 0, totalValue: available, summaryDate: '' }
    }));
    let orderStatus = 'PENDING';
    await page.route('**/api/v1/orders', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      available = 3900;
      return route.fulfill({ status: 201, json: { orderId: 'order-1', status: 'PENDING' } });
    });
    await page.route('**/api/v1/orders/order-1', route => route.fulfill({ json: { orderId: 'order-1', status: orderStatus } }));
    await page.goto(`/trades/${account.accountId}`);

    const cash = page.locator('.cash-card strong');
    await expect(cash).toHaveText('$5,000.00');

    await page.locator('.instrument-card').first().getByRole('button', { name: /Trade/ }).click();
    await page.getByRole('button', { name: 'Review and place order' }).click();
    await expect(page.getByRole('dialog')).toContainText('Order received');
    // Re-read from the backend straight after the order
    await expect(cash).toHaveText('$3,900.00');

    // The order fills: re-read again
    available = 3890;
    orderStatus = 'FILLED';
    await expect(page.getByRole('dialog')).toContainText('Trade filled');
    await expect(cash).toHaveText('$3,890.00');
  });

  test('the stock list is paginated, 12 per page, and only the shown page loads prices', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    // 30 instruments: 26 stocks (AAA..ZZZ) and 4 crypto
    const many = [
      ...Array.from({ length: 26 }, (_, i) => ({ ticker: String.fromCharCode(65 + i).repeat(3), assetClass: 'STOCK' })),
      ...['BTC', 'ETH', 'SOL', 'DOGE'].map(ticker => ({ ticker, assetClass: 'CRYPTO' }))
    ];
    await page.route('**/api/instruments', route => route.fulfill({
      json: { results: many.map(m => ({ instrumentId: `id-${m.ticker}`, ticker: m.ticker, name: `${m.ticker} name`, assetClass: m.assetClass })) }
    }));
    await page.route(/\/api\/instruments\/[^/?]+$/, route => {
      const ticker = new URL(route.request().url()).pathname.split('/').pop()!;
      return route.fulfill({ json: { ticker, name: `${ticker} name`, assetClass: many.find(m => m.ticker === ticker)?.assetClass ?? 'STOCK' } });
    });
    const quoted: string[] = [];
    page.on('request', request => {
      const match = new URL(request.url()).pathname.match(/\/api\/instruments\/([^/]+)\/quote$/);
      if (match) quoted.push(match[1]);
    });
    await page.goto(`/trades/${account.accountId}`);

    const cards = page.locator('.instrument-card');
    const pager = page.getByRole('navigation', { name: 'Stock list pages' });
    await expect(cards).toHaveCount(12);
    await expect(cards.first()).toContainText('AAA');
    await expect(pager).toContainText('Showing 1–12 of 30');
    await expect(page.locator('.result-count')).toHaveText('30 instruments');
    await expect(cards.last()).toContainText('$110.00');
    // Only page 1's cards asked for a price
    expect(new Set(quoted)).toEqual(new Set(many.slice(0, 12).map(m => m.ticker)));

    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(cards.first()).toContainText('MMM');
    await expect(pager.getByRole('button', { name: 'Page 2' })).toHaveAttribute('aria-current', 'page');
    await expect(cards.last()).toContainText('$110.00');
    expect(quoted).toContain('MMM');
    expect(quoted).not.toContain('YYY');

    await pager.getByRole('button', { name: 'Page 3' }).click();
    await expect(cards).toHaveCount(6);
    await expect(pager).toContainText('Showing 25–30 of 30');
    await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();

    // Filtering starts again on page 1; a single page has no pager
    await page.getByRole('group', { name: 'Filter by asset type' }).getByRole('button', { name: /^Crypto/ }).click();
    await expect(cards).toHaveCount(4);
    await expect(pager).toHaveCount(0);
    await page.getByRole('group', { name: 'Filter by asset type' }).getByRole('button', { name: /^All/ }).click();
    await expect(page.getByRole('navigation', { name: 'Stock list pages' }).getByRole('button', { name: 'Page 1' })).toHaveAttribute('aria-current', 'page');
  });
});
