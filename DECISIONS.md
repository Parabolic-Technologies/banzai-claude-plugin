# Decisions

Decisions about the plugin's own development that are costly to reverse or
not obvious. Each entry gives the decision, the reason and what was rejected.
The observations behind them were made on Claude Code 2.1.326 and 2.1.327,
in the terminal client.

## 2026-11-17: The approval click is the hook's answer to a no-op shell command

When a plan is ready, the `feature` step runs `: banzai-request-approval
<work>` alone, on one line. The hook answers it with `ask`, and its reason,
composed by the hook, names the work and the files it will hash. The record is
written when the host reports that the same tool call ran, which happens only
after the developer answered "Yes".
Reason: the host shows a hook's reason in the dialog for a shell command and
hides it in the dialog for a file write, so a click on a write would approve
files the developer cannot see.
Rejected: asking on the first source write; a question asked in chat (planned
for later, as a second way to approve); a real executable with that name.

## 2026-11-17: Only a typed entry command gives the session approval

Only `/banzai:fix`, typed by the developer and marked by the host as a plugin
command, lets a session change source without a plan. `/banzai:feature`
allows no source write until a plan exists and is approved. With no entry
command, every source write asks, and a "Yes" covers that one change. In a
headless run the entry command counts as the consent of whoever launched it.
Reason: the prompt-submit event also fires for scheduled prompts and task
notifications. The host lets a model start these skills only when the
developer's message names the command with its slash, and such a start
raises no expansion event. So the expansion event is the one signal that a
human chose the command. A "Yes" on a write dialog cannot unlock the session,
because that dialog hides the hook's text.
Rejected: reading the prompt text; one "Yes" on a write unlocking the session.

## 2026-11-17: Planned work outranks the session approval

A session attached to a work passes a source write only when the work's
record is valid and the developer named or approved that work in this session:
by typing `/banzai:feature <work>`, or by answering "Yes" to the approval
dialog. Writing a plan with a file tool attaches the session but clears
nothing. Only a typed entry command detaches it; a missing plan denies.
Reason: otherwise typing `/banzai:feature` would itself approve a plan nobody
has read, and a model could move the session onto old approved work by
running the approval command for it or by rewriting its plan unchanged.
Rejected: scanning `documentation/work/` for any plan, which would block
unrelated small fixes; trusting a valid record from another session.

## 2026-11-17: An approval is bound to file contents and kept in the project

The record lists `requirements.md` (when present), `plan.md` and the decision
records the plan links to, each with its SHA-256. It is valid only while the
same list with the same hashes is on disk, so any change to an approved file
ends it. Records live under `.banzai/approvals/` in the project, which
projects keep out of Git. The hook denies file-tool writes there, and creates
the directory first so that the file system resolves every spelling it treats
as equal.
Reason: an approval must mean "these bytes", and it must survive a new
session without a second click on unchanged files. A record that goes missing
only makes the gate stricter, so it can stay where a cleanup may remove it.
Rejected: timestamps; hashing every file in the work directory.

## 2026-11-17: Shell and MCP changes are detected, then asked about

The host does not say which files a shell or MCP call changed, so the hook
compares source before and after each call: the files Git lists as changed or
untracked and those it was told to skip, with what the work tree, the index
and the commit hold. A change the file-tool rules would not have passed is
remembered and shown to the developer, and the next shell command asks with
the list; "Yes" accepts what the dialog showed. An MCP call is denied until
then, because only the shell's dialog is known to show the hook's text. A call
that cannot be compared counts as a change.
Cost: about 80 ms per call on a small repository, and an estimated 130 to
160 ms on one with 7,000 tracked files. Not seen: projects outside
Git, ignored files, and changes by background processes after the call ends.
Rejected: asking before every shell command; parsing commands for writes;
hashing every tracked file.

## 2026-11-17: State files are sealed

Every state file carries an HMAC of its name and content under a key in the
plugin's data directory; a record's name includes the project's path. A file
without a valid seal is read as absent, so a file written, edited or copied
to another name by anything but the hook approves nothing. Session state,
the entries for running tool calls and the lock live in that data directory
too, outside the project, and file tools cannot write there.
Reason: a command that cleans, moves or resets the project must not remove
what the gate knows about the session, and Git cannot show `.banzai/`.
Limit: a process that reads the key, or copies an older sealed file of the
same session back, can forge state. This stops stray and naive writes.
Rejected: session state in the project; restoring state from a snapshot.

## 2026-11-17: The gate has no opt-out under `bypassPermissions`

The hook behaves the same in every permission mode.
Reason: the host shows the hook's `ask` dialog in every interactive mode,
`bypassPermissions` included, so an opt-out for that mode is not needed for
the flow to work, and having none leaves one behaviour to test. A developer
who wants no gate disables the plugin for the project.
Rejected: an opt-out under `bypassPermissions`.

## 2026-11-17: Outside the gate's reach the hook gives no decision

The project is the nearest directory with `documentation/work/` at or above
the host's project directory, then the working directory, then, for a file
write, the target. It is fixed at the session's first event that finds one.
The hook stays silent when there is no project, for targets outside it, and
for documentation and notes files. It never answers `allow`: an approved
work that asks again gets a denial that says so.
Reason: a hook `allow` would override the host's own permission rules; the
model can move the working directory and rename or create directories, so
the project is not looked up again; and a plugin that blocks ordinary work in
projects that never adopted it gets uninstalled.
Rejected: `allow` for free paths or for a repeated approval command; looking
the project up on every event.

## 2026-11-17: Names

The project command is `setup`, because `/init` is a host built-in and plugin
commands are reachable only as `banzai:<name>` anyway. The marketplace is
`parabolic-plugins`, so the install id is `banzai@parabolic-plugins`.
Rejected: `init`.

## 2026-11-18: Approved files do not change while the work runs

A plan has no task checkboxes, and progress, deviations and check results go
into `report.md`. A decision record is accepted by the developer, in chat,
before the plan that links it is written.
Reason: the approval is bound to the content of `requirements.md`, `plan.md`
and the linked records, so ticking a task or changing a record's status after
the click would end the approval in the middle of the work.
Rejected: leaving progress marks or the status line out of the hash.

## 2026-11-18: An independent review is a fresh-context reviewer, then a check

`review` starts one subagent that has not seen how the change was made and
gives it paths and commands only: the requirements, the plan, the linked
decision records, the diff and the report as claims to check. The session
that started it reproduces every finding, or reads the cited code, before it
writes `review.md`, and drops what it cannot confirm. A review changes no
source file; fixes go through `fix` or `feature`.
Reason: a reviewer that receives the author's summary tends to confirm it,
and a reviewer's mistakes arrive in the same confident tone as its findings.
Both reviews of this hook ran this way, and their findings were checked
again before they were reported.
Rejected: a review in the session that wrote the change; a reviewer that
also applies fixes; a separate reviewer agent shipped by the plugin.

## 2026-11-18: A skill may read its own step files without a prompt

`feature` and `epic` carry `allowed-tools: Read(/${CLAUDE_SKILL_DIR}/**)`.
Reason: outside `auto` mode the host asks before it reads a file in the
plugin's directory, so every step guide would cost a dialog. The leading
slash makes the rule an absolute path. Checked headless in `default` mode
with `--plugin-dir`: the skill's own files are read, other files outside the
project are still refused. Checked again on 2.1.327 with the plugin
installed from a marketplace. Not checked: a later turn of the same session.
Rejected: all steps in one `SKILL.md`; a blanket `Read` permission.

## 2026-11-18: The model asks where a wrong guess is costly and shows its other choices before the click

Owner decision. In the `requirements` step the model asks, and waits for the
answer, only about substance: what the feature covers and for whom, where the
request can be read in ways that give users different things and none is
clearly better. It asks three questions at most, each with a recommended
answer. It decides the form itself (names, codes, formats, messages, error
behaviour), tags each such choice `default`, and names those choices in the
plan's "For approval" section, which the approval dialog shows.
Reason: the dialog shows file names only, and the review of the skills found
the model's own choices recorded as the developer's or as a project
convention, under "Open questions: None." Asking about every open choice
would add a second stop before each feature and teach the developer to
answer without reading.
Rejected: every choice that no source decides blocks the plan as an open
question.

## 2026-11-18: The approval dialog quotes the plan's "For approval" section

Owner decision. A plan starts with a section "For approval": one to five
lines of at most 72 characters that say what will be built and name each
choice the developer did not make. The hook quotes these lines in the
approval dialog, before the file names, and refuses an approval request for
a plan without such a section.
Reason: a summary written in chat before the dialog appeared on Haiku only.
Sonnet and Opus kept it in their reasoning through three wordings of the
skill, so the developer approved file names. The quoted lines are part of a
hashed file: changing them ends the approval. The host's dialog shows up to
twelve rows of a hook's text, its own first row included, fewer in a short
terminal, and folds the rest. At 80 columns a row holds 72 characters, so
five such lines, the hook's other three rows and three file names fit.
Not checked: the desktop app and the IDE extensions.
Rejected: a stop before the dialog for a summary in chat, which makes two
steps of one click; leaving the developer to open `plan.md` first.
After an independent review of this change, two cases that happen by
accident are refused: a plan with two such sections, where the dialog would
quote the stale one, and an approval request while source files changed
through the shell still wait for the developer, whose list would push the
quote out of the visible rows. Those files are accepted first, in the dialog
of an ordinary shell command.
Limit, by owner decision: the quote is not protected against a model that
works to mislead. A plan swapped between the hook's two reads, a section
hidden in a comment or a code block, a line that imitates the hook's own
text and invisible or direction-changing characters are not handled, and
the width counts characters, so lines in wide scripts fold. The plugin is
for developers on their own projects, and the gate stops mistakes, not an
attack.

## 2026-11-18: `setup` declares the marketplace, and each developer installs once

Owner decision. `setup` writes two keys into the project's
`.claude/settings.json`: `enabledPlugins["banzai@parabolic-plugins"]` and an
`extraKnownMarketplaces` entry for `parabolic-plugins` with the GitHub source
`Parabolic-Technologies/banzai-claude-plugin`. Each developer still runs
`claude plugin install banzai@parabolic-plugins --scope project` once, after
an interactive session in the project has fetched the marketplace.
Reason, observed on Claude Code 2.1.327 with a marketplace cloned from a
local Git repository: with `enabledPlugins` alone the host loads nothing and
says nothing. With both keys an interactive session clones the marketplace
after the developer trusts the folder, but installs no plugin; a headless
session does neither. After the install command the plugin loads from the
host's cache, `feature` reads its step files there without a prompt in
`default` mode, and the full flow with the approval click works.
Also observed: a marketplace added as a local directory loads the plugin
from that directory, not from the cache. Uninstalling the plugin deletes the
hook's data directory with the seal key, so approval records made before no
longer count and each work needs one new click.
Not checked: installing from GitHub itself and an update to a new version.
Rejected: `enabledPlugins` alone; leaving both commands to the README.

## 2026-11-19: `setup` never creates a `CLAUDE.md` beside an `AGENTS.md`

The commands read the project's `CLAUDE.md` or `AGENTS.md`. `setup` adds a
missing command to the file that already holds the project's facts, and
creates `CLAUDE.md` only when the project has neither file.
Reason: by default Claude Code loads `AGENTS.md` only while the project has
no `CLAUDE.md` (its `instructionFiles` setting, `claude-md-or-agents-md`).
A new `CLAUDE.md` with a few commands would silently take the team's
`AGENTS.md` out of every session.
Rejected: always writing to `CLAUDE.md`; creating a `CLAUDE.md` that only
imports `AGENTS.md`.

