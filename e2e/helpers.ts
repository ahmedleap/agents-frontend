import { expect, Page } from '@playwright/test';

// Shared fakes for tests that need a logged-in client. Nothing here talks to a real backend.

export const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export interface FakeAccount {
  accountId: string;
  name: string;
}

function tokenFor(sub: string, email: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub, email, role: 'CLIENT', exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
}

/**
 * Fakes the middleware login and the backend reads for these accounts, then logs in through the
 * login form. Navigate in-app afterwards (sidebar links): page.goto() reloads and loses the session.
 */
export async function loginAsClient(page: Page, accounts: FakeAccount[]): Promise<void> {
  const email = 'jane@example.com';
  const portfolio = (a: FakeAccount) => ({
    accountId: a.accountId, accountName: a.name, holdings: [],
    totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0
  });

  await page.route('**/api/v1/auth/login', route => route.fulfill({
    json: {
      accessToken: tokenFor(CLIENT_ID, email), refreshToken: 'test-refresh-token', expiresIn: 900,
      user: { clientId: CLIENT_ID, email, firstName: 'Jane', lastName: 'Trader', role: 'CLIENT' }
    }
  }));
  // Sidebar list
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}`, route => route.fulfill({
    json: { clientId: CLIENT_ID, accounts: accounts.map(portfolio), totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0 }
  }));
  // GET /api/accounts (used for the unique-name check)
  await page.route('**/api/accounts', route => route.request().method() === 'GET'
    ? route.fulfill({ json: accounts.map(a => ({ ...a, status: 'ACTIVE', cashBalance: 100, availableBalance: 100, totalValue: 100 })) })
    : route.fallback());
  for (const a of accounts) {
    await page.route(`**/api/portfolio/v1/${CLIENT_ID}/${a.accountId}`, route => route.fulfill({ json: portfolio(a) }));
    await page.route(`**/api/portfolio/v1/allocation/${CLIENT_ID}/${a.accountId}`, route => route.fulfill({ json: { industryBreakdown: [], assetClassBreakdown: [] } }));
    await page.route(`**/api/accounts/${a.accountId}/summary`, route => route.fulfill({
      json: { cashBalance: 100, availableBalance: 100, holdingsValue: 0, totalValue: 100, summaryDate: '' }
    }));
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('Secret123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/client$/);
}

/** Opens an account's page from the sidebar */
export async function openAccountFromSidebar(page: Page, account: FakeAccount): Promise<void> {
  // Scoped to the sidebar: the client home page lists the same accounts
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  await sidebar.getByRole('button', { name: 'Account' }).click();
  await sidebar.getByRole('link', { name: new RegExp(account.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolio/${account.accountId}$`));
}
