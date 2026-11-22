#!/bin/bash
# The host takes a scaffold script from the case's own directory only.
. "$(dirname "${BASH_SOURCE[0]}")/../fixture.sh"

# A project that was never set up. It has no linter.
rm -rf documentation .gitignore
