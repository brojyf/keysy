import { execFileSync } from 'node:child_process'
import { test } from 'node:test'

for (const mode of ['development', 'production']) {
  test(`React DOM client loads in ${mode} mode`, () => {
    execFileSync(process.execPath, ['--input-type=module', '-e', "import 'react-dom/client'"], {
      cwd: new URL('..', import.meta.url),
      env: { ...process.env, NODE_ENV: mode },
    })
  })
}
