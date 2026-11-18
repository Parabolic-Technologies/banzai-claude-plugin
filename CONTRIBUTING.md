# Contributing

This repository is the source of the Banzai plugin for Claude Code:
[Parabolic-Technologies/banzai-claude-plugin](https://github.com/Parabolic-Technologies/banzai-claude-plugin).
The product owner is **Parabolic Technologies, Inc. ("Parabolic")**. The author
and maintainer is [Alexander Torosh](https://github.com/alexander-torosh)
([alexander@parabolic.io](mailto:alexander@parabolic.io)). Participation
follows our [Code of Conduct](CODE_OF_CONDUCT.md).

## Issues and proposals

Use [GitHub Issues](https://github.com/Parabolic-Technologies/banzai-claude-plugin/issues)
for reproducible bugs, documentation improvements, and feature proposals.
Search existing issues first. For a bug, include the Banzai version or commit,
the operating system, the Node.js and Claude Code versions, a minimal
reproduction, and expected versus actual behavior. Use synthetic data and
never attach credentials or private project material. Report vulnerabilities
privately through [SECURITY.md](SECURITY.md).

Discuss a new command, or a change to a command name, to the hook's
decisions or to the document layout, with the maintainer before you invest in
an implementation. The last three are breaking changes for projects that use
the plugin. Documentation improvements and small fixes can be proposed
directly.

## Development

The repository has no dependencies and no build step. Use Node.js 26 LTS,
the one version the project tests on.

```bash
npm test
```

```bash
claude plugin validate .
```

```bash
claude plugin validate plugins/banzai
```

```bash
PLUGIN="$PWD/plugins/banzai"; cd "$(mktemp -d)" && git init && claude --plugin-dir "$PLUGIN"
```

The first command runs every test. The next two check the marketplace
manifest, the plugin's manifest and the skills. The last one starts Claude
Code with your working copy of the plugin in a new, empty Git project; type
`/banzai:setup` there to switch the hook on.

The project keeps itself small on purpose. These limits are part of the design:

- the hook and its helper: about 800 lines of plain `.mjs`, with no dependency;
- all tests: under 30 seconds;
- all skill text: about 1,500 lines;
- one [DECISIONS.md](DECISIONS.md) for decisions that are costly to reverse or
  not obvious: the decision, the reason and what was rejected.

A change that needs more room removes something else or explains why the limit
should move.

## Pull requests

1. Fork the repository and create a focused branch from the default branch.
2. Add or change a test for every change to the hook's behavior. Change the
   skill text and `DECISIONS.md` in the same pull request when the behavior
   they describe changes.
3. Run the tests and both validations above and report their results; CI
   runs the same checks on Linux. Say what you did not check, for example a
   client or a model you could not run.
4. Describe the problem, the resulting behavior and the limits you know of.

Keep code, documentation, interface text, and commit messages in English.
Maintainers review and decide whether to merge; a submitted contribution does
not imply acceptance. The maintainer manages versions, tags, and releases, so
do not change the version as part of a contribution.

AI-assisted contributions are welcome. You remain responsible for understanding
the change, verifying it, and having the right to submit all included material.
Describe AI involvement when it helps reviewers understand the evidence or its
limits; model output is not independent verification by itself.

## Contribution licensing

Unless you explicitly state otherwise, contributions intentionally submitted
for inclusion are offered under Apache-2.0, as described in section 5 of
[LICENSE](LICENSE). You or the applicable copyright holder retain ownership of
your contribution. No copyright assignment is required. Submit only material you
have the right to license, and identify third-party material with its source,
license, and required notices. Discuss a different license before submitting
such material; acceptance is not automatic.

No separate contributor license agreement or commit sign-off is required by
this project. These contribution rules do not impose extra restrictions on
use of the released software.
