import { expect, test } from '@playwright/test';
import { libraries } from '../catalog';
import { palettes } from '../../theme/palettes.js';

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

test('studio switches isolated libraries, palettes, and modes without leaking global CSS', async ({ page }) => {
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
  await page.getByRole('button', { name: '10 Evergreen', exact: true }).click();
  await page.getByRole('button', { name: 'Dark', exact: true }).click();
  await expect(frame().locator('html')).toHaveAttribute('data-palette', 'evergreen');
  await expect(frame().locator('html')).toHaveClass('dark');
  await expect(page).toHaveURL(/cssPalette=evergreen&cssMode=dark/);
  await page.reload();
  await expect(frame().locator('html')).toHaveAttribute('data-library', 'geist');
  await expect(frame().locator('html')).toHaveClass('dark');
});

test('Theme uses an untitled preview and a full-height rail below the unchanged navigation', async ({ page }) => {
  await page.goto('/?tab=theme');
  const header = await page.locator('.design-header').boundingBox();
  const rail = await page.locator('.theme-palette-panel').boundingBox();
  expect(header).not.toBeNull();
  expect(rail).not.toBeNull();
  expect(Math.abs(rail!.y - (header!.y + header!.height))).toBeLessThanOrEqual(1);
  expect(Math.abs(rail!.y + rail!.height - 1000)).toBeLessThanOrEqual(1);
  await expect(page.locator('.theme-preview-pane > h1, .theme-preview-pane > h2, .theme-workspace > header')).toHaveCount(0);
  const scroll = page.locator('.theme-palette-scroll');
  expect(await scroll.evaluate(element => element.scrollHeight > element.clientHeight)).toBe(true);
  await page.getByRole('button', { name: '10 Evergreen', exact: true }).click();
  await expect(page.locator('#focus-preview .mock-screen')).toHaveAttribute('data-palette', 'evergreen');
});

test('Terminal and Evergreen dark layers reach both Theme layouts', async ({ page }) => {
  for (const id of ['terminal', 'evergreen']) for (const layout of ['supabase', 'mintlify']) {
    const colors = palettes.find(palette => palette.id === id)!.dark;
    await page.goto(`/?tab=theme&palette=${id}&layout=${layout}&mode=dark`);
    const preview = page.locator('#focus-preview .mock-screen');
    await expect(preview).toHaveAttribute('data-mode', 'dark');
    await expect(preview).toHaveCSS('background-color', rgb(colors.bg));
    await expect(preview.locator(layout === 'supabase' ? '.secret-detail' : '.mint-search')).toHaveCSS('background-color', rgb(colors.surface));
    await expect(preview.locator(layout === 'supabase' ? '.selected-row' : '.mint-nav-selected')).toHaveCSS('background-color', rgb(colors.soft));
    await expect(preview.locator(layout === 'supabase' ? '.studio-topbar' : '.mint-topnav')).toHaveCSS('border-bottom-color', rgb(colors.line));
  }
});

test('mobile studio and component previews avoid horizontal page overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
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
  }
});
