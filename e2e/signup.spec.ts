import { expect, Page, test } from '@playwright/test';

// The signup POST is answered by a fake middleware here, so nothing is written to the database
async function fillPersonalDetails(page: Page) {
  await page.getByLabel(/^First name/).fill('Jane');
  await page.getByLabel(/^Last name/).fill('Doe');
  await page.getByLabel(/^Email/).fill('jane.doe@example.com');
  await page.getByLabel(/^Date of birth/).fill('1990-01-15');
  await page.getByLabel(/^Social Security number/).fill('123456789');
  await page.getByLabel(/^Password/).fill('Str0ng!Pass');
  await page.getByLabel(/^Confirm password/).fill('Str0ng!Pass');
}

test.describe('Sign up', () => {
  test('has no phone field, and asks for risk level and portfolio size', async ({ page }) => {
    await page.goto('/signup');

    await expect(page.getByLabel(/phone/i)).toHaveCount(0);
    await expect(page.getByRole('radiogroup', { name: /Risk level/ })).toBeVisible();
    await expect(page.getByRole('radiogroup', { name: /Portfolio size/ })).toBeVisible();
    await expect(page.getByRole('radio')).toHaveCount(3 + 5);
  });

  test('sends risk level and portfolio size (and no phone number) to the middleware', async ({ page }) => {
    let sent: Record<string, unknown> | undefined;
    await page.route('**/api/v1/auth/signup', route => {
      sent = route.request().postDataJSON();
      return route.fulfill({
        status: 201,
        json: { success: true, message: 'Account created successfully. Please log in with your credentials.', clientId: 'x', email: 'jane.doe@example.com' }
      });
    });

    await page.goto('/signup');
    await fillPersonalDetails(page);
    await page.getByText('Aggressive', { exact: true }).click();
    await page.getByText('$100K – $200K', { exact: true }).click();
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByRole('heading', { name: 'Account created' })).toBeVisible();
    // Middle name was left blank, so it isn't sent at all
    expect(sent).toEqual({
      email: 'jane.doe@example.com',
      password: 'Str0ng!Pass',
      firstName: 'Jane',
      lastName: 'Doe',
      dateOfBirth: '1990-01-15',
      ssn: '123456789',
      riskTolerance: 'AGGRESSIVE',
      portfolioSizeRange: 'BETWEEN_100K_200K'
    });
  });

  test('sends the middle name only when it is filled in', async ({ page }) => {
    const bodies: Record<string, unknown>[] = [];
    await page.route('**/api/v1/auth/signup', route => {
      bodies.push(route.request().postDataJSON());
      return route.fulfill({ status: 201, json: { success: true, message: 'ok', clientId: 'x', email: 'jane.doe@example.com' } });
    });

    await page.goto('/signup');
    await fillPersonalDetails(page);
    await page.getByLabel(/^Middle name/).fill('  Marie ');
    await page.getByText('Moderate', { exact: true }).click();
    await page.getByText('Under $50K', { exact: true }).click();
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('heading', { name: 'Account created' })).toBeVisible();

    expect(bodies[0]['middleName']).toBe('Marie');
  });

  test('will not submit until a risk level and portfolio size are chosen', async ({ page }) => {
    let posted = false;
    await page.route('**/api/v1/auth/signup', route => { posted = true; return route.abort(); });

    await page.goto('/signup');
    await fillPersonalDetails(page);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page.getByText('Choose a risk level')).toBeVisible();
    await expect(page.getByText('Choose a portfolio size')).toBeVisible();
    expect(posted).toBe(false);
  });
});
