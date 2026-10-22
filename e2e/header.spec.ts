import { expect, test } from '@playwright/test';
import { loginAsClient } from './helpers';

test.describe('Header', () => {
  test('light/dark, then settings, then Logout on the far right', async ({ page }) => {
    await loginAsClient(page, []);

    const actions = page.locator('.header-actions > *');
    await expect(actions).toHaveCount(3);
    await expect(actions.nth(0)).toHaveAttribute('aria-label', /Switch to (light|dark) mode/);
    await expect(actions.nth(1)).toHaveAttribute('aria-label', 'Settings');
    await expect(actions.nth(2)).toHaveText('Logout');
  });

  test('Logout ends the session and returns to the login page', async ({ page }) => {
    let loggedOut = false;
    await page.route('**/api/v1/auth/logout', route => { loggedOut = true; return route.fulfill({ status: 204 }); });
    await loginAsClient(page, []);

    await page.getByRole('button', { name: 'Logout' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect.poll(() => loggedOut).toBe(true);
    await expect(page.getByRole('button', { name: 'Logout' })).toHaveCount(0);
  });
});
