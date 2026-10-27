import { Page } from '@playwright/test';
import { test, expect, loginAsClient, openAccountFromSidebar, CLIENT_ID } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
const holding = (ticker: string, name: string, quantity: number) => ({
  holdingId: `h-${ticker}`, accountId: account.accountId, instrumentId: `id-${ticker}`, ticker, name, quantity,
  averageCostBasis: 100, currentPrice: 120, currentValue: quantity * 120, gainLossDollars: quantity * 20, gainLossPercent: 20
});

/** An account holding AAPL (25) and NVDA (8); the Trades list shows AAPL, MSFT and NVDA unless `listed` says otherwise */
async function fakeAccountAndMarket(page: Page, listed = ['AAPL', 'MSFT', 'NVDA']) {
  const holdings = [holding('AAPL', 'Apple Inc.', 25), holding('NVDA', 'NVIDIA Corp.', 8)];
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}/${account.accountId}`, route => route.fulfill({
    json: { accountId: account.accountId, accountName: account.name, holdings, totalPortfolioValue: 3960, totalCostBasis: 3300, totalGainLossDollars: 660, totalGainLossPercent: 20 }
  }));
  const result = (ticker: string) => ({ instrumentId: `id-${ticker}`, ticker, name: `${ticker} name`, assetClass: 'STOCK' });
  await page.route('**/api/instruments', route => route.fulfill({ json: { results: listed.map(result) } }));
  await page.route('**/api/instruments/search?**', route => {
    const q = new URL(route.request().url()).searchParams.get('q')!;
    return route.fulfill({ json: { results: [result(q)] } });
  });
  await page.route(/\/api\/instruments\/[A-Z]+$/, route => {
    const ticker = new URL(route.request().url()).pathname.split('/').pop()!;
    return route.fulfill({ json: { ticker, name: `${ticker} name`, assetClass: 'STOCK' } });
  });
  await page.route(/\/api\/instruments\/[A-Z]+\/quote$/, route => route.fulfill({ json: { lastPrice: 120, priceChange: 1, priceChangePercent: 0.8 } }));
  await page.route(/\/api\/instruments\/[A-Z]+\/history/, route => route.fulfill({ json: { bars: [] } }));
}

test.describe('Sell from holdings', () => {
  test('clicking a holding opens the Trade page with that stock ready to sell', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeAccountAndMarket(page);
    await openAccountFromSidebar(page, account);

    const link = page.getByRole('link', { name: 'Sell AAPL' });
    await expect(link).toHaveAttribute('data-tip', 'Sell AAPL');
    await link.click();

    await expect(page).toHaveURL(new RegExp(`/trades/${account.accountId}`));
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Trade AAPL' })).toBeVisible();
    const side = dialog.getByRole('group', { name: 'Order side' });
    await expect(side.getByRole('button', { name: 'Sell' })).toHaveClass(/active/);
    await expect(side.getByRole('button', { name: 'Buy' })).not.toHaveClass(/active/);
    // Trading from the account the holding is in
    await expect(page.getByRole('combobox', { name: 'Select trading account' })).toHaveValue(account.accountId);
    // The 25 shares held can be sold: the order button is enabled for the default 10
    await expect(dialog.getByRole('button', { name: 'Review and place order' })).toBeEnabled();

    // ticker/side are taken off the address, so closing and reloading doesn't reopen it
    await expect(page).not.toHaveURL(/ticker=/);
    await dialog.getByRole('button', { name: 'Close order' }).click();
    await page.reload();
    await expect(page.locator('.instrument-card').first()).toBeVisible();
    await expect(page.getByRole('dialog')).toHaveCount(0);
  });

  test('a holding that is not in the Trades list is looked up by ticker', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeAccountAndMarket(page, ['AAPL', 'MSFT']);
    await openAccountFromSidebar(page, account);

    await page.getByRole('link', { name: 'Sell NVDA' }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByRole('heading', { name: 'Trade NVDA' })).toBeVisible();
    await expect(dialog.getByRole('group', { name: 'Order side' }).getByRole('button', { name: 'Sell' })).toHaveClass(/active/);
  });

  test('selling shows how many shares you own, with Sell all, and warns when you ask for too many', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeAccountAndMarket(page);
    await openAccountFromSidebar(page, account);
    await page.getByRole('link', { name: 'Sell AAPL' }).click();

    const dialog = page.getByRole('dialog');
    const owned = dialog.locator('.owned');
    await expect(owned).toContainText('You own');
    await expect(owned).toContainText('25 shares');
    // 25 x $120
    await expect(owned).toContainText('Worth $3,000.00 at the current price');
    await expect(owned).not.toHaveClass(/over/);

    const shares = dialog.getByRole('spinbutton', { name: 'Shares' });
    await owned.getByRole('button', { name: 'Sell all' }).click();
    await expect(shares).toHaveValue('25');
    await expect(owned.getByRole('button', { name: 'Sell all' })).toBeDisabled();
    await expect(dialog.getByRole('button', { name: 'Review and place order' })).toBeEnabled();

    // More than you own: red, and the order can't be placed
    await shares.fill('30');
    await expect(owned).toHaveClass(/over/);
    await expect(owned).toContainText('You only have');
    await expect(dialog.getByRole('button', { name: 'Review and place order' })).toBeDisabled();
  });

  test('selling a stock you do not own says so', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeAccountAndMarket(page);
    await page.goto(`/trades/${account.accountId}`);
    await page.locator('.instrument-card').filter({ hasText: 'MSFT' }).getByRole('button', { name: /Trade/ }).click();

    const dialog = page.getByRole('dialog');
    await dialog.getByRole('group', { name: 'Order side' }).getByRole('button', { name: 'Sell' }).click();
    await expect(dialog.locator('.owned.none')).toContainText("You don't own any");
    await expect(dialog.locator('.owned.none')).toContainText('MSFT');
    await expect(dialog.getByRole('button', { name: 'Review and place order' })).toBeDisabled();
  });
});
