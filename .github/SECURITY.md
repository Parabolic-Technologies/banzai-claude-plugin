# Security Policy

## Reporting a vulnerability

Email [alexander@parabolic.io](mailto:alexander@parabolic.io) with the subject
`Banzai security report`. Please report suspected vulnerabilities privately
before opening a public issue or pull request containing exploit details.

Include the affected Banzai version or commit, the operating system, the
Node.js and Claude Code versions, a minimal reproduction, expected and
observed behavior, and the potential impact. Use a disposable repository and
synthetic data where possible. Do not send credentials, customer data, private
source code, or complete model transcripts. Start with a redacted description
if the reproduction itself is sensitive.

The maintainer will assess reproducibility and impact and coordinate a fix and
disclosure when appropriate. This project does not promise a response
deadline, patch date, bug bounty, or long-term support period.

## Version scope

The first release of this plugin is **1.0.0**. Security fixes target the
latest release; older releases have no promised backport support. If
you find a problem on an older version, include that version in your report.

## What the approval gate is, and is not

The plugin's hook asks the developer before a file tool changes a source
file, reports a change made through the shell or another tool after the
call, and binds an approval to the content of the approved files. It guards against mistakes: a
model that starts to write code before the plan was read, or a plan that
changed after it was approved. It is not an operating-system sandbox, and it
is not protected against a model or a process that works to get around it.
The known limits are listed in [DECISIONS.md](../DECISIONS.md) and in the
[README](../README.md#limits).

A way to get around the gate on purpose is therefore a known limit, not a
vulnerability. Please do report, privately:

- a way for the plugin itself to run code, write outside its own directories
  or disclose data that its documentation does not describe;
- a case where the approval dialog shows the developer something other than
  what the approval then covers, in ordinary use.

A source change that passes the gate by accident, with no attempt to mislead,
is an ordinary bug: use the public issue tracker.

## Execution and data boundaries

The hook runs on your machine with your own Node.js, each time Claude Code
starts a session, expands a typed command or calls a tool. It reads project
files, runs Git to compare them, and writes approval records under
`.banzai/approvals/` in the project and its state in the plugin's data
directory. It makes no network request of its own.

Claude Code is a separate client. Review its permissions and configuration
before you run it on an untrusted repository. Project material that it sends
to its provider is subject to its configuration and that provider's terms.

Do not test against other people's repositories, accounts, or systems without
authorization. For ordinary bugs and questions, use the
[public issue tracker](https://github.com/Parabolic-Technologies/banzai-claude-plugin/issues).
