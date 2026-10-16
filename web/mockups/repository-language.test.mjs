import assert from 'node:assert/strict';
import { isUtf8 } from 'node:buffer';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const repositoryRoot = new URL('../../', import.meta.url);

test('repository text stays free of Chinese copy and Chinese HTML language tags', () => {
  const paths = execFileSync('git', ['ls-files', '-z', '--cached', '--others', '--exclude-standard'],
    { cwd: repositoryRoot, encoding: 'utf8' }).split('\0').filter(Boolean);
  for (const path of paths) {
    const contents = readFileSync(new URL(path, repositoryRoot));
    if (!isUtf8(contents)) continue;
    const text = contents.toString('utf8');
    assert.equal(/\p{Script=Han}/u.test(text), false, `${path}: use English copy`);
    assert.equal(/\blang=["']zh(?:-[\w-]+)?["']/i.test(text), false,
      `${path}: declare the page language as English`);
  }
});
