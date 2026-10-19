import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { afterEach, beforeEach, mock } from 'bun:test';

GlobalRegistrator.register({ url: 'http://localhost/' });
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const { cleanup } = await import('@testing-library/react');

beforeEach(() => {
  history.replaceState(null, '', '/');
  globalThis.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  Element.prototype.scrollIntoView = mock(() => {});
});

afterEach(() => {
  cleanup();
});
