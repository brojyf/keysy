import assert from 'node:assert/strict';
import { test } from 'bun:test';
import { palettes } from '../theme/palettes.js';
import { blue, blueDark } from '@radix-ui/colors';
import { libraries, readSelection, frameUrl } from './catalog';
import { themeVariables } from './theme';

test('the catalog includes all nine approved integrations and identifies the Geist reference', () => {
  assert.deepEqual(libraries.map(library => library.id), [
    'radix-themes', 'shadcn', 'daisyui', 'radix-colors', 'open-props', 'basecoat', 'coss', 'intent', 'geist',
  ]);
  assert.equal(libraries.find(library => library.id === 'geist')?.kind, 'Specification reference');
  assert.equal(new Set(libraries.map(library => library.id)).size, 9);
});

test('selection validates URL values without losing palette or appearance', () => {
  assert.deepEqual(readSelection('?library=coss&cssPalette=blue&cssMode=dark'), {
    library: 'coss', palette: 'blue', mode: 'dark',
  });
  assert.deepEqual(readSelection('?library=unknown&cssPalette=invalid&cssMode=no'), {
    library: 'radix-themes', palette: palettes[0].id, mode: 'light',
  });
  assert.equal(frameUrl(readSelection('?library=intent&cssPalette=blue&cssMode=dark')),
    '/css/frame.html?library=intent&cssPalette=blue&cssMode=dark');
  for (const palette of ['graphite', 'evergreen', 'inkiris', 'orchid', 'cocoaice', 'terminal']) {
    assert.equal(readSelection(`?cssPalette=${palette}`).palette, palettes[0].id);
  }
  assert.equal(frameUrl(readSelection(''), '/studies/css/index.html'),
    '/studies/css/frame.html?library=radix-themes&cssPalette=blue&cssMode=light');
});

test('Radix Colors preserves official hue-matched scales while keeping Keysy semantic colors', () => {
  const ink = palettes[0];
  assert.equal(themeVariables(ink.light, 'radix-colors', 'light', ink.id)['--radix-9'], blue.blue9);
  assert.equal(themeVariables(ink.dark, 'radix-colors', 'dark', ink.id)['--radix-11'], blueDark.blue11);
});

test('every library receives complete theme tokens for every existing palette and both modes', () => {
  for (const library of libraries) {
    for (const palette of palettes) {
      for (const mode of ['light', 'dark'] as const) {
        const variables = themeVariables(palette[mode], library.id, mode, palette.id);
        assert.equal(variables['--demo-bg'], palette[mode].bg);
        assert.equal(variables['--demo-accent'], palette[mode].accent);
        assert.equal(variables['--primary'], palette[mode].button);
        assert.equal(variables['--primary-foreground'], palette[mode]['on-button']);
        assert.equal(variables['--color-primary'], palette[mode].button);
        assert.equal(variables['--demo-status-text'], mode === 'dark' ? '#86efac' : '#166534');
        assert.ok(Object.values(variables).every(value => typeof value === 'string' && value.length > 0));
      }
    }
  }
});
