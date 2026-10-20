import { expect, Locator, Page, test } from '@playwright/test';

// Fake backend so this runs without agents-backend
const PROFILE = {
  client_id: 'aa0e8400-e29b-41d4-a716-446655440001',
  firstName: 'John',
  lastName: 'Trader',
  email: 'john.trader@example.com',
  phone: '(202) 555-0123',
  country: 'United States',
  email_verified: true,
  date_of_birth: '1990-04-12',
  join_date: '2025-01-15T10:00:00',
  accounts: []
};

async function mockProfile(page: Page, onPut?: (body: unknown) => { status: number; json?: unknown }) {
  await page.route('**/users/me', async route => {
    if (route.request().method() === 'PUT') {
      const reply = onPut?.(route.request().postDataJSON()) ?? { status: 404 };
      return route.fulfill(reply);
    }
    return route.fulfill({ json: PROFILE });
  });
}

/** The CSS hover label (::after) is showing with this text */
async function expectTip(el: Locator, text: string) {
  await el.hover();
  await expect.poll(() => el.evaluate(e => getComputedStyle(e, '::after').opacity)).toBe('1');
  expect(await el.evaluate(e => getComputedStyle(e, '::after').content)).toBe(`"${text}"`);
}

test.describe('Header buttons', () => {
  test('theme button says the mode it switches to, and settings says Settings', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/dashboard');

    const themeBtn = page.getByRole('button', { name: 'Switch to dark mode' });
    await expectTip(themeBtn, 'Switch to dark mode');
    await themeBtn.click();
    await expectTip(page.getByRole('button', { name: 'Switch to light mode' }), 'Switch to light mode');

    const gear = page.getByRole('link', { name: 'Settings' });
    await expectTip(gear, 'Settings');
    await gear.click();
    await expect(page).toHaveURL(/\/settings$/);
  });

  test('no settings gear on the login page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('link', { name: 'Settings' })).toHaveCount(0);
  });
});

test.describe('Settings page', () => {
  test('loads the client and saves edits', async ({ page }) => {
    let sent: unknown;
    await mockProfile(page, body => {
      sent = body;
      return { status: 200, json: { ...PROFILE, ...(body as object) } };
    });

    await page.goto('/settings');
    await expect(page.getByLabel('First name')).toHaveValue('John');
    await expect(page.getByLabel('Email')).toHaveValue('john.trader@example.com');

    await page.getByLabel('Last name').fill('Trader-Smith');
    await page.getByLabel('Phone').fill('(202) 555-0199');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Your changes were saved.')).toBeVisible();
    expect(sent).toEqual({
      firstName: 'John', lastName: 'Trader-Smith', email: 'john.trader@example.com',
      phone: '(202) 555-0199', country: 'United States'
    });
  });

  test('explains when the backend cannot save yet', async ({ page }) => {
    await mockProfile(page, () => ({ status: 405 }));

    await page.goto('/settings');
    await page.getByLabel('First name').fill('Johnny');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('alert')).toHaveText("The server can't save profile changes yet.");
  });

  test('appearance switches between light and dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockProfile(page);
    await page.goto('/settings');

    await page.getByText('Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();

    await page.getByText('Light', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
