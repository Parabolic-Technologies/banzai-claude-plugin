#!/bin/bash
# The project every eval case starts in. The host runs this script in the
# run's empty workspace: a small command line tool with one test, and
# documentation/work/, which makes it a project the hook guards.
set -e
mkdir -p src test documentation/work
: > documentation/work/.gitkeep
echo '.banzai/' > .gitignore
cat > CLAUDE.md <<'EOF'
# greet

A small command line tool: `node src/greet.mjs <name>` prints a greeting.

- Run the tests: `npm test`
- Node.js 26, ES modules, no dependencies.
EOF
cat > package.json <<'EOF'
{
  "name": "greet",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test"
  }
}
EOF
cat > src/greet.mjs <<'EOF'
#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

export function greet(name) {
  return `Hello, ${name}!`;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name] = process.argv.slice(2);
  if (!name) {
    console.error('usage: greet <name>');
    process.exit(2);
  }
  console.log(greet(name));
}
EOF
cat > test/greet.test.mjs <<'EOF'
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { greet } from '../src/greet.mjs';

test('greets by name', () => {
  assert.equal(greet('Ada'), 'Hello, Ada!');
});
EOF
git init -q
