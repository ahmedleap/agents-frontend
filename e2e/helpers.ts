import { test as base, expect, Page } from '@playwright/test';
import { environment } from '../src/environments/environment';

// Shared fakes for tests that need a logged-in client. Nothing here talks to a real server.

export const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

export interface FakeAccount {
  accountId: string;
  name: string;
}

/** Requests the app makes to the middleware or the Java backend (through the dev proxy) */
function isServiceRequest(url: URL): boolean {
  if (url.href.startsWith(environment.middlewareUrl)) return true;
  if (url.host !== 'localhost:4200') return false;
  return url.pathname.startsWith('/api/')
    || url.pathname.startsWith('/users/')
    || (url.pathname === '/dashboard' && url.searchParams.has('clientId'));
}

/**
 * Use this `test` (instead of @playwright/test's) in specs that log in. Before each test it blocks
 * every middleware/backend request the test hasn't faked, so tests never reach real (shared)
 * servers. Blocked requests get a 503, not a 401: a 401 would make the app refresh and log out.
 * It's registered first, so any route a test adds later takes priority over it.
 */
export const test = base.extend({
  page: async ({ page }, use) => {
    await page.route(url => isServiceRequest(url), route => route.fulfill({
      status: 503,
      json: { message: `Not faked in this test: ${route.request().method()} ${route.request().url()}` }
    }));
    await use(page);
  }
});

export { expect };

function tokenFor(sub: string, email: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub, email, role: 'CLIENT', exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
}

/**
 * Fakes the middleware login and the backend reads for these accounts, then logs in through the
 * login form. The session is kept in sessionStorage, so page.goto() afterwards stays logged in.
 */
export async function loginAsClient(page: Page, accounts: FakeAccount[]): Promise<void> {
  const email = 'jane@example.com';
  const portfolio = (a: FakeAccount) => ({
    accountId: a.accountId, accountName: a.name, holdings: [],
    totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0
  });
  const listItem = (a: FakeAccount) => ({ ...a, status: 'ACTIVE', cashBalance: 100, availableBalance: 100, totalValue: 100 });

  await page.route('**/api/v1/auth/login', route => route.fulfill({
    json: {
      accessToken: tokenFor(CLIENT_ID, email), refreshToken: 'test-refresh-token', expiresIn: 900,
      user: { clientId: CLIENT_ID, email, firstName: 'Jane', lastName: 'Trader', role: 'CLIENT' }
    }
  }));
  // Client home page (GET /dashboard?clientId=...&period=30D)
  await page.route(url => url.pathname === '/dashboard' && url.searchParams.has('clientId'), route => route.fulfill({
    json: {
      accounts: accounts.map(listItem), marketMovers: [], watchlist: [], recentTrades: [],
      portfolioHistory: [], todayProfitLoss: 0, todayProfitLossPercent: 0
    }
  }));
  // Sidebar list
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}`, route => route.fulfill({
    json: { clientId: CLIENT_ID, accounts: accounts.map(portfolio), totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0 }
  }));
  // GET /api/accounts (used for the unique-name check)
  await page.route('**/api/accounts', route => route.request().method() === 'GET'
    ? route.fulfill({ json: accounts.map(listItem) })
    : route.fallback());
  // Watchlist (GET /api/watchlists/{clientId}); empty unless a test fakes it
  await page.route(`**/api/watchlists/${CLIENT_ID}`, route => route.request().method() === 'GET'
    ? route.fulfill({ json: [] })
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
  await expect(page).toHaveURL(/\/home$/);
}

/** Opens an account's page from the sidebar */
export async function openAccountFromSidebar(page: Page, account: FakeAccount): Promise<void> {
  // Scoped to the sidebar: the client home page lists the same accounts
  const sidebar = page.getByRole('navigation', { name: 'Main navigation' });
  await sidebar.getByRole('button', { name: 'Account' }).click();
  await sidebar.getByRole('link', { name: new RegExp(account.name) }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolio/${account.accountId}$`));
}
