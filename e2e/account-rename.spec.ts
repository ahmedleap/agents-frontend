import { expect, Page, test } from '@playwright/test';

// Fake middleware + backend, so this runs without either. Same login stub as e2e/login.spec.ts.
const CLIENT_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ACCOUNT_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function tokenFor(sub: string, email: string): string {
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode({ sub, email, role: 'CLIENT', exp: Math.floor(Date.now() / 1000) + 900 })}.test-signature`;
}

/** Logs in as a client and opens their one account from the sidebar (in-app, so the session is kept) */
async function openAccount(page: Page, accountName = 'Roth IRA') {
  const email = 'jane@example.com';
  await page.route('**/api/v1/auth/login', route => route.fulfill({
    json: {
      accessToken: tokenFor(CLIENT_ID, email), refreshToken: 'test-refresh-token', expiresIn: 900,
      user: { clientId: CLIENT_ID, email, firstName: 'Jane', lastName: 'Trader', role: 'CLIENT' }
    }
  }));
  const account = { accountId: ACCOUNT_ID, accountName, holdings: [], totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0 };
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}`, route => route.fulfill({
    json: { clientId: CLIENT_ID, accounts: [account], totalPortfolioValue: 0, totalCostBasis: 0, totalGainLossDollars: 0, totalGainLossPercent: 0 }
  }));
  await page.route(`**/api/portfolio/v1/${CLIENT_ID}/${ACCOUNT_ID}`, route => route.fulfill({ json: account }));
  await page.route(`**/api/portfolio/v1/allocation/${CLIENT_ID}/${ACCOUNT_ID}`, route => route.fulfill({ json: { industryBreakdown: [], assetClassBreakdown: [] } }));
  await page.route(`**/api/accounts/${ACCOUNT_ID}/summary`, route => route.fulfill({
    json: { cashBalance: 100, availableBalance: 100, holdingsValue: 0, totalValue: 100, summaryDate: '' }
  }));

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel(/^Password/).fill('Secret123!');
  await page.getByRole('button', { name: 'Log in' }).click();
  await expect(page).toHaveURL(/\/client$/);

  await page.getByRole('button', { name: 'Account' }).click();
  await page.getByRole('link', { name: new RegExp(accountName) }).click();
  await expect(page).toHaveURL(new RegExp(`/portfolio/${ACCOUNT_ID}$`));
  await expect(page.getByRole('heading', { level: 2, name: accountName })).toBeVisible();
}

test.describe('Rename account', () => {
  test('pencil turns the name into a text box, and Save renames it', async ({ page }) => {
    let sent: unknown;
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { accountId: ACCOUNT_ID, clientId: CLIENT_ID, name: 'Retirement', cashBalance: 100, status: 'ACTIVE', openDate: '' } });
    });
    await openAccount(page);

    await page.getByRole('button', { name: 'Rename account' }).click();
    const input = page.getByLabel('Account name');
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('Roth IRA');

    await input.fill('  Retirement  ');
    await page.getByRole('button', { name: 'Save' }).click();

    expect(sent).toEqual({ name: 'Retirement' });
    await expect(page.getByRole('heading', { level: 2, name: 'Retirement' })).toBeVisible();
    await expect(input).toHaveCount(0);
  });

  test('Esc cancels without saving', async ({ page }) => {
    let saved = false;
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, route => {
      if (route.request().method() === 'PUT') saved = true;
      return route.fallback();
    });
    await openAccount(page);

    await page.getByRole('button', { name: 'Rename account' }).click();
    await page.getByLabel('Account name').fill('Something else');
    await page.getByLabel('Account name').press('Escape');

    await expect(page.getByRole('heading', { level: 2, name: 'Roth IRA' })).toBeVisible();
    expect(saved).toBe(false);
  });

  test('a blank name is not sent', async ({ page }) => {
    let saved = false;
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, route => {
      if (route.request().method() === 'PUT') saved = true;
      return route.fallback();
    });
    await openAccount(page);

    await page.getByRole('button', { name: 'Rename account' }).click();
    await page.getByLabel('Account name').fill('   ');
    await page.getByLabel('Account name').press('Enter');

    await expect(page.getByRole('alert')).toHaveText("The account name can't be blank.");
    expect(saved).toBe(false);
  });

  test('shows the backend error and keeps the text box open', async ({ page }) => {
    await page.route(`**/api/accounts/${ACCOUNT_ID}`, route =>
      route.request().method() === 'PUT'
        ? route.fulfill({ status: 400, json: { message: 'Account name cannot be blank' } })
        : route.fallback());
    await openAccount(page);

    await page.getByRole('button', { name: 'Rename account' }).click();
    await page.getByLabel('Account name').fill('New name');
    await page.getByRole('button', { name: 'Save' }).click();

    await expect(page.getByRole('alert')).toHaveText("Couldn't rename: Account name cannot be blank");
    await expect(page.getByLabel('Account name')).toBeVisible();
  });
});
