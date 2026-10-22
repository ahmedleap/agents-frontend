import { expect, test, CLIENT_ID, loginAsClient, openAccountFromSidebar } from './helpers';

// A client can't have two accounts with the same name (ignoring capitals and extra spaces)
const ROTH = { accountId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', name: 'Roth IRA' };
const SAVINGS = { accountId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', name: 'College Savings' };

test.describe('Unique account names: Add account', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page, [ROTH, SAVINGS]);
    await page.getByRole('link', { name: 'Add account' }).click();
    await expect(page).toHaveURL(/\/accounts\/new$/);
  });

  test('rejects a name the client already uses, ignoring capitals and spaces', async ({ page }) => {
    let posted = false;
    await page.route('**/api/accounts', route => {
      if (route.request().method() === 'POST') posted = true;
      return route.fallback();
    });

    await page.getByLabel('Account name').fill('  roth   ira ');
    await expect(page.getByText('You already have an account called "Roth IRA". Choose a different name.')).toBeVisible();

    await page.getByLabel('Initial deposit').fill('100');
    await page.getByRole('button', { name: 'Add account' }).click();
    expect(posted).toBe(false);
    await expect(page).toHaveURL(/\/accounts\/new$/);
  });

  test('marks the account types the client already has', async ({ page }) => {
    const rothTile = page.getByRole('button', { name: /^Roth IRA/ });
    await expect(rothTile).toContainText('You already have one');
    await expect(page.getByRole('button', { name: /^HSA/ })).not.toContainText('You already have one');

    await rothTile.click();
    await expect(page.getByText(/You already have an account called "Roth IRA"/)).toBeVisible();
  });

  test('allows a new name', async ({ page }) => {
    let sent: unknown;
    await page.route('**/api/accounts', route => {
      if (route.request().method() !== 'POST') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({ status: 201, json: { accountId: 'dddddddd-dddd-4ddd-8ddd-dddddddddddd', clientId: CLIENT_ID, name: 'HSA', cashBalance: 100, status: 'ACTIVE', openDate: '' } });
    });

    await page.getByLabel('Account name').fill('HSA');
    await expect(page.getByText(/You already have an account called/)).toHaveCount(0);
    await page.getByLabel('Initial deposit').fill('100');
    await page.getByRole('button', { name: 'Add account' }).click();

    await expect.poll(() => sent).toMatchObject({ name: 'HSA', initialCashBalance: 100 });
  });
});

test.describe('Unique account names: Rename', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsClient(page, [ROTH, SAVINGS]);
    await openAccountFromSidebar(page, ROTH);
  });

  test("can't rename to another account's name", async ({ page }) => {
    let saved = false;
    await page.route(`**/api/accounts/${ROTH.accountId}`, route => {
      if (route.request().method() === 'PUT') saved = true;
      return route.fallback();
    });

    await page.getByRole('button', { name: 'Rename account' }).click();
    await page.getByLabel('Account name').fill('college savings');

    await expect(page.getByRole('alert')).toHaveText('You already have an account called "College Savings". Choose a different name.');
    await expect(page.getByRole('button', { name: 'Save' })).toBeDisabled();
    await page.getByLabel('Account name').press('Enter');
    expect(saved).toBe(false);
  });

  test('can keep its own name with different capitals', async ({ page }) => {
    let sent: unknown;
    await page.route(`**/api/accounts/${ROTH.accountId}`, route => {
      if (route.request().method() !== 'PUT') return route.fallback();
      sent = route.request().postDataJSON();
      return route.fulfill({ json: { accountId: ROTH.accountId, clientId: CLIENT_ID, name: 'ROTH IRA', cashBalance: 100, status: 'ACTIVE', openDate: '' } });
    });

    await page.getByRole('button', { name: 'Rename account' }).click();
    await page.getByLabel('Account name').fill('ROTH IRA');
    await expect(page.getByRole('alert')).toHaveCount(0);
    await page.getByRole('button', { name: 'Save' }).click();

    expect(sent).toEqual({ name: 'ROTH IRA' });
    await expect(page.getByRole('heading', { level: 2, name: 'ROTH IRA' })).toBeVisible();
  });
});
