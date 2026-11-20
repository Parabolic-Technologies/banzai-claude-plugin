# Banzai

**Spec-driven development for Claude Code with a human in the loop: the AI
agent writes the plan, you approve it with one click, then it writes the
code.**

[![CI](https://github.com/Parabolic-Technologies/banzai-claude-plugin/actions/workflows/ci.yml/badge.svg)](https://github.com/Parabolic-Technologies/banzai-claude-plugin/actions/workflows/ci.yml)
[![License: Apache-2.0](https://img.shields.io/badge/License-Apache--2.0-blue)](LICENSE)

An AI coding agent tends to start writing code before you have agreed on
what it should build. Banzai is a Claude Code plugin for developers who want
the agent to work from a spec and an approved plan instead.

![The approval dialog in a terminal: it quotes four lines of the plan, names the file the answer approves, and offers Yes and No.](assets/approval-dialog.svg)

Banzai adds a workflow of five slash commands and one guardrail hook that
asks you before source files change:

- **Plan approval** with `/banzai:feature`. Planned work gets written
  requirements and a plan, and Claude Code's file tools write no source file
  until you approve that plan with one click.
- **Guardrails.** A change through the shell or an MCP tool cannot be
  stopped beforehand; it is found after the call and shown to you.
- **Independent code review** with `/banzai:review`. A finished change can
  be reviewed by a fresh subagent that has not seen how it was made.
- **Quick fix** with `/banzai:fix`. A small change needs no plan: you type
  the command and it runs directly.

Requirements, plans, decisions, reports and reviews are ordinary Markdown
files in your project, so you can read, diff and commit them.

Compared with Claude Code's plan mode: the plan is a file in your project,
your approval is bound to that file's content, and it still holds in a new
session.

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

Add the marketplace:

```bash
claude plugin marketplace add Parabolic-Technologies/banzai-claude-plugin
```

Then install the plugin either for one project, from that project's
directory:

```bash
claude plugin install banzai@parabolic-plugins --scope project
```

or for all your projects:

```bash
claude plugin install banzai@parabolic-plugins --scope user
```

With a user install the commands are available in every project, but the
hook acts only in a project that has `documentation/work/`, which `setup`
creates; everywhere else it stays silent.

Then start Claude Code in the project and type:

```text
/banzai:setup
```

`setup` prepares the project once and is safe to run again. It:

- adds `.banzai/` to `.gitignore`;
- enables the plugin and names its marketplace in `.claude/settings.json`;
- creates `documentation/decisions/` and `documentation/work/`;
- offers to record the project's build, test, lint and format commands in
  your `CLAUDE.md`, or in your `AGENTS.md` when there is no `CLAUDE.md`, and
  asks before it writes them.

Now give it a first piece of work in your own words, for example:

```text
/banzai:feature let the greet CLI print the greeting in upper case
```

The model writes a plan and shows the approval dialog. After your "Yes" it
writes the code and the tests.

### For a team

Commit the files `setup` wrote so that your team shares them. The settings
make the marketplace known to a teammate's Claude Code but install nothing.
Each teammate opens the project in Claude Code once and trusts the folder,
which fetches the marketplace, and then runs one of the install commands
above.

## Commands

You type every command yourself; the model cannot start one.

| Command                           | Use it for                                                        |
| --------------------------------- | ----------------------------------------------------------------- |
| `/banzai:setup`                   | Prepare a project, once.                                          |
| `/banzai:fix <what to change>`    | A small, direct change with no plan.                              |
| `/banzai:feature <what to build>` | Planned work: plan, your approval, code, tests, report.           |
| `/banzai:review [work]`           | An independent review of a finished change.                       |
| `/banzai:epic <mode>`             | Work too large for one plan; see [Large work](#large-work).       |

Always type the full name. A bare `/review` is a different command.

A *work* is one change with its own directory,
`documentation/work/<work>/`. Its name is the date and the subject, such as
`261118-greet-upper-case`, and that name is what `[work]` stands for.

## How planned work goes

1. You type `/banzai:feature` and say what to build.
2. When the request leaves open what users get, the model asks you up to
   three questions, each with the answer it recommends. It decides matters
   of form itself, such as names and messages, and marks each such choice.
3. The model writes `plan.md` in the work's directory. A larger request
   first gets `requirements.md`, and a choice that is costly to reverse gets
   a decision record under `documentation/decisions/`, which you accept in
   chat before the plan is written.
4. An approval dialog appears. It quotes the plan's "For approval" section,
   which says what will be built and names each choice the model made for
   you, and it names the files your answer approves.
5. "Yes" approves exactly those files as they are. If one of them changes
   later, the approval ends and the dialog comes again.
6. The model writes the code and the tests, runs the project's checks and
   completes `report.md`.
7. `/banzai:review <work>` starts a reviewer with fresh context and writes
   `review.md`. A review changes no source file; you choose what to fix.

When the work is done, your project holds:

```text
documentation/
├── decisions/                decision records
└── work/
    └── 261118-greet-upper-case/
        ├── requirements.md   what must be true when it is done
        ├── plan.md           how it will be built
        ├── report.md         what was built and how it was checked
        └── review.md         what the reviewer found
```

To continue a work in a new session, type `/banzai:feature <work>`. An
approval of unchanged files still holds.

## Large work

`/banzai:epic` keeps track of work that is too large for one plan. The work
is split into stages and packages, and each package is then built with its
own `/banzai:feature` or `/banzai:fix`. Bring your own plan, or give only
the goal: the command asks a few questions, writes the plan and shows it,
and you change it by saying what to change. It keeps the epic's plan,
tracker and log in `documentation/epics/<epic>/` and changes no source file.

| Mode              | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `start <subject>` | Stores your plan, or drafts one from your goal and answers.          |
| `next`            | Reports where the epic stands and names the next package to build.   |
| `record <entry>`  | Records a started or finished package, a question or a decision.     |
| `gate <N>`        | Lists the evidence for a stage's gate; you decide whether it passed. |

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
  each shell command asks again and MCP calls are refused, except the
  desktop app's own task list and summary.

The approval dialog shows up to five lines of at most 72 characters from the
plan's "For approval" section, and they come first in its text. When the
list of approved files is long, the terminal folds its end out of view. The
desktop app shows about three rows of the text and scrolls the rest.

The hook behaves the same in every permission mode, `bypassPermissions`
included.

In a run with nobody to answer (`claude -p`), every question of the hook is
refused. `/banzai:fix` still works. A plan cannot be approved, a run with no
command typed cannot change a source file with the file tools, and after a
change through the shell is found, the run's later shell and MCP calls are
refused.

## Disable or uninstall

To work without the hook, disable the plugin:

```bash
claude plugin disable banzai@parabolic-plugins
```

Approval records are kept in `.banzai/approvals/` in the project, outside
Git. Losing them costs one new click per work. Uninstalling the plugin
deletes the hook's data, and approvals made before then no longer count. To
uninstall and keep them, give the scope you installed with, `project` or
`user`:

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
To contribute, read [Contributing](.github/CONTRIBUTING.md). Report
vulnerabilities through the [security policy](.github/SECURITY.md). Changes
are listed in the
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
participation follows the [Code of Conduct](.github/CODE_OF_CONDUCT.md).
