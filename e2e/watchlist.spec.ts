import { Page } from '@playwright/test';
import { test, expect, loginAsClient, CLIENT_ID } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
const instruments = [
  { instrumentId: 'aaaa0000-0000-4000-8000-000000000001', ticker: 'AAPL', name: 'Apple Inc.', assetClass: 'STOCK' },
  { instrumentId: 'aaaa0000-0000-4000-8000-000000000002', ticker: 'MSFT', name: 'Microsoft Corp.', assetClass: 'STOCK' },
  { instrumentId: 'aaaa0000-0000-4000-8000-000000000003', ticker: 'BTC', name: 'Bitcoin', assetClass: 'CRYPTO' }
];

/**
 * A fake watchlist backend: GET lists, POST adds, DELETE removes, all against `saved`.
 * Returns the request bodies/paths so tests can check what was sent.
 */
async function fakeWatchlist(page: Page, saved: typeof instruments) {
  const calls = { added: [] as unknown[], removed: [] as string[] };
  const entry = (i: (typeof instruments)[number]) => ({
    watchlistId: `w-${i.ticker}`, clientId: CLIENT_ID, instrumentId: i.instrumentId,
    ticker: i.ticker, instrumentName: i.name, addedAt: '2026-10-23T12:00:00Z'
  });
  await page.route(`**/api/watchlists/${CLIENT_ID}`, route => route.fulfill({ json: saved.map(entry) }));
  await page.route('**/api/watchlists', async route => {
    const body = route.request().postDataJSON() as { instrumentId: string };
    calls.added.push(body);
    const instrument = instruments.find(i => i.instrumentId === body.instrumentId)!;
    saved.unshift(instrument);
    await route.fulfill({ status: 201, json: entry(instrument) });
  });
  await page.route(`**/api/watchlists/${CLIENT_ID}/*`, async route => {
    const instrumentId = new URL(route.request().url()).pathname.split('/').pop()!;
    calls.removed.push(instrumentId);
    saved.splice(saved.findIndex(i => i.instrumentId === instrumentId), 1);
    await route.fulfill({ status: 204 });
  });
  return calls;
}

async function fakeMarket(page: Page) {
  await page.route('**/api/instruments', route => route.fulfill({ json: { results: instruments } }));
  await page.route(/\/api\/instruments\/[^/?]+$/, route => {
    const ticker = new URL(route.request().url()).pathname.split('/').pop()!;
    const i = instruments.find(x => x.ticker === ticker)!;
    return route.fulfill({ json: { ticker, name: i.name, assetClass: i.assetClass } });
  });
  await page.route(/\/api\/instruments\/[^/]+\/quote$/, route => route.fulfill({
    json: { lastPrice: 150, priceChange: 3, priceChangePercent: 2 }
  }));
  await page.route(/\/api\/instruments\/[^/]+\/history/, route => route.fulfill({ json: { bars: [] } }));
}

test.describe('Watchlist', () => {
  test('the star on a Trades card adds the stock to the watchlist, and takes it off again', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    const calls = await fakeWatchlist(page, [instruments[1]]);
    await page.goto(`/trades/${account.accountId}`);

    // MSFT is already on the list
    await expect(page.getByRole('button', { name: 'Remove MSFT from watchlist' })).toHaveAttribute('aria-pressed', 'true');

    const add = page.getByRole('button', { name: 'Add AAPL to watchlist' });
    await expect(add).toHaveAttribute('aria-pressed', 'false');
    await add.click();
    const remove = page.getByRole('button', { name: 'Remove AAPL from watchlist' });
    await expect(remove).toHaveAttribute('aria-pressed', 'true');
    expect(calls.added).toEqual([{ clientId: CLIENT_ID, instrumentId: instruments[0].instrumentId }]);

    await remove.click();
    await expect(page.getByRole('button', { name: 'Add AAPL to watchlist' })).toBeVisible();
    expect(calls.removed).toEqual([instruments[0].instrumentId]);
  });

  test('stocks starred on the Trades page show on the dashboard watchlist', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    await fakeWatchlist(page, []);
    await page.goto(`/trades/${account.accountId}`);
    await page.getByRole('button', { name: 'Add BTC to watchlist' }).click();
    await expect(page.getByRole('button', { name: 'Remove BTC from watchlist' })).toBeVisible();

    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard' }).click();
    const card = page.locator('.card.watchlist');
    await expect(card.getByRole('row').filter({ hasText: 'BTC' })).toContainText('$150.00');
    await expect(card.getByRole('row').filter({ hasText: 'BTC' })).toContainText('+2.00%');
  });

  test('Edit on the dashboard lets you remove stocks from the watchlist', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    const calls = await fakeWatchlist(page, [...instruments]);
    await page.goto('/home');

    const card = page.locator('.card.watchlist');
    const rows = card.locator('tbody tr');
    // Every entry shows (not just the first three)
    await expect(rows).toHaveCount(3);
    await expect(card.getByRole('button', { name: /Remove .* from watchlist/ })).toHaveCount(0);

    await card.getByRole('button', { name: 'Edit' }).click();
    await expect(card.getByRole('button', { name: 'Done' })).toHaveAttribute('aria-pressed', 'true');
    await card.getByRole('button', { name: 'Remove MSFT from watchlist' }).click();
    await expect(rows).toHaveCount(2);
    await expect(card).not.toContainText('MSFT');
    expect(calls.removed).toEqual([instruments[1].instrumentId]);

    await card.getByRole('button', { name: 'Done' }).click();
    await expect(card.getByRole('button', { name: /Remove .* from watchlist/ })).toHaveCount(0);

    // Removing the rest leaves an empty list with a pointer to the Trade page
    await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByRole('button', { name: 'Remove AAPL from watchlist' }).click();
    await card.getByRole('button', { name: 'Remove BTC from watchlist' }).click();
    await expect(card).toContainText('Your watchlist is empty');
    await expect(card.getByRole('button', { name: 'Edit' })).toHaveCount(0);
    await expect(card.getByRole('link', { name: 'Trade' })).toHaveAttribute('href', '/trades');
  });

  test('a failed change shows a message and leaves the list as it was', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    await fakeWatchlist(page, [instruments[0]]);
    await page.route(`**/api/watchlists/${CLIENT_ID}/*`, route => route.fulfill({ status: 500, json: { message: 'boom' } }));
    await page.goto('/home');

    const card = page.locator('.card.watchlist');
    await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByRole('button', { name: 'Remove AAPL from watchlist' }).click();
    await expect(card.getByRole('alert')).toContainText("AAPL couldn't be removed");
    await expect(card.locator('tbody tr')).toHaveCount(1);
  });

  test('the dashboard watchlist shows 4 at a time, with pages', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeMarket(page);
    // 9 entries: W1..W9
    const saved = Array.from({ length: 9 }, (_, i) => ({
      watchlistId: `w${i + 1}`, clientId: CLIENT_ID, instrumentId: `bbbb0000-0000-4000-8000-00000000000${i + 1}`,
      ticker: `W${i + 1}`, instrumentName: `Watched ${i + 1}`, addedAt: '2026-10-23T12:00:00Z'
    }));
    await page.route(`**/api/watchlists/${CLIENT_ID}`, route => route.fulfill({ json: saved }));
    await page.route(`**/api/watchlists/${CLIENT_ID}/*`, route => {
      const id = new URL(route.request().url()).pathname.split('/').pop()!;
      saved.splice(saved.findIndex(e => e.instrumentId === id), 1);
      return route.fulfill({ status: 204 });
    });
    const quoted: string[] = [];
    page.on('request', request => {
      const match = new URL(request.url()).pathname.match(/\/api\/instruments\/([^/]+)\/quote$/);
      if (match) quoted.push(match[1]);
    });
    await page.goto('/home');

    const card = page.locator('.card.watchlist');
    const rows = card.locator('tbody tr');
    const pager = card.getByRole('navigation', { name: 'Watchlist pages' });
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('W1');
    await expect(pager).toContainText('1–4 of 9');
    await expect(pager.getByRole('button', { name: 'Previous page' })).toBeDisabled();
    // Prices only for the page shown
    await expect(rows.nth(3)).toContainText('$150.00');
    expect(new Set(quoted)).toEqual(new Set(['W1', 'W2', 'W3', 'W4']));

    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(rows.first()).toContainText('W5');
    await expect(pager).toContainText('5–8 of 9');
    await pager.getByRole('button', { name: 'Next page' }).click();
    await expect(rows).toHaveCount(1);
    await expect(pager).toContainText('9–9 of 9');
    await expect(pager.getByRole('button', { name: 'Next page' })).toBeDisabled();

    // Removing the only row on the last page goes back a page
    await card.getByRole('button', { name: 'Edit' }).click();
    await card.getByRole('button', { name: 'Remove W9 from watchlist' }).click();
    await expect(rows).toHaveCount(4);
    await expect(rows.first()).toContainText('W5');
    // 8 left: two full pages
    await expect(pager).toContainText('5–8 of 8');
  });
});
