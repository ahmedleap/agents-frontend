import type { Page } from '@playwright/test';
import { CLIENT_ID, expect, loginAsClient, test } from './helpers';

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
