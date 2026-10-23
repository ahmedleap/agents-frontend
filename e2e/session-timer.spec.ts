import { Page } from '@playwright/test';
import { test, expect, loginAsClient, CLIENT_ID } from './helpers';

const accounts = [{ accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' }];

/** An access token for the logged-in test client that expires 15 minutes after the page's (fake) clock */
async function freshToken(page: Page): Promise<string> {
  const now = await page.evaluate(() => Date.now());
  const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString('base64url');
  const claims = { sub: CLIENT_ID, email: 'jane@example.com', role: 'CLIENT', exp: Math.floor(now / 1000) + 900 };
  return `${encode({ alg: 'RS256', typ: 'JWT' })}.${encode(claims)}.test-signature`;
}

test.describe('Session timer', () => {
  test.beforeEach(async ({ page }) => {
    // Fake clock, so the tests can jump ahead instead of waiting 15 minutes
    await page.clock.install();
  });

  test('is hidden on the login page and counts down the access token once logged in', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('timer')).toHaveCount(0);

    await loginAsClient(page, accounts);
    const timer = page.getByRole('timer');
    await expect(timer).toBeVisible();
    // The test login token lasts 15 minutes
    await expect(timer).toContainText(/^1[45]:\d\d$/);

    // It sits just left of the light/dark button
    const header = page.locator('.header-actions');
    const timerBox = await timer.boundingBox();
    const themeBox = await header.getByRole('button', { name: /Switch to (dark|light) mode/ }).boundingBox();
    expect(timerBox!.x).toBeLessThan(themeBox!.x);

    await page.clock.fastForward('05:00');
    await expect(timer).toContainText(/^(9|10):\d\d$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
  });

  test('warns at one minute, and Refresh session gets a new token and restarts the timer', async ({ page }) => {
    await loginAsClient(page, accounts);
    let refreshBody: unknown;
    await page.route('**/api/v1/auth/refresh', async route => {
      refreshBody = route.request().postDataJSON();
      await route.fulfill({ json: { accessToken: await freshToken(page), refreshToken: 'test-refresh-token-2', expiresIn: 900 } });
    });

    await page.clock.fastForward('14:05');
    const dialog = page.getByRole('alertdialog', { name: 'Are you still there?' });
    await expect(dialog).toBeVisible();
    await expect(dialog).toContainText('you will be logged out');
    await expect(page.getByRole('timer')).toContainText(/^0:\d\d$/);

    await dialog.getByRole('button', { name: 'Refresh session' }).click();
    await expect(dialog).toHaveCount(0);
    expect(refreshBody).toEqual({ clientId: CLIENT_ID, refreshToken: 'test-refresh-token' });
    await expect(page.getByRole('timer')).toContainText(/^1[45]:\d\d$/);
    await expect(page).toHaveURL(/\/home$/);
  });

  test('logs out at zero when the session is not refreshed', async ({ page }) => {
    await loginAsClient(page, accounts);
    let logoutBody: unknown;
    await page.route('**/api/v1/auth/logout', route => {
      logoutBody = route.request().postDataJSON();
      return route.fulfill({ json: { success: true } });
    });

    await page.clock.fastForward('14:05');
    await expect(page.getByRole('alertdialog')).toBeVisible();
    await page.clock.fastForward('01:00');

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(page.getByRole('timer')).toHaveCount(0);
    expect(logoutBody).toEqual({ clientId: CLIENT_ID, refreshToken: 'test-refresh-token' });

    // The session is gone, so app pages send you back to log in
    await page.goto('/home');
    await expect(page).toHaveURL(/\/login(\?|$)/);
  });

  test('Log out now in the warning ends the session straight away', async ({ page }) => {
    await loginAsClient(page, accounts);
    await page.route('**/api/v1/auth/logout', route => route.fulfill({ json: { success: true } }));

    await page.clock.fastForward('14:30');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Log out now' }).click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('timer')).toHaveCount(0);
  });

  test('a failed refresh sends you to log in', async ({ page }) => {
    await loginAsClient(page, accounts);
    await page.route('**/api/v1/auth/refresh', route => route.fulfill({ status: 401, json: { message: 'Session expired' } }));

    await page.clock.fastForward('14:30');
    await page.getByRole('alertdialog').getByRole('button', { name: 'Refresh session' }).click();
    await expect(page).toHaveURL(/\/login$/);
  });
});
