import { expect, test } from './helpers';

test.describe('Public landing page', () => {
  test('welcomes visitors without authentication and links to login', async ({ page }) => {
    const backendRequests: string[] = [];
    page.on('request', request => {
      if (new URL(request.url()).pathname.startsWith('/api/')) backendRequests.push(request.url());
    });
    await page.goto('/');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.getByRole('heading', { name: 'Your money. Your next chapter. Your S.T.A.S.H.' })).toBeVisible();
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Settings', exact: true })).toHaveCount(0);
    await page.getByRole('link', { name: 'Get to know us' }).click();
    await expect(page.locator('#about-us')).toBeInViewport();
    await expect(page.locator('#about-us')).toBeFocused();
    expect(backendRequests).toEqual([]);
    const login = page.getByRole('link', { name: 'Login', exact: true });
    await expect(login).toHaveText('Login');
    await login.click();
    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByRole('button', { name: 'Log in', exact: true })).toBeVisible();
  });

  test('offers signup and respects the shared theme', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
    await expect(page.getByRole('heading', { name: 'Make space for your financial future.' })).toBeVisible();
    await page.getByRole('link', { name: 'Sign up', exact: true }).click();
    await expect(page).toHaveURL(/\/signup$/);
  });

  test('keeps login at the top right on mobile with no horizontal overflow', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/?welcome=1');
    const login = page.getByRole('link', { name: 'Login', exact: true });
    await expect(login).toBeVisible();
    const bounds = await login.boundingBox();
    expect(bounds).not.toBeNull();
    expect(bounds!.x).toBeGreaterThan(200);
    expect(bounds!.y).toBeLessThan(60);
    await expect(page.getByRole('link', { name: 'Sign up', exact: true })).toBeInViewport();
    expect(await page.locator('main').evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    await page.getByRole('link', { name: 'Get to know us' }).click();
    await expect(page.locator('#about-us')).toBeInViewport();
    await expect(login).toBeInViewport();
  });
});