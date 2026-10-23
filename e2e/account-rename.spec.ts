import type { Page } from '@playwright/test';

import { expect, test, CLIENT_ID, loginAsClient, openAccountFromSidebar } from './helpers';

// Fake middleware + backend (see helpers.ts), so this runs without either
const ACCOUNT = { accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Roth IRA' };
const ACCOUNT_ID = ACCOUNT.accountId;

async function openAccount(page: Page) {
  await loginAsClient(page, [ACCOUNT]);
  await openAccountFromSidebar(page, ACCOUNT);
  await expect(page.getByRole('heading', { level: 2, name: ACCOUNT.name })).toBeVisible();
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
