import { expect, test } from '@playwright/test';
import { environment } from '../src/environments/environment';

// Same client the app uses until real login exists
const DEV_CLIENT_ID = environment.devClientId;
const NEW_ACCOUNT_ID = '11111111-2222-4333-8444-555555555555';

// The POST is answered by a fake backend here, so this runs without agents-backend.
// e2e/backend.spec.ts covers the real connection.
test.describe('Add account', () => {
  test('plus button shows "Add account" on hover and opens the page', async ({ page }) => {
    await page.goto('/dashboard');
    const plus = page.getByRole('link', { name: 'Add account' });

    await plus.hover();
    // The tooltip is CSS (::after), so check it's showing via its computed style
    await expect.poll(() => plus.evaluate(el => getComputedStyle(el, '::after').opacity)).toBe('1');
    expect(await plus.evaluate(el => getComputedStyle(el, '::after').content)).toBe('"Add account"');

    await plus.click();
    await expect(page).toHaveURL(/\/accounts\/new$/);
    await expect(page.getByRole('heading', { name: 'Add account' })).toBeVisible();
  });

  test('pressing Enter creates the account for this client and opens it', async ({ page }) => {
    let sent: unknown;
    await page.route('**/api/accounts', async route => {
      if (route.request().method() !== 'POST') return route.fallback();
      sent = route.request().postDataJSON();
      await route.fulfill({
        status: 201,
        json: { accountId: NEW_ACCOUNT_ID, clientId: DEV_CLIENT_ID, name: 'Roth IRA', cashBalance: 2500.5, status: 'ACTIVE', openDate: new Date().toISOString() }
      });
    });

    await page.goto('/accounts/new');
    await page.getByLabel('Account name').fill('  Roth IRA ');
    await page.getByLabel('Initial deposit').fill('2500.50');
    await page.getByLabel('Initial deposit').press('Enter');

    await expect(page).toHaveURL(new RegExp(`/portfolio/${NEW_ACCOUNT_ID}$`));
    expect(sent).toEqual({ clientId: DEV_CLIENT_ID, name: 'Roth IRA', initialCashBalance: 2500.5 });
  });

  test('does not submit without a name and a positive deposit', async ({ page }) => {
    let posted = false;
    await page.route('**/api/accounts', route => {
      if (route.request().method() === 'POST') posted = true;
      return route.fallback();
    });

    await page.goto('/accounts/new');
    await page.getByLabel('Initial deposit').fill('0');
    await page.getByLabel('Initial deposit').press('Enter');

    await expect(page.getByText('Give the account a name')).toBeVisible();
    await expect(page.getByText('Enter an amount greater than $0')).toBeVisible();
    expect(posted).toBe(false);
  });

  test('shows the error when the backend rejects it', async ({ page }) => {
    await page.route('**/api/accounts', route =>
      route.request().method() === 'POST'
        ? route.fulfill({ status: 400, json: { message: 'Client not found' } })
        : route.fallback());

    await page.goto('/accounts/new');
    await page.getByLabel('Account name').fill('HSA');
    await page.getByLabel('Initial deposit').fill('100');
    await page.getByRole('button', { name: 'Add account' }).click();

    await expect(page.getByRole('alert')).toHaveText("Couldn't add the account: Client not found");
    await expect(page).toHaveURL(/\/accounts\/new$/);
  });
});
