# Changelog

All notable changes to the Banzai plugin are listed here. Versions follow
[Semantic Versioning](https://semver.org/). A change to a command name, to
the hook's decisions or to the document layout is a breaking change.

## 1.2.2 - 2026-11-23

### Changed

- The plugin's manifest declares Claude Code 2.1.327 or later, the minimum
  the README already names.
- The README says what to do with finished works, and that a change made
  by a shell command or an MCP call you cancel with `Esc` is not found.

### Fixed

- A typed `/banzai:feature`, `/banzai:fix` or `/banzai:auto` no longer
  drops the source changes that wait for your acceptance. After
  `/banzai:feature` the hook still asks about them; where changes pass, as
  after `/banzai:fix`, they are dropped at the next call.
- `/banzai:feature` and `/banzai:auto` name a new work with ASCII letters
  and digits only, so a request in another language no longer yields a
  work the hook does not recognise.

## 1.2.1 - 2026-11-23

### Changed

- The README starts with a quick start and explains how the plugin works:
  its skills, the reviewer agent, the hook's events, the approval click and
  how a change through the shell or an MCP tool is found.

### Fixed

- When a work was already approved and a source change still waited for
  your acceptance, the approval command told the model that a dialog would
  ask you about the change, and none came. It now answers that the work is
  already approved.

## 1.2.0 - 2026-11-22

### Added

- A size limit for source and test files in planned work: the one your
  `CLAUDE.md` or `AGENTS.md` names, or 500 lines. A plan keeps files within
  it, and a file that is already past it does not get longer: new code
  goes into another file, or the file is split first. The audits of
  `/banzai:auto` check it, and a breach in a finished change is a major
  finding there and in `/banzai:review`. Files that a tool generates and
  data files are exempt.
- `/banzai:setup` offers to record a size limit in your instructions file.
  It also recommends a linter when the project has none: the commands that
  install and run it and a starting configuration that limits the size of
  a file and the complexity and length of a function. When the project's
  linter lacks such a limit or only warns, it shows the lines that set it.
  It installs no linter and changes no configuration.
- When the hook does not run, because hooks are switched off or Node.js is
  missing, `/banzai:feature` says so and asks you to approve the plan in a
  question dialog. That approval is not recorded, nothing is held back,
  and a run with nobody to answer stops before it changes source.

### Changed

- A source change that waits for your acceptance is shown in the dialog of
  the next MCP tool call as well as of the next shell command, and allowing
  the call accepts it. Before, MCP calls were refused until you had
  accepted it. A `Monitor` or `PowerShell` call is still refused.
- The README names Node.js 22 or later as the minimum, where it named
  Node.js 26 LTS. The tests run on Node.js 22, 24 and 26.
- After `/banzai:auto`, and after `/banzai:fix` while no planned work is
  attached, the hook no longer compares the project around a shell command
  or an MCP call, because every change passes there. A call takes about 30
  to 50 ms less.
- The plugin's description and the README lead with what a piece of work
  leaves in your repository.

## 1.1.0 - 2026-11-20

### Added

- `/banzai:auto <what to build>`: planned work with no approval of the
  plan. It asks its questions once, in one dialog at the start, has the
  plan and the finished change audited by an independent reviewer, fixes
  the blocker and major findings and reports in its last message. For a
  decision that is costly to reverse and that one question cannot settle,
  it stops and names `/banzai:feature`.

### Changed

- After `/banzai:auto` the session may change source files, and a plan
  written in it needs no approval. `/banzai:feature <work>` typed
  afterwards asks for the approval again.
- The approval dialog shows the plan's lines first.

### Fixed

- In the desktop app the hook no longer refuses the app's own task list
  and summary calls.

## 1.0.5 - 2026-11-19

### Changed

- `/banzai:review` stays inside the working copy. The reviewer runs local
  checks only and calls no external or deployed system. Claims that need
  one are listed as not checked, and you are asked before any live check.
  Name the systems in the request to allow live checks from the start.

## 1.0.4 - 2026-11-19

### Added

- `/banzai:epic start` accepts a goal instead of a brief. The command
  reads the project, asks what changes the scope, the order or the split
  (at most two question dialogs of four questions), writes the brief,
  tracker and log, and shows the plan. You change the brief by saying what
  to change. A choice nobody asked you about is marked `(proposed)`. A
  brief you bring is still stored as given.

### Changed

- A `/banzai:epic` request that names no mode and describes new work runs
  `start`. An empty request still runs `next`.

## 1.0.3 - 2026-11-19

### Changed

- The commands read a project's `AGENTS.md` as well as its `CLAUDE.md`.
  `/banzai:setup` records commands in `AGENTS.md` when the project has no
  `CLAUDE.md`, instead of creating one.

## 1.0.2 - 2026-11-19

### Added

- The README describes installing the plugin for all your projects with
  `--scope user`.

### Changed

- The approval dialog lists the files that "Yes" approves one per line, and
  both dialogs mark each file with a bullet.

## 1.0.1 - 2026-11-18

### Changed

- At session start the hook tells Claude that only a typed command counts,
  not one started through the Skill tool.
- `/banzai:feature` records only decisions that are costly to reverse, and
  asks what to change when a "No" does not say, instead of showing the same
  plan again.
- An icon, keywords and fuller descriptions in the plugin listing.

## 1.0.0 - 2026-11-18

The first version of the plugin. It needs Claude Code 2.1.327 or later and
Node.js 26 LTS or later.

### Added

- Five commands that the developer types: `/banzai:setup`, `/banzai:fix`,
  `/banzai:feature`, `/banzai:review` and `/banzai:epic`.
- A hook that asks the developer before source files change: each change
  asks when no command was typed, `/banzai:fix` opens the session for direct
  changes, and after `/banzai:feature` the file tools write no source file
  before the plan is approved.
- Plan approval with one click, in a dialog that quotes the plan's "For
  approval" section and names the approved files. The approval is bound to
  the content of those files and ends when one of them changes.
- Detection of source changes made through the shell and other tools. Such
  a change is found after the call and shown to the developer in the dialog
  of the next shell command.
- An independent review by a reviewer with fresh context, checked again
  before it is reported.
- Epic documents for large work split into stages and packages.
