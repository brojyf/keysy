import { expect, test } from 'bun:test';
import { createContext, h } from 'preact';
import { useContext } from 'preact/hooks';
import { renderToString } from 'preact-render-to-string';

test('the installed server renderer preserves page content through Preact contexts', () => {
  const PageTitle = createContext('');
  const Heading = () => h('h1', null, useContext(PageTitle));

  expect(renderToString(h(PageTitle.Provider, { value: 'Keysy API' }, h(Heading, null))))
    .toBe('<h1>Keysy API</h1>');
});
