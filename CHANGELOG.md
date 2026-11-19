# Changelog

All notable changes to the Banzai plugin are listed here. Versions follow
[Semantic Versioning](https://semver.org/). A change to a command name, to
the hook's decisions or to the document layout is a breaking change.

## Unreleased

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
