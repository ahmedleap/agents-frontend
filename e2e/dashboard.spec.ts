import { Page } from '@playwright/test';
import { test, expect, loginAsClient } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };

/** YYYY-MM-DD for `daysAgo` days before today, in the browser's (and test machine's) time zone */
function isoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toLocaleDateString('en-CA');
}

/** Replaces the dashboard response's value history (accounts are worth $100 in total today) */
async function fakeHistory(page: Page, history: { date: string; totalValue: number }[]) {
  await page.route(url => url.pathname === '/dashboard' && url.searchParams.has('clientId'), route => route.fulfill({
    json: {
      accounts: [{ ...account, status: 'ACTIVE', cashBalance: 100, availableBalance: 100, totalValue: 100 }],
      marketMovers: [], watchlist: [], recentTrades: [],
      portfolioHistory: history, todayProfitLoss: 0, todayProfitLossPercent: 0
    }
  }));
}

test.describe('Dashboard value chart', () => {
  test('shows the 30-day change from the daily history, ending at today\'s live total', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeHistory(page, [
      { date: isoDaysAgo(20), totalValue: 80 },
      { date: isoDaysAgo(10), totalValue: 90 }
    ]);
    await page.goto('/home');

    const card = page.locator('.chart-card');
    await expect(card).toContainText('Last 30 days');
    // $80 twenty days ago -> $100 today
    await expect(card.locator('.card-head strong')).toHaveText('+$20.00 (+25.00%)');
    await expect(card.locator('.chart-empty')).toHaveCount(0);
  });

  test('says there is no history yet instead of "Last 0 days" and a $0 change', async ({ page }) => {
    await loginAsClient(page, [account]);
    await fakeHistory(page, []);
    await page.goto('/home');

    const card = page.locator('.chart-card');
    await expect(card).toContainText('Last 30 days');
    await expect(card).not.toContainText('Last 0 days');
    await expect(card.locator('.card-head strong')).toHaveCount(0);
    await expect(card.locator('.chart-empty')).toContainText('No value history yet');
  });
});
