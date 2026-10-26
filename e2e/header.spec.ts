import { expect, test, loginAsClient } from './helpers';

test.describe('Header', () => {
  test('market status, session timer, light/dark, then settings, then Logout on the far right', async ({ page }) => {
    await loginAsClient(page, []);

    const actions = page.locator('.header-actions > :not(app-session-timer, app-market-status), .header-actions > app-session-timer > .timer, .header-actions > app-market-status > .market');
    await expect(actions).toHaveCount(5);
    await expect(actions.nth(0)).toHaveText(/^Market (open|closed)$/);
    await expect(actions.nth(1)).toHaveAttribute('role', 'timer');
    await expect(actions.nth(2)).toHaveAttribute('aria-label', /Switch to (light|dark) mode/);
    await expect(actions.nth(3)).toHaveAttribute('aria-label', 'Settings');
    await expect(actions.nth(4)).toHaveText('Logout');
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

  test("a client's home page is /home, and the old /client address redirects there", async ({ page }) => {
    await loginAsClient(page, []);
    await expect(page).toHaveURL(/\/home$/);
    await expect(page.getByRole('heading', { level: 2, name: 'Dashboard', exact: true })).toBeVisible();
    // The sidebar link to it is called Dashboard
    await expect(page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Dashboard', exact: true })).toHaveAttribute('href', '/home');

    await page.goto('/client');
    await expect(page).toHaveURL(/\/home$/);
  });

  test('the dashboard scrolls when the window is too short to show it all', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 600 });
    await loginAsClient(page, []);
    const dashboard = page.locator('app-dashboard');
    await expect(page.getByRole('heading', { name: 'Market Movers' })).not.toBeInViewport();

    await dashboard.hover();
    await page.mouse.wheel(0, 2000);

    await expect.poll(() => dashboard.evaluate(e => e.scrollTop)).toBeGreaterThan(0);
    await expect(page.getByRole('heading', { name: 'Market Movers' })).toBeInViewport();
  });
});
