import { expect, test } from '@playwright/test';

test.describe('Login', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    // The app opens on the login page
    await expect(page).toHaveURL(/\/login$/);
  });

  test('takes the user to the dashboard after logging in', async ({ page }) => {
    await page.getByLabel('Email').fill('jane@example.com');
    // The label also wraps the Show/Hide button, so its name starts with "Password" but isn't exactly that
    await page.getByLabel(/^Password/).fill('Secret123!');
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: 'Trading Dashboard' })).toBeVisible();
    // The sidebar is back once the user is past the login page
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toBeVisible();
  });

  test('stays on the login page when the form is empty', async ({ page }) => {
    await page.getByRole('button', { name: 'Log in' }).click();

    await expect(page).toHaveURL(/\/login$/);
    await expect(page.getByText('Enter a valid email address')).toBeVisible();
    await expect(page.getByText('Enter your password')).toBeVisible();
  });
});
