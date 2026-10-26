import { marketStatus } from '../src/app/core/market-hours';
import { test, expect, loginAsClient } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };

test.describe('Market hours rules', () => {
  // Times are given in UTC; New York is UTC-4 until Nov 1, 2026 and UTC-5 after
  const cases: [string, string, boolean, string][] = [
    ['weekday before the open', '2026-10-26T12:00:00Z', false, 'Opens today 9:30 AM ET'],
    ['right at the open', '2026-10-26T13:30:00Z', true, 'Closes 4:00 PM ET'],
    ['weekday afternoon', '2026-10-26T19:59:00Z', true, 'Closes 4:00 PM ET'],
    ['right at the close', '2026-10-26T20:00:00Z', false, 'Opens tomorrow 9:30 AM ET'],
    ['Friday evening', '2026-10-30T22:00:00Z', false, 'Opens Monday 9:30 AM ET'],
    ['Saturday', '2026-10-31T16:00:00Z', false, 'Opens Monday 9:30 AM ET'],
    ['Thanksgiving (holiday)', '2026-11-26T16:00:00Z', false, 'Opens tomorrow 9:30 AM ET'],
    ['day after Thanksgiving, before the early close', '2026-11-27T17:30:00Z', true, 'Closes 1:00 PM ET'],
    ['day after Thanksgiving, after the early close', '2026-11-27T18:30:00Z', false, 'Opens Monday 9:30 AM ET'],
    ['Christmas Eve, after the early close', '2026-12-24T19:00:00Z', false, 'Opens Monday 9:30 AM ET']
  ];
  for (const [name, iso, open, detail] of cases) {
    test(name, () => {
      expect(marketStatus(new Date(iso))).toEqual({ open, detail });
    });
  }
});

test.describe('Market status badge', () => {
  test('shows in the header once logged in, and matches the Trades page', async ({ page }) => {
    await page.goto('/login');
    await expect(page.getByRole('status').filter({ hasText: /^Market (open|closed)$/ })).toHaveCount(0);

    await loginAsClient(page, [account]);
    const expected = marketStatus(new Date());
    const badge = page.locator('app-market-status .market');
    await expect(badge).toHaveText(expected.open ? 'Market open' : 'Market closed');
    await expect(badge).toHaveAttribute('data-tip', `US stock market · ${expected.detail}`);
    // First in the header actions, before the session timer
    const boxes = await page.evaluate(() => ['app-market-status .market', '.timer'].map(s => document.querySelector(s)!.getBoundingClientRect().x));
    expect(boxes[0]).toBeLessThan(boxes[1]);

    await page.route('**/api/instruments', route => route.fulfill({ json: { results: [] } }));
    await page.goto(`/trades/${account.accountId}`);
    await expect(page.locator('.market-bar strong')).toHaveText(expected.open ? 'Markets open' : 'Markets closed');
  });
});
