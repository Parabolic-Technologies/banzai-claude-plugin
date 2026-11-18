# Banzai

**Spec-driven development for Claude Code with a human in the loop: the AI
agent writes the plan, you approve it with one click, then it writes the
code.**

[![CI](https://github.com/Parabolic-Technologies/banzai-claude-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/Parabolic-Technologies/banzai-claude-plugin/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue)](LICENSE)

Banzai is a Claude Code plugin for developers who want an AI coding agent to
work from a spec and an approved plan. It adds a workflow of five slash
commands and one guardrail hook that asks you before source files change:

- **Quick fix.** A small change runs directly, after you type the command
  for it.
- **Plan approval.** Planned work gets written requirements and a plan, and
  Claude Code's file tools write no source file until you approve that plan
  with one click.
- **Guardrails.** A change made another way, through the shell or an MCP
  tool, is found after the call and shown to you.
- **Independent code review.** A finished change can be reviewed by a fresh
  subagent that has not seen how it was made.

Requirements, plans, decisions, reports and reviews are ordinary Markdown
files in your project, so you can read, diff and commit them.

Compared with Claude Code's plan mode: the plan is a file in your project,
your approval is bound to that file's content, and it still holds in a new
session.

![The approval dialog in a terminal: it quotes four lines of the plan, names the file the answer approves, and offers Yes and No.](assets/approval-dialog.svg)

The approval dialog, redrawn from a real session: the yellow lines come from
the plan and name what your "Yes" covers.

## Requirements

- Claude Code 2.1.327 or later.
- Node.js 26 LTS or later on your `PATH`. Older versions are not tested. The
  hook is plain JavaScript with no dependencies. Without Node.js the hook
  does not run and nothing is held back.
- A project in Git. The hook finds changes made through the shell by asking
  Git, so outside Git it sees only changes made with the file tools.

Banzai was built and checked in the terminal client on macOS, and its tests
also run on Linux. The desktop app, the IDE extensions and Windows have not
been checked.

## Install

Add the marketplace, then install the plugin for your project:

```bash
claude plugin marketplace add Parabolic-Technologies/banzai-claude-plugin
```

```bash
claude plugin install banzai@parabolic-plugins --scope project
```

Then start Claude Code in the project and type:

```text
/banzai:setup
```

`setup` prepares the project once and is safe to run again. It:

- adds `.banzai/` to `.gitignore`;
- enables the plugin and names its marketplace in `.claude/settings.json`;
- creates `documentation/decisions/` and `documentation/work/`;
- offers to record the project's build, test, lint and format commands in
  your `CLAUDE.md`, and asks before it writes them.

Commit these files so that your team shares them. The settings make the
marketplace known to a teammate's Claude Code but install nothing. Each
teammate opens the project in Claude Code once and trusts the folder, which
fetches the marketplace, and then runs the install command above.

## Commands

You type every command yourself; the model cannot start one.

| Command                           | Use it for                                                        |
| --------------------------------- | ----------------------------------------------------------------- |
| `/banzai:setup`                   | Prepare a project, once.                                          |
| `/banzai:fix <what to change>`    | A small, direct change with no plan.                              |
| `/banzai:feature <what to build>` | Planned work: plan, your approval, code, tests, report.           |
| `/banzai:review [work]`           | An independent review of a finished change.                       |
| `/banzai:epic <mode>`             | Large work split into stages and packages: `start`, `next`, `record`, `gate`. |

Always type the full name. A bare `/review` is a different command.

## How planned work goes

1. You type `/banzai:feature` and say what to build.
2. When the request leaves open what users get, the model asks you up to
   three questions, each with the answer it recommends. It decides matters
   of form itself, such as names and messages, and marks each such choice.
3. The model writes `documentation/work/<work>/plan.md`. A larger request
   first gets `requirements.md`, and a choice that is costly to reverse gets
   a decision record under `documentation/decisions/`, which you accept in
   chat before the plan is written.
4. An approval dialog appears. It shows the plan's "For approval" section: up
   to five lines of at most 72 characters that say what will be built and
   name each choice the model made for you. It also names the files your
   answer approves; when that list is long, the terminal folds its end out
   of view.
5. "Yes" approves exactly those files as they are. If one of them changes
   later, the approval ends and the dialog comes again.
6. The model writes the code and the tests, runs the project's checks and
   completes `report.md`.
7. `/banzai:review <work>` starts a reviewer with fresh context and writes
   `review.md`. A review changes no source file; you choose what to fix.

To continue a work in a new session, type `/banzai:feature <work>`. An
approval of unchanged files still holds.

## What the hook holds back

The hook acts in a directory that has `documentation/work/` and in every
directory below it. Everywhere else it stays silent.

To the hook, a source file is every file of the project except the files
under `documentation/` and the `CLAUDE.md` and `AGENTS.md` at its root. So
`package.json`, `.gitignore` and `.claude/settings.json` are source files
too.

- With no command typed, each source change asks you, and "Yes" covers that
  one change.
- After `/banzai:fix`, the session may change source files.
- After `/banzai:feature`, the file tools write no source file until the plan
  is approved.
- A source change made through the shell or an MCP tool cannot be stopped
  beforehand. The hook finds it by comparing the project before and after
  the call, and the next shell command shows you the changed files and asks.
  "No" does not undo the change: revert it yourself. Until you accept it,
  each shell command asks again and MCP calls are refused.

The hook behaves the same in every permission mode, `bypassPermissions`
included. To work without it, disable the plugin:

```bash
claude plugin disable banzai@parabolic-plugins
```

In a run with nobody to answer (`claude -p`), every question of the hook is
refused. `/banzai:fix` still works. A plan cannot be approved, a run with no
command typed cannot change a source file with the file tools, and after a
change through the shell is found, the run's later shell and MCP calls are
refused.

Approval records are kept in `.banzai/approvals/` in the project, outside
Git. Losing them costs one new click per work. Uninstalling the plugin
deletes the hook's data, and approvals made before then no longer count. To
uninstall and keep them:

```bash
claude plugin uninstall banzai@parabolic-plugins --scope project --keep-data
```

## Limits

- The gate stops mistakes, not attacks. It is not a sandbox, and it is not
  protected against a model that works to get around it.
- It does not see changes to files that Git ignores, changes in a project
  outside Git, or changes a background process makes after its command ended.
- Each shell or MCP call takes about 80 ms longer on a small repository, and
  an estimated 150 ms on one with 7,000 files.
- Plan approvals, checks and reviews are no guarantee that a change is
  correct. Read the diff before you commit.

[DECISIONS.md](DECISIONS.md) gives the reason for each design choice and
what was rejected.

## Community

Report reproducible problems through
[GitHub Issues](https://github.com/Parabolic-Technologies/banzai-claude-plugin/issues).
To contribute, read [Contributing](CONTRIBUTING.md). Report vulnerabilities
through the [security policy](SECURITY.md). Changes are listed in the
[changelog](CHANGELOG.md).

## Author and license

Owned by **Parabolic Technologies, Inc. ("Parabolic")**.
Created by [Alexander Torosh](https://github.com/alexander-torosh).
Contact: [alexander@parabolic.io](mailto:alexander@parabolic.io).
Source: [Parabolic-Technologies/banzai-claude-plugin](https://github.com/Parabolic-Technologies/banzai-claude-plugin).

Banzai is licensed under the [Apache License, Version 2.0](LICENSE).
See [NOTICE](NOTICE), [third-party information](THIRD_PARTY_NOTICES.md),
[Terms of Use](TERMS_OF_USE.md), and [Names and Logos](TRADEMARKS.md).
Using Banzai does not require open-sourcing your own project. Community
participation follows the [Code of Conduct](CODE_OF_CONDUCT.md).
