import { readFileSync, writeFileSync } from 'node:fs';

function declarations(selector: string) {
  const block = tokensCss.match(new RegExp(`(?:^|\\n)${selector}\\s*\\{([^}]*)\\}`));
  if (!block) throw new Error(`design/tokens/tokens.css has no ${selector} block`);
  return Object.fromEntries([...block[1]!.matchAll(/(--[\w-]+):\s*([^;]+);/g)]
    .map(([, name, value]) => [name!, value!.trim().replace(/\s+/g, ' ')]));
}

const tokensCss = readFileSync(new URL('../design/tokens/tokens.css', import.meta.url), 'utf8');
export const tokenLight = declarations(':root');
export const tokenDark = declarations('\\.dark');

const rgb = (hex: string) => hex.slice(1).match(/../g)!.map((channel) => parseInt(channel, 16)).join(' ');

/** Sourcey needs RGB triples and has its own --font-sans, so the wiki theme is generated instead of imported. */
export function writeWikiTheme() {
  const [light, dark] = [tokenLight, tokenDark];
  const brand = (mode: Record<string, string>) => ['text', 'accent', 'soft', 'raised']
    .map((color) => `  --keysy-${color}: ${mode[`--color-${color}`]};`).join('\n');
  const css = `:root {
  --color-background-light: ${rgb(light['--color-bg']!)};
  --color-background-dark: ${rgb(dark['--color-bg']!)};
  --color-primary-ink: ${rgb(light['--color-accent']!)};
  --color-gray-50: ${rgb(light['--color-bg']!)};
  --color-gray-100: ${rgb(light['--color-soft']!)};
  --color-gray-200: ${rgb(light['--color-line']!)};
  --color-gray-400: ${rgb(dark['--color-muted']!)};
  --color-gray-500: ${rgb(light['--color-muted']!)};
  --color-gray-800: ${rgb(dark['--color-soft']!)};
  --color-gray-900: ${rgb(light['--color-text']!)};
  --color-gray-950: ${rgb(dark['--color-bg']!)};
${brand(light)}
  --keysy-spring: ${light['--ease-spring']};
  --keysy-spring-duration: ${light['--duration-spring']};
}

.dark {
${brand(dark)}
  --color-gray-200: ${rgb(dark['--color-text']!)};
}
`;
  writeFileSync(new URL('tokens.generated.css', import.meta.url), css);
  return './tokens.generated.css';
}
