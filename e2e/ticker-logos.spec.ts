import { test, expect, loginAsClient } from './helpers';

const account = { accountId: '11111111-1111-4111-8111-111111111111', name: 'Brokerage' };
// 1x1 black PNG, and a white-on-transparent one (like ABBV's real logo)
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=', 'base64');
const whitePng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAEUlEQVR4nGP4////fwYGBgYAGe8D/ZYSdisAAAAASUVORK5CYII=', 'base64');
// 3x3: a black dot on a solid white square (like AAPL's real logo)
const onWhiteSquare = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAMAAAADCAYAAABWKLW/AAAAGUlEQVR4nGP8////fwYoYAIRjIyMCA5MEgCnMQcCX3ts6AAAAABJRU5ErkJggg==', 'base64');
// 6x6: a white tile with rounded (see-through) corners and a see-through hole in the middle (like ADI's real logo)
const whiteTile = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAYAAAAGCAYAAADgzO9IAAAAK0lEQVR4nGNkYGBg+P///38QDQOMIIAuCANMKKoYGRkxJNABbqOQtSMbCwDp3wwSjMXvYQAAAABJRU5ErkJggg==', 'base64');

test.describe('Ticker logos', () => {
  test('cards show the logo when there is one, and keep the letter badge when there is not', async ({ page }) => {
    const asked: string[] = [];
    await page.route('https://financialmodelingprep.com/image-stock/**', route => {
      const file = new URL(route.request().url()).pathname.split('/').pop()!;
      asked.push(file);
      const headers = { 'Access-Control-Allow-Origin': '*' };
      if (file === 'AAPL.png' || file === 'BTCUSD.png') return route.fulfill({ contentType: 'image/png', headers, body: png });
      if (file === 'ABBV.png') return route.fulfill({ contentType: 'image/png', headers, body: whitePng });
      if (file === 'MSFT.png') return route.fulfill({ contentType: 'image/png', headers, body: onWhiteSquare });
      if (file === 'ADI.png') return route.fulfill({ contentType: 'image/png', headers, body: whiteTile });
      return route.fulfill({ status: 404, body: 'Not found' });
    });
    await loginAsClient(page, [account]);
    const listed = [
      { ticker: 'AAPL', assetClass: 'EQUITY' }, { ticker: 'NOLOGO', assetClass: 'EQUITY' },
      { ticker: 'BTC-USD', assetClass: 'CRYPTO' }, { ticker: 'ABBV', assetClass: 'EQUITY' },
      { ticker: 'MSFT', assetClass: 'EQUITY' }, { ticker: 'ADI', assetClass: 'EQUITY' }
    ];
    await page.route('**/api/instruments', route => route.fulfill({
      json: { results: listed.map(i => ({ instrumentId: `id-${i.ticker}`, name: `${i.ticker} name`, ...i })) }
    }));
    await page.route(/\/api\/instruments\/[^/]+\/quote$/, route => route.fulfill({ json: { lastPrice: 10, priceChange: 0, priceChangePercent: 0 } }));
    await page.route(/\/api\/instruments\/[^/]+\/history/, route => route.fulfill({ json: { bars: [] } }));
    await page.goto(`/trades/${account.accountId}`);

    const card = (ticker: string) => page.locator('.instrument-card').filter({ hasText: ticker }).first();
    await expect(card('AAPL').locator('img.ticker-logo')).toHaveClass(/loaded/);
    await expect(card('AAPL').locator('img.ticker-logo')).not.toHaveClass(/light/);
    // The letter circle behind a logo is hidden, so the logo sits straight on the card
    await expect(card('AAPL').locator('.symbol-badge')).toHaveClass(/has-logo/);
    await expect(card('AAPL').locator('.symbol-badge')).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    // BTC-USD is looked up as BTCUSD
    await expect(card('BTC-USD').locator('img.ticker-logo')).toHaveClass(/loaded/);
    // A single-colour (white) logo is drawn in black on the light theme, with no circle behind it
    const white = card('ABBV').locator('img.ticker-logo');
    await expect(white).toHaveClass(/loaded/);
    await expect(white).toHaveClass(/mono/);
    await expect(white).toHaveCSS('filter', 'brightness(0)');
    await expect(white).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)');
    // A logo on a white square has the square cut out: the copy shown is a transparent PNG of the black
    // mark, recoloured to suit the theme
    const squared = card('MSFT').locator('img.ticker-logo');
    await expect(squared).toHaveClass(/loaded/);
    await expect(squared).toHaveAttribute('src', /^data:image\/png/);
    await expect(squared).toHaveClass(/mono/);
    // A white tile with the mark cut out of it: the cut-out becomes the logo
    const tile = card('ADI').locator('img.ticker-logo');
    await expect(tile).toHaveClass(/loaded/);
    await expect(tile).toHaveAttribute('src', /^data:image\/png/);
    await expect(tile).toHaveClass(/mono/);
    // On the dark theme single-colour logos are white
    await page.getByRole('button', { name: 'Switch to dark mode' }).click();
    await expect(white).toHaveCSS('filter', 'brightness(0) invert(1)');
    // No logo: the image stays hidden and the letter shows
    const missing = card('NOLOGO').locator('img.ticker-logo');
    await expect(missing).toHaveCSS('opacity', '0');
    await expect(card('NOLOGO').locator('.symbol-badge')).toContainText('N');
    await expect(card('NOLOGO').locator('.symbol-badge')).not.toHaveClass(/has-logo/);
    expect(asked).toEqual(expect.arrayContaining(['AAPL.png', 'NOLOGO.png', 'BTCUSD.png', 'ABBV.png']));
  });
});
