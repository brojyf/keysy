import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';

const css = readFileSync(new URL('./tokens.css', import.meta.url), 'utf8');
const webCss = readFileSync(new URL('./web.css', import.meta.url), 'utf8');
function declarations(selector, source = css) {
  const block = source.match(new RegExp(`${selector}\\s*\\{([^}]*)\\}`));
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

test('both modes define the same color tokens with hex values', () => {
  assert.deepEqual(Object.keys(darkColors).sort(), Object.keys(lightColors).sort());
  for (const value of [...Object.values(lightColors), ...Object.values(darkColors)]) {
    assert.match(value, /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/);
  }
  assert.ok(luminance(lightColors.bg) > luminance(lightColors.text));
  assert.ok(luminance(darkColors.bg) < luminance(darkColors.text));
});

test('primary button hover uses the Figma colors and meets text contrast targets in both modes', () => {
  for (const [mode, values, expected] of [['light', lightColors, '#2a51a7'], ['dark', darkColors, '#3b63bd']]) {
    assert.equal(values['button-hover'], expected, mode);
    const ratio = contrast(values['on-button'], values['button-hover']);
    assert.ok(ratio >= 4.5, `${mode} on-button/button-hover: ${ratio.toFixed(3)}:1; expected 4.5:1`);
  }
});

test('every text style has a dark weight 40 lower than its light weight', () => {
  const weights = mode => Object.keys(mode).filter(name => /^--text-[\w-]+--font-weight$/.test(name)).sort();
  assert.deepEqual(weights(dark), weights(light));
  for (const name of weights(light)) assert.equal(Number(dark[name]), Number(light[name]) - 40, name);
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

test('dark mode defines every shadow', () => {
  const shadows = mode => Object.keys(mode).filter(name => name.startsWith('--shadow-')).sort();
  assert.deepEqual(shadows(dark), shadows(light));
});

test('logo symbols use the button color of their mode', () => {
  for (const [file, button] of [['symbol-light.svg', lightColors.button], ['symbol-dark.svg', darkColors.button]]) {
    const svg = readFileSync(new URL(`../logo/${file}`, import.meta.url), 'utf8');
    const fills = new Set([...svg.matchAll(/fill="(#[^"]+)"/g)].map(([, fill]) => fill.toLowerCase()));
    assert.deepEqual([...fills], [button], file);
  }
});

test('web tokens are distinct from shared tokens', () => {
  const web = declarations(':root', webCss);
  assert.equal([...webCss.matchAll(/(--[\w-]+):\s*([^;]+);/g)].length, Object.keys(web).length);
  for (const [name, value] of Object.entries(web)) {
    assert.match(value, /^#[0-9a-f]{6}$/);
    for (const shared of [light, dark]) {
      assert.ok(!(name in shared), name);
      assert.ok(!Object.values(shared).includes(value), value);
    }
  }
});
