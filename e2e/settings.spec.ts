import { expect, Locator, Page, test } from '@playwright/test';

// Fake backend so this runs without agents-backend
const CLIENT_ID = 'aa0e8400-e29b-41d4-a716-446655440001';
const CLIENT = {
  clientId: CLIENT_ID,
  firstName: 'John',
  middleName: null,
  lastName: 'Trader',
  email: 'john.trader@example.com',
  riskTolerance: 'MODERATE',
  portfolioSizeRange: 'BETWEEN_50K_100K'
};

async function mockClient(page: Page, onPatch?: (body: Record<string, unknown>) => { status: number; json?: unknown }) {
  await page.route(`**/api/client/v1/${CLIENT_ID}`, async route => {
    if (route.request().method() === 'PATCH') {
      return route.fulfill(onPatch?.(route.request().postDataJSON()) ?? { status: 500 });
    }
    return route.fulfill({ json: CLIENT });
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
  test('shows the get-client data (no client ID) and marks what can be edited', async ({ page }) => {
    await mockClient(page);
    await page.goto('/settings');

    // Client ID is not shown; name and email are, and email is marked read-only
    await expect(page.getByText(CLIENT_ID)).toHaveCount(0);
    await expect(page.locator('.identity')).toContainText('John Trader');
    await expect(page.locator('.identity .avatar')).toHaveText('JT');
    const email = page.locator('.identity .email');
    await expect(email).toContainText('john.trader@example.com');
    await expect(email.locator('.tag.lock')).toHaveText('Read-only');

    // Values show as plain text (no text boxes) until Edit is pressed
    const values = page.locator('.value');
    await expect(values).toHaveText(['John', 'Not set', 'Trader', 'Moderate', '$50K – $100K']);
    await expect(page.locator('form input')).toHaveCount(0);
    for (const name of ['first name', 'middle name', 'last name', 'risk tolerance', 'portfolio size']) {
      await expect(page.getByRole('button', { name: `Edit ${name}` })).toBeVisible();
    }
    // No Save/Cancel until something is being edited
    await expect(page.getByRole('button', { name: 'Save changes' })).toHaveCount(0);
  });

  test('Edit opens just that field, and Cancel closes it without saving', async ({ page }) => {
    let patched = false;
    await mockClient(page, () => { patched = true; return { status: 200, json: CLIENT }; });
    await page.goto('/settings');

    await page.getByRole('button', { name: 'Edit first name' }).click();
    const first = page.getByLabel('First name', { exact: true });
    await expect(first).toBeFocused();
    await expect(first).toHaveValue('John');
    await expect(page.getByLabel('Last name', { exact: true })).toHaveCount(0);

    await first.fill('Changed');
    await page.getByRole('button', { name: 'Cancel' }).click();
    await expect(page.locator('.value').first()).toHaveText('John');
    await expect(page.getByRole('button', { name: 'Edit first name' })).toBeVisible();
    expect(patched).toBe(false);
  });

  test('saves only the fields that changed', async ({ page }) => {
    let sent: Record<string, unknown> | undefined;
    await mockClient(page, body => {
      sent = body;
      return { status: 200, json: { ...CLIENT, ...body } };
    });

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit middle name' }).click();
    await page.getByLabel('Middle name', { exact: true }).fill('Q');
    await page.getByRole('button', { name: 'Edit risk tolerance' }).click();
    await page.getByText('Aggressive', { exact: true }).click();
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('Your changes were saved.')).toBeVisible();
    expect(sent).toEqual({ middleName: 'Q', riskTolerance: 'AGGRESSIVE' });
    // Back to plain text, showing the saved values
    await expect(page.locator('.value')).toHaveText(['John', 'Q', 'Trader', 'Aggressive', '$50K – $100K']);
  });

  test('shows the reason when the backend rejects a change', async ({ page }) => {
    await mockClient(page, () => ({ status: 400, json: { message: 'Last name cannot be blank' } }));

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit first name' }).click();
    await page.getByLabel('First name', { exact: true }).fill('Johnny');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByRole('alert')).toHaveText("Couldn't save: Last name cannot be blank");
  });

  test('a blank first name is not sent', async ({ page }) => {
    let patched = false;
    await mockClient(page, () => { patched = true; return { status: 200, json: CLIENT }; });

    await page.goto('/settings');
    await page.getByRole('button', { name: 'Edit first name' }).click();
    await page.getByLabel('First name', { exact: true }).fill('   ');
    await page.getByRole('button', { name: 'Save changes' }).click();

    await expect(page.getByText('First name is required')).toBeVisible();
    expect(patched).toBe(false);
  });

  test('appearance switches between light and dark', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await mockClient(page);
    await page.goto('/settings');

    await page.getByText('Dark', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('radio', { name: 'Dark' })).toBeChecked();

    await page.getByText('Light', { exact: true }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  });
});
