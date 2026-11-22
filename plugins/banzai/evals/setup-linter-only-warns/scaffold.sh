#!/bin/bash
# The host takes a scaffold script from the case's own directory only.
. "$(dirname "${BASH_SOURCE[0]}")/../fixture.sh"

# A project that was never set up. It has a linter, and the only limit in
# its configuration is a warning.
rm -rf documentation .gitignore
cat > CLAUDE.md <<'EOF'
# greet

A small command line tool: `node src/greet.mjs <name>` prints a greeting.

- Run the tests: `npm test`
- Run the linter: `npm run lint`
- Node.js 26, ES modules, no runtime dependencies.
EOF
cat > package.json <<'EOF'
{
  "name": "greet",
  "private": true,
  "type": "module",
  "scripts": {
    "test": "node --test",
    "lint": "eslint ."
  },
  "devDependencies": {
    "@eslint/js": "^10.0.0",
    "eslint": "^10.0.0"
  }
}
EOF
cat > eslint.config.mjs <<'EOF'
import js from '@eslint/js';

export default [
  js.configs.recommended,
  { rules: { complexity: ['warn', 15] } },
];
EOF
