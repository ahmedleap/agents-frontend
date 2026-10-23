import type { Page } from '@playwright/test';
import { CLIENT_ID, expect, loginAsClient, openAccountFromSidebar, test } from './helpers';

const ACCOUNT_ID = '11111111-2222-4333-8444-555555555555';
const ACCOUNT = { accountId: ACCOUNT_ID, name: 'Roth IRA' };

// Fake backend responses so this runs without agents-backend. Registered after loginAsClient,
// so these take priority over the helper's default account fakes.
async function mockAccount(page: Page, summary: { status: number; json?: unknown }) {
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}/${ACCOUNT_ID}`, route => route.fulfill({
    json: {
      accountId: ACCOUNT_ID, accountName: 'Roth IRA', holdings: [],
      totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0
    }
  }));
  await page.route(`**/api/portfolio/v1/allocation/${CLIENT_ID}/${ACCOUNT_ID}`, route => route.fulfill({
    json: { industryBreakdown: [], assetClassBreakdown: [] }
  }));
  await page.route(`**/api/accounts/${ACCOUNT_ID}/summary`, route => route.fulfill(summary));
}

test.describe('Account cash balance', () => {
  test('shows how much cash the account has', async ({ page }) => {
    await loginAsClient(page, [ACCOUNT]);
    await mockAccount(page, {
      status: 200,
      json: { cashBalance: 2500.5, availableBalance: 2000, holdingsValue: 0, totalValue: 2500.5, summaryDate: new Date().toISOString() }
    });

    await page.goto(`/portfolio/${ACCOUNT_ID}`);

    const card = page.locator('.cash');
    await expect(card).toContainText('Cash Balance');
    await expect(card).toContainText('$2,500.50');
    await expect(card).toContainText('$2,000.00 available to trade');
  });

  test('still shows the portfolio if the cash balance fails to load', async ({ page }) => {
    await loginAsClient(page, [ACCOUNT]);
    await mockAccount(page, { status: 500 });

    await page.goto(`/portfolio/${ACCOUNT_ID}`);

    await expect(page.getByRole('heading', { name: 'Roth IRA' })).toBeVisible();
    await expect(page.locator('.cash')).toContainText("Couldn't load the cash balance");
  });
});

test.describe('Account asset allocation', () => {
  test('shows the three largest sectors, and the rest scroll', async ({ page }) => {
    const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
    await loginAsClient(page, [account]);
    const sectors: [string, number][] = [['Energy', 900], ['Technology', 4200], ['Financials', 1800], ['Healthcare', 2500], ['Utilities', 600]];
    await page.route(`**/api/portfolio/v1/allocation/${CLIENT_ID}/${account.accountId}`, route => route.fulfill({
      json: { industryBreakdown: sectors.map(([industry, value]) => ({ industry, value, percentage: value / 100 })), assetClassBreakdown: [] }
    }));
    await openAccountFromSidebar(page, account);

    const card = page.locator('.card.alloc');
    const list = card.locator('.alloc-list');
    const rows = list.locator('.alloc-row');
    await expect(rows).toHaveCount(5);
    await expect(card).toContainText('scroll for 2 more');
    // Largest first
    await expect(rows.nth(0)).toContainText('Technology');
    await expect(rows.nth(2)).toContainText('Financials');

    // The list is three rows tall and scrolls
    const sizes = await list.evaluate(el => ({
      visible: el.clientHeight, content: el.scrollHeight, row: (el.querySelector('.alloc-row') as HTMLElement).offsetHeight
    }));
    expect(Math.abs(sizes.visible - 3 * sizes.row)).toBeLessThanOrEqual(1);
    expect(sizes.content).toBeGreaterThan(sizes.visible);
    // The card is the same height as the value and cash boxes beside it
    const heights = await page.evaluate(() => ['.hero', '.card.cash', '.card.alloc'].map(s => document.querySelector(s)!.getBoundingClientRect().height));
    expect(Math.abs(heights[2] - heights[0])).toBeLessThanOrEqual(1);
    expect(Math.abs(heights[2] - heights[1])).toBeLessThanOrEqual(1);
    await expect(rows.nth(0)).toBeInViewport();
    await rows.nth(4).scrollIntoViewIfNeeded();
    await expect(rows.nth(4)).toBeInViewport();
  });
});

test.describe('Account holdings', () => {
  test('every holding shows, and the page scrolls instead of the table', async ({ page }) => {
    const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
    await page.setViewportSize({ width: 1366, height: 768 });
    await loginAsClient(page, [account]);
    const holdings = Array.from({ length: 20 }, (_, i) => ({
      holdingId: `h${i}`, accountId: account.accountId, instrumentId: `i${i}`,
      ticker: `T${String.fromCharCode(65 + i)}`, name: `Company ${i + 1}`, quantity: 10, averageCostBasis: 100,
      currentPrice: 100 + i, currentValue: 1000 + i * 10, gainLossDollars: i * 10, gainLossPercent: i
    }));
    await page.route(`**/api/portfolio/v1/${CLIENT_ID}/${account.accountId}`, route => route.fulfill({
      json: { accountId: account.accountId, accountName: account.name, holdings,
        totalPortfolioValue: 21900, totalCostBasis: 20000, totalGainLossDollars: 1900, totalGainLossPercent: 9.5 }
    }));
    await openAccountFromSidebar(page, account);

    const rows = page.locator('.holdings tbody tr');
    await expect(rows).toHaveCount(20);
    // The table doesn't scroll on its own...
    const table = await page.locator('.holdings .table-wrap').evaluate(el => ({ content: el.scrollHeight, visible: el.clientHeight }));
    expect(table.content).toBeLessThanOrEqual(table.visible + 1);
    // ...the page does, down to the last holding
    const pageScroll = await page.locator('app-portfolio').evaluate(el => ({ content: el.scrollHeight, visible: el.clientHeight }));
    expect(pageScroll.content).toBeGreaterThan(pageScroll.visible);
    await expect(rows.last()).not.toBeInViewport();
    await page.mouse.move(800, 500);
    await page.mouse.wheel(0, 5000);
    await expect(rows.last()).toBeInViewport();
  });
});
