import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'bun:test';

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

function cssHex(file, selector, property) {
  const css = readFileSync(new URL(file, import.meta.url), 'utf8');
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const declarations = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]+)\\}`))?.[1];
  const hex = declarations?.match(new RegExp(`(?:^|;)\\s*${property}:[^;#]*(#[a-f0-9]{3,6})\\s*;`))?.[1];
  assert.ok(hex, `${file}: ${selector} ${property} must have an explicit color`);
  return hex.length === 4 ? '#' + Array.from(hex.slice(1), channel => channel.repeat(2)).join('') : hex;
}

test('studio instructions, candidate labels, and selection outlines remain visible on their actual surfaces', () => {
  const canvas = cssHex('./studio.css', ':root', 'background');
  const card = cssHex('./logo/preview.css', '.comparison-grid > article', 'background');
  const header = cssHex('./studio.css', '.design-header', 'background');
  const pairs = [
    ['./studio.css', '.design-meta', header],
    ...['.preview-eyebrow', '.preview-description', '.preview-count', '.collection-heading h2 > span',
      '.preview-footnote', '.design-footer'].map(selector => ['./studio.css', selector, canvas]),
    ['./logo/preview.css', '.option-heading > span', card],
    ['./logo/preview.css', '.concept-note', card],
  ];
  for (const [file, selector, background] of pairs) {
    const ratio = contrast(cssHex(file, selector, 'color'), background);
    assert.ok(ratio >= 4.5, `${selector}: ${ratio.toFixed(3)}:1`);
  }
  for (const selector of ['.design-tabs button[aria-selected="true"]', '.segmented button[aria-pressed="true"]']) {
    assert.ok(contrast(cssHex('./studio.css', selector, 'border-color'), '#ffffff') >= 3, selector);
  }
  const focus = cssHex('./studio.css', 'button:focus-visible, a:focus-visible, [role="tabpanel"]:focus-visible', 'outline');
  for (const background of [canvas, card, header, cssHex('./studio.css', '.segmented', 'background')]) {
    assert.ok(contrast(focus, background) >= 3, 'keyboard focus must contrast with its adjacent surface');
  }
});

