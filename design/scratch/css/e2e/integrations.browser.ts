import { expect, test } from '@playwright/test';
import { libraries } from '../catalog';
import { palettes } from '../../../theme/palettes.js';

function rgb(hex: string) {
  return `rgb(${hex.slice(1).match(/../g)!.map(channel => parseInt(channel, 16)).join(', ')})`;
}

for (const library of libraries) {
  test(`${library.name}: all palettes and modes render real controls and local interactions work`, async ({ page, baseURL }) => {
    const errors: string[] = [];
    const external: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
    page.on('request', request => { if (request.url().startsWith('http') && !request.url().startsWith(baseURL!)) external.push(request.url()); });
    for (const palette of palettes) for (const mode of ['light', 'dark'] as const) {
      await test.step(`${palette.name} / ${mode}`, async () => {
        await page.goto(`/css/frame.html?library=${library.id}&cssPalette=${palette.id}&cssMode=${mode}`);
        await expect(page.getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
        await expect(page.locator('html')).toHaveAttribute('data-library', library.id);
        await expect(page.locator('.demo-workspace')).toHaveCSS('background-color', rgb(palette[mode].bg));
        await expect(page.locator('.demo-topbar')).toHaveCSS('background-color', rgb(palette[mode].surface));
        await expect(page.locator('.demo-topbar')).toHaveCSS('border-bottom-color', rgb(palette[mode].line));
        await expect(page.locator('.demo-nav-active')).toHaveCSS('background-color', rgb(palette[mode].soft));
        await expect(page.locator('.demo-table tr[data-selected="true"] td').first()).toHaveCSS('background-color', rgb(palette[mode].soft));
        const primary = page.getByRole('button', { name: '+ Add secret', exact: true });
        await expect(primary).toHaveCSS('background-color', rgb(palette[mode].button));
        await expect(primary).toHaveCSS('color', rgb(palette[mode]['on-button']));
        await expect(page.getByRole('table', { name: 'Secrets' }).getByRole('row')).toHaveCount(6);
        await expect(page.getByRole('searchbox', { name: 'Search secrets' })).toBeVisible();
        if (['radix-colors', 'open-props', 'geist'].includes(library.id)) {
          await expect(page.getByText('Encrypted', { exact: true })).toHaveCSS('color', rgb(mode === 'dark' ? '#86efac' : '#166534'));
        }
      });
    }
    await page.getByRole('searchbox', { name: 'Search secrets' }).fill('database');
    await expect(page.getByRole('table', { name: 'Secrets' }).getByRole('row')).toHaveCount(2);
    await page.getByRole('button', { name: 'DATABASE_URL', exact: true }).click();
    await page.getByRole('button', { name: 'Reveal value', exact: true }).click();
    await expect(page.getByLabel('Selected secret value', { exact: true })).toHaveAttribute('type', 'text');
    await expect(page.getByLabel('Selected secret value', { exact: true })).toHaveValue('postgresql://example.invalid/keysy');
    await page.getByRole('button', { name: 'Hide value', exact: true }).click();
    await page.getByRole('button', { name: '+ Add secret', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add secret' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByLabel('Name', { exact: true })).toBeFocused();
    await dialog.getByRole('button', { name: 'Save secret', exact: true }).click();
    await expect(dialog).toBeVisible();
    expect(await dialog.getByLabel('Name', { exact: true }).evaluate(input => (input as HTMLInputElement).validity.valid)).toBe(false);
    await dialog.getByLabel('Name', { exact: true }).fill('TEST_API_KEY');
    await dialog.getByLabel('Value', { exact: true }).fill('fictional-only');
    const closed = page.locator('dialog').evaluate(dialog => new Promise<void>(resolve => dialog.addEventListener('close', () => resolve(), { once: true })));
    await dialog.getByRole('button', { name: 'Save secret', exact: true }).click();
    await closed;
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Secrets' }).getByRole('row')).toHaveCount(7);
    await expect(page.getByRole('status')).toContainText('TEST_API_KEY added to this preview only.');
    await page.getByRole('button', { name: '+ Add secret', exact: true }).click();
    await dialog.getByLabel('Name', { exact: true }).fill('CANCELLED_API_KEY');
    await dialog.getByLabel('Value', { exact: true }).fill('fictional-cancelled-value');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('table', { name: 'Secrets' }).getByRole('row')).toHaveCount(7);
    await expect(page.getByRole('status')).toContainText('TEST_API_KEY added to this preview only.');
    await page.getByRole('button', { name: '+ Add secret', exact: true }).click();
    await dialog.getByLabel('Name', { exact: true }).fill('TEST_API_KEY');
    await dialog.getByLabel('Value', { exact: true }).fill('duplicate');
    await dialog.getByRole('button', { name: 'Save secret', exact: true }).click();
    await expect(dialog.getByRole('alert')).toContainText('A secret with this name already exists.');
    await dialog.getByRole('button', { name: 'Cancel', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    expect(errors).toEqual([]);
    expect(external).toEqual([]);
  });
}

test('studio switches isolated libraries and modes with fixed Ink without leaking global CSS', async ({ page }) => {
  await page.goto('/css/?library=radix-themes');
  const frame = () => page.frameLocator('.css-preview-frame');
  await expect(frame().getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
  const header = page.locator('.design-header');
  const originalBackground = await header.evaluate(element => getComputedStyle(element).backgroundColor);
  for (const library of libraries) {
    await page.getByRole('button', { name: `${library.name} ${library.kind}`, exact: true }).click();
    await expect(frame().locator('html')).toHaveAttribute('data-library', library.id);
    await expect(frame().getByRole('button', { name: '+ Add secret', exact: true })).toBeVisible();
    await expect(header).toHaveCSS('background-color', originalBackground);
  }
  await expect(page.getByRole('group', { name: 'CSS palette' })).toHaveCount(0);
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(frame().locator('html')).toHaveAttribute('data-palette', 'blue');
  await expect(frame().locator('html')).toHaveClass('dark');
  await expect(page).toHaveURL(/cssPalette=blue&cssMode=dark/);
  await page.reload();
  await expect(frame().locator('html')).toHaveAttribute('data-library', 'geist');
  await expect(frame().locator('html')).toHaveClass('dark');
});

for (const library of ['radix-themes', 'intent']) {
  test(`${library}: primary hover text keeps sufficient contrast in every palette and mode`, async ({ page }) => {
    for (const palette of palettes) for (const mode of ['light', 'dark'] as const) {
      await test.step(`${palette.name} / ${mode}`, async () => {
        await page.goto(`/css/frame.html?library=${library}&cssPalette=${palette.id}&cssMode=${mode}`);
        const primary = page.getByRole('button', { name: '+ Add secret', exact: true });
        await expect(primary).toBeVisible();
        await page.addStyleTag({ content: '* { transition: none !important; }' });
        await primary.hover();
        const contrast = await primary.evaluate(button => {
          const canvas = document.createElement('canvas');
          canvas.width = canvas.height = 1;
          const context = canvas.getContext('2d')!;
          function luminance(color: string) {
            context.fillStyle = color;
            context.fillRect(0, 0, 1, 1);
            const channels = Array.from(context.getImageData(0, 0, 1, 1).data).slice(0, 3).map(channel => {
              const value = channel / 255;
              return value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
            });
            return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
          }
          const style = getComputedStyle(button);
          const background = luminance(style.backgroundColor);
          const foreground = luminance(style.color);
          return (Math.max(background, foreground) + 0.05) / (Math.min(background, foreground) + 0.05);
        });
        expect(contrast).toBeGreaterThanOrEqual(4.5);
      });
    }
  });
}

for (const width of [320, 390, 768, 1024, 1440]) {
  test(`Logo and CSS fit a ${width}px viewport without horizontal scrolling or clipped content`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const tab of ['logo', 'css']) {
      await page.goto(`/${tab}/`);
      await expect(page.getByRole('tab', { name: tab === 'logo' ? 'Logo' : 'CSS', exact: true })).toHaveAttribute('aria-selected', 'true');
      if (tab === 'css') await expect(page.frameLocator('.css-preview-frame').getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
      const overflow = await page.locator('html, .design-header-inner, .theme-preview, .small-logo, .symbol-sizes, .css-preview-toolbar, .css-choice-panel').evaluateAll(elements => elements
        .filter(element => element.getClientRects().length && element.scrollWidth > element.clientWidth + 1)
        .map(element => element.className || element.tagName));
      expect(overflow, `${tab} at ${width}px`).toEqual([]);
      if (tab === 'css') {
        const frameOverflow = await page.frameLocator('.css-preview-frame').locator('html, .demo-table-scroll, .demo-row-select').evaluateAll(elements => elements
          .filter(element => element.scrollWidth > element.clientWidth + 1)
          .map(element => element.className || element.tagName));
        expect(frameOverflow, `CSS document at ${width}px`).toEqual([]);
      }
    }
  });
}

test('mobile studio and component previews avoid horizontal page and table overflow', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 844 });
  await page.goto('/css/?library=intent&cssMode=dark');
  await expect(page.getByRole('tab', { name: 'CSS', exact: true })).toBeInViewport();
  const preview = page.frameLocator('.css-preview-frame');
  await expect(preview.getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  expect(await preview.locator('html').evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true);
  for (const library of libraries) {
    await page.goto(`/css/frame.html?library=${library.id}&cssMode=dark`);
    await expect(page.getByRole('heading', { name: 'Secrets', exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), library.name).toBe(true);
    expect(await page.locator('.demo-table-scroll').evaluate(element => element.scrollWidth <= element.clientWidth + 1), library.name).toBe(true);
    await page.getByRole('button', { name: '+ Add secret', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Add secret' });
    const name = 'EXAMPLE_APPLICATION_PRODUCTION_DATABASE_CONNECTION_URL';
    await dialog.getByLabel('Name', { exact: true }).fill(name);
    await dialog.getByLabel('Value', { exact: true }).fill('fictional-only');
    await dialog.getByRole('button', { name: 'Save secret', exact: true }).click();
    await expect(dialog).not.toBeVisible();
    await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${library.name} after creation`).toBe(true);
    expect(await page.locator('.demo-table-scroll').evaluate(element => element.scrollWidth <= element.clientWidth + 1), `${library.name} after creation`).toBe(true);
  }
});
