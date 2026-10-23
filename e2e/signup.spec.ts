import { readFileSync } from 'node:fs';
import type { Page } from '@playwright/test';
// test/expect from helpers.ts block any middleware/backend call a test hasn't faked
import { expect, test } from './helpers';
import { AGREEMENT_TITLE, AGREEMENT_VERSION } from '../src/app/core/client-agreement';

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

/** Opens the full agreement (a new tab, closed again straight away) so the box can be ticked */
async function openAgreementLink(page: Page) {
  const dialog = page.getByRole('dialog', { name: AGREEMENT_TITLE });
  const [tab] = await Promise.all([
    page.context().waitForEvent('page'),
    dialog.getByRole('link', { name: new RegExp(AGREEMENT_TITLE) }).click()
  ]);
  await tab.close();
}

/** Opens the agreement, ticks the box in the pop-up and confirms */
async function acceptAgreement(page: Page) {
  const dialog = page.getByRole('dialog', { name: AGREEMENT_TITLE });
  await openAgreementLink(page);
  await dialog.getByRole('checkbox').check();
  await dialog.getByRole('button', { name: 'Agree and create account' }).click();
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
    await acceptAgreement(page);

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
    await acceptAgreement(page);
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

  test('shows the account agreement before creating the account, and only allows Yes once ticked', async ({ page }) => {
    let posted = false;
    await page.route('**/api/v1/auth/signup', route => { posted = true; return route.abort(); });

    await page.goto('/signup');
    await fillPersonalDetails(page);
    await page.getByText('Moderate', { exact: true }).click();
    await page.getByText('Under $50K', { exact: true }).click();
    await page.getByRole('button', { name: 'Create account' }).click();

    const dialog = page.getByRole('dialog', { name: AGREEMENT_TITLE });
    await expect(dialog).toBeVisible();
    // The full agreement opens in a new tab so the form isn't lost
    const link = dialog.getByRole('link', { name: new RegExp(AGREEMENT_TITLE) });
    await expect(link).toHaveAttribute('href', '/agreement');
    await expect(link).toHaveAttribute('target', '_blank');

    const agree = dialog.getByRole('button', { name: 'Agree and create account' });
    await expect(agree).toBeDisabled();
    // The box is locked until the full agreement has been opened
    await expect(dialog.getByRole('checkbox')).toBeDisabled();
    await expect(dialog.getByText(/before you can agree/)).toBeVisible();
    await openAgreementLink(page);
    await expect(dialog.getByRole('checkbox')).toBeEnabled();
    await expect(dialog.getByText(/before you can agree/)).toBeHidden();
    await dialog.getByRole('checkbox').check();
    await expect(agree).toBeEnabled();
    await dialog.getByRole('checkbox').uncheck();
    await expect(agree).toBeDisabled();
    expect(posted).toBe(false);
  });

  test('Cancel or Esc closes the agreement without signing up, and it starts over next time', async ({ page }) => {
    let posted = false;
    await page.route('**/api/v1/auth/signup', route => { posted = true; return route.abort(); });

    await page.goto('/signup');
    await fillPersonalDetails(page);
    await page.getByText('Moderate', { exact: true }).click();
    await page.getByText('Under $50K', { exact: true }).click();
    const dialog = page.getByRole('dialog', { name: AGREEMENT_TITLE });

    await page.getByRole('button', { name: 'Create account' }).click();
    await openAgreementLink(page);
    await dialog.getByRole('checkbox').check();
    await dialog.getByRole('button', { name: 'Cancel' }).click();
    await expect(dialog).toBeHidden();

    // Reopening starts over: unticked, and locked until the agreement is opened again
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(dialog.getByRole('checkbox')).not.toBeChecked();
    await expect(dialog.getByRole('checkbox')).toBeDisabled();
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();

    expect(posted).toBe(false);
  });

  test('an invalid form never opens the agreement', async ({ page }) => {
    await page.goto('/signup');
    await page.getByRole('button', { name: 'Create account' }).click();
    await expect(page.getByRole('dialog', { name: AGREEMENT_TITLE })).toBeHidden();
  });
});

test.describe('Account agreement page', () => {
  test('shows the full agreement from agreement.txt without logging in, with no sidebar', async ({ page }) => {
    await page.goto('/agreement');

    await expect(page.getByRole('heading', { level: 1, name: 'CUSTOMER ACCOUNT AGREEMENT' })).toBeVisible();
    await expect(page.getByText('Version: 2.0')).toBeVisible();
    // 20 numbered sections plus Amendments and Contact Information
    await expect(page.locator('article section')).toHaveCount(22);
    await expect(page.getByRole('heading', { name: /DISPUTE RESOLUTION & ARBITRATION/ })).toBeVisible();
    await expect(page.getByRole('heading', { name: '2.1 SINGLE INSTRUMENT MAXIMUM' })).toBeVisible();
    await expect(page.locator('.checklist li')).toHaveCount(16);
    await expect(page.getByRole('link', { name: 'Download (.txt)' })).toHaveAttribute('href', '/assets/agreement.txt');
    await expect(page.getByRole('navigation', { name: 'Main navigation' })).toHaveCount(0);
  });

  test('table of contents jumps to a section', async ({ page }) => {
    await page.goto('/agreement');
    await page.getByRole('navigation', { name: 'Sections' }).getByRole('link', { name: /CONTACT INFORMATION/ }).click();
    await expect(page.locator('#contact-information')).toBeInViewport();
  });

  test('the version shown in the pop-up matches agreement.txt', () => {
    const text = readFileSync('src/assets/agreement.txt', 'utf8');
    const fileVersion = text.match(/^VERSION:\s*(\S+)/m)?.[1];
    // If this fails, update AGREEMENT_VERSION in src/app/core/client-agreement.ts (and re-check the summary)
    expect(AGREEMENT_VERSION).toBe(fileVersion);
  });
});

test.describe('Sign up password eyes', () => {
  test('Password and Confirm password each have their own eye, which closes while the text shows', async ({ page }) => {
    await page.goto('/signup');
    const password = page.locator('input[formcontrolname="password"]');
    const confirm = page.locator('input[formcontrolname="confirmPassword"]');
    const showPassword = page.getByRole('button', { name: 'Show password', exact: true });
    const showConfirm = page.getByRole('button', { name: 'Show confirm password' });

    // Open eyes, text hidden
    await expect(password).toHaveAttribute('type', 'password');
    await expect(confirm).toHaveAttribute('type', 'password');
    await expect(showPassword.locator('svg.open')).toBeVisible();

    // Clicking shows only that box's text, and its eye closes
    await showPassword.click();
    await expect(password).toHaveAttribute('type', 'text');
    await expect(confirm).toHaveAttribute('type', 'password');
    const hidePassword = page.getByRole('button', { name: 'Hide password', exact: true });
    await expect(hidePassword).toHaveAttribute('aria-pressed', 'true');
    await expect(hidePassword.locator('svg.closed')).toBeVisible();

    await showConfirm.click();
    await expect(confirm).toHaveAttribute('type', 'text');

    // And back again
    await hidePassword.click();
    await expect(password).toHaveAttribute('type', 'password');
    await expect(showPassword.locator('svg.open')).toBeVisible();
  });
});
