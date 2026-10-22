import { expect, test } from '@playwright/test';

test('analyst dashboard URL and header resolve to analytics, including reload', async ({ page }) => {
  // Synthetic UI session only; no real credentials or backend access are used.
  await page.addInitScript(() => {
    const user = { clientId: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc', email: 'analyst@example.com', role: 'ANALYST' };
    const claims = { sub: user.clientId, email: user.email, role: user.role, exp: Math.floor(Date.now() / 1000) + 900 };
    const accessToken = `${btoa(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))}.${btoa(JSON.stringify(claims))}.test-signature`;
    sessionStorage.setItem('stash-auth-session', JSON.stringify({ user, accessToken, refreshToken: 'test-refresh-token' }));
  });
  await page.route('**/api/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));

  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
  await expect(page.getByRole('navigation').getByRole('link')).toHaveText(['Analysis']);
  await expect(page.locator('.logo-link')).toHaveAttribute('href', '/analytics');

  await page.reload();
  await expect(page).toHaveURL(/\/analytics$/);
  await expect(page.getByRole('heading', { name: 'Analytics Dashboard', exact: true })).toBeVisible();
  await page.locator('.logo-link').click();
  await expect(page).toHaveURL(/\/analytics$/);
});

test('unauthenticated dashboard visit reaches login without a redirect loop', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login$/);
});