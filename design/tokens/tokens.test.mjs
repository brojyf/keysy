import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';

const readme = readFileSync(new URL('./README.md', import.meta.url), 'utf8');
const cssReadme = readFileSync(new URL('../css/README.md', import.meta.url), 'utf8');
const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
function declarations(selector) {
  const block = css.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
  assert.ok(block, `missing ${selector} block`);
  return Object.fromEntries([...block[1].matchAll(/(--[\w-]+):\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]));
}
const light = declarations(':root');
const dark = declarations('\\.dark');
const colors = mode => Object.fromEntries(Object.entries(mode).filter(([name]) => name.startsWith('--color-')).map(([name, value]) => [name.slice(8), value]));
const lightColors = colors(light);
const darkColors = colors(dark);
function luminance(hex) {
  const channels = hex.slice(1).match(/../g).map(channel => {
    const value = parseInt(channel, 16) / 255;
    return value <= .04045 ? value / 12.92 : ((value + .055) / 1.055) ** 2.4;
  });
  return channels[0] * .2126 + channels[1] * .7152 + channels[2] * .0722;
}
function contrast(first, second) {
  const a = luminance(first);
  const b = luminance(second);
  return (Math.max(a, b) + .05) / (Math.min(a, b) + .05);
}

test('implementation references specify the required stack without selection rationale', () => {
  for (const specification of [readme, cssReadme]) assert.doesNotMatch(specification, /\b(?:why|pros|cons|trade-offs?|historical|candidates|research)\b/i);
  assert.match(cssReadme, /shadcn\/ui \+ tweakcn \+ Geist/);
});

test('color rows match all CSS colors in both modes', () => {
  const rows = [...readme.matchAll(/^\| [^|]+ \| `([\w-]+)` \| `([^`]+)` \| `([^`]+)` \|$/gm)];
  const names = rows.map(([, name]) => name).sort();
  assert.equal(new Set(names).size, names.length);
  assert.deepEqual(names, Object.keys(lightColors).sort());
  assert.deepEqual(names, Object.keys(darkColors).sort());
  assert.equal(names.length, 15);
  for (const [, name, lightValue, darkValue] of rows) {
    assert.match(lightValue, /^#[0-9a-f]{6}$/);
    assert.match(darkValue, /^#[0-9a-f]{6}$/);
    assert.equal(lightColors[name], lightValue, `light ${name}`);
    assert.equal(darkColors[name], darkValue, `dark ${name}`);
  }
  assert.ok(luminance(lightColors.bg) > luminance(lightColors.text));
  assert.ok(luminance(darkColors.bg) < luminance(darkColors.text));
});

test('text style rows match CSS values and dark weights', () => {
  const rows = [...readme.matchAll(/^\| ([\w ]+) \| (Geist(?: Mono)?) \| (\d+px) \/ (\d+px) \| ([^|]+) \| (\d+) \| (\d+) \|$/gm)];
  const slugs = rows.map(([, name]) => name.toLowerCase().replaceAll(' ', '-'));
  const cssSlugs = Object.keys(light).filter(name => /^--text-[\w-]+--font-weight$/.test(name)).map(name => name.slice(7, -13));
  assert.equal(rows.length, 15);
  assert.equal(new Set(slugs).size, slugs.length);
  assert.deepEqual([...slugs].sort(), cssSlugs.sort());
  assert.deepEqual(Object.keys(dark).filter(name => name.startsWith('--text-')).sort(), cssSlugs.map(slug => `--text-${slug}--font-weight`).sort());
  assert.equal(light['--font-sans'], "'Geist Variable', 'Geist', sans-serif");
  assert.equal(light['--font-mono'], "'Geist Mono Variable', 'Geist Mono', monospace");
  for (const [, name, , size, lineHeight, spacing, lightWeight, darkWeight] of rows) {
    const prefix = `--text-${name.toLowerCase().replaceAll(' ', '-')}`;
    assert.equal(light[prefix], size, name);
    assert.equal(light[`${prefix}--line-height`], lineHeight, name);
    assert.equal(light[`${prefix}--letter-spacing`] ?? '0', spacing.trim(), name);
    assert.equal(light[`${prefix}--font-weight`], lightWeight, name);
    assert.equal(dark[`${prefix}--font-weight`], darkWeight, name);
    assert.equal(Number(darkWeight), Number(lightWeight) - 40, name);
  }
});

test('structural colors stay close to neutral', () => {
  for (const [mode, values] of Object.entries({ light: lightColors, dark: darkColors })) {
    for (const role of ['bg', 'surface', 'raised', 'soft', 'line']) {
      const channels = values[role].slice(1).match(/../g).map(channel => parseInt(channel, 16));
      assert.ok(Math.max(...channels) - Math.min(...channels) <= 8, `${mode} ${role} is too colorful`);
      if (mode === 'dark') assert.equal(new Set(channels).size, 1, `${role} must have equal RGB channels`);
      if (role === 'line') continue;
      assert.ok(mode === 'light' ? Math.min(...channels) >= 235 : Math.max(...channels) <= 52, `${mode} ${role} must stay near white or black`);
    }
  }
});

for (const [mode, values] of Object.entries({ light: lightColors, dark: darkColors })) {
  test(`${mode}: text and controls meet contrast targets`, () => {
    for (const foreground of ['text', 'muted', 'accent']) {
      for (const background of ['bg', 'surface', 'raised', 'soft']) {
        const ratio = contrast(values[foreground], values[background]);
        const minimum = foreground === 'text' ? 7 : 4.5;
        assert.ok(ratio >= minimum, `${foreground}/${background}: ${ratio.toFixed(3)}:1; expected ${minimum}:1`);
      }
    }
    for (const [foreground, background] of [['on-button', 'button'], ['danger', 'danger-bg']]) {
      const ratio = contrast(values[foreground], values[background]);
      assert.ok(ratio >= 4.5, `${foreground}/${background}: ${ratio.toFixed(3)}:1; expected 4.5:1`);
    }
    for (const background of ['bg', 'surface', 'soft']) assert.ok(contrast(values.button, values[background]) >= 3, `button/${background}`);
  });
}

test('dark input borders reach 3:1 on every input background', () => {
  for (const background of ['bg', 'surface', 'raised']) assert.ok(contrast(darkColors['line-strong'], darkColors[background]) >= 3, background);
});

test('raised layers stand above panels, and selected items stay visible on them', () => {
  assert.ok(luminance(lightColors.raised) >= luminance(lightColors.surface));
  assert.ok(luminance(darkColors.bg) < luminance(darkColors.surface));
  assert.ok(luminance(darkColors.surface) < luminance(darkColors.raised));
  assert.ok(luminance(darkColors.raised) < luminance(darkColors.soft));
});

test('radius, shadow, and motion tokens match their documented values', () => {
  const expected = {
    '--radius-sm': '8px',
    '--radius-md': '14px',
    '--radius-lg': '20px',
    '--radius-full': '9999px',
    '--shadow-md': '0 1px 2px #0000000a, 0 8px 24px #0f121a1f',
    '--ease-spring': 'linear(0, 0.06, 0.186, 0.329, 0.466, 0.584, 0.682, 0.76, 0.821, 0.868, 0.903, 0.929, 0.949, 0.963, 0.973, 0.981, 0.986, 0.99, 0.993, 0.995, 0.997, 0.998, 0.998, 0.999, 1)',
    '--duration-spring': '600ms',
  };
  for (const [name, value] of Object.entries(expected)) {
    assert.equal(light[name]?.replace(/\s+/g, ' '), value, name);
    assert.ok(readme.includes('`' + name + '`'), name);
    assert.ok(readme.includes('`' + value + '`'), name);
  }
  assert.equal(dark['--shadow-md'], '0 1px 2px #0f121a1f, 0 8px 24px #0f121a5c');
  assert.ok(readme.includes('`' + dark['--shadow-md'] + '`'));
});
