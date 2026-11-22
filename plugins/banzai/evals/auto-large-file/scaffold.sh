#!/bin/bash
# The host takes a scaffold script from the case's own directory only.
. "$(dirname "${BASH_SOURCE[0]}")/../fixture.sh"

# The file the request would naturally add to is already past 500 lines, the
# size limit the plan step uses when the project names none.
{
  cat <<'EOF'
#!/usr/bin/env node
import { fileURLToPath } from 'node:url';

export function greet(name) {
  return `Hello, ${name}!`;
}

EOF
  for i in $(seq -w 1 56); do
    cat <<EOF
/**
 * Greeting template $i.
 * @param {string} name
 * @returns {string}
 */
export function template$i(name) {
  return \`Hello \${name}, this is template $i.\`;
}

EOF
  done
  cat <<'EOF'
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const [name] = process.argv.slice(2);
  if (!name) {
    console.error('usage: greet <name>');
    process.exit(2);
  }
  console.log(greet(name));
}
EOF
} > src/greet.mjs
