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
Since 2026-11-20 `/banzai:auto` is a third entry command; see its entry.
Rejected: reading the prompt text; one "Yes" on a write unlocking the session.

## 2026-11-17: Planned work outranks the session approval

A session attached to a work passes a source write only when the work's
record is valid and the developer named or approved that work in this session:
by typing `/banzai:feature <work>`, or by answering "Yes" to the approval
dialog. Writing a plan with a file tool attaches the session but clears
nothing. Only a typed entry command detaches it; a missing plan denies.
A session started with `/banzai:auto` is the one exception; see the entry of
2026-11-20.
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
the list; "Yes" accepts what the dialog showed. Until 2026-11-22 an MCP call
was denied until then, because only the shell's dialog was known to show the
hook's text. A call that cannot be compared counts as a change.
The hook's matcher leaves out the desktop app's own turn tools,
`mcp__ccd_turn__*`, which draw its task list and its end-of-turn summary.
Seen on 2026-11-20: with an unaccepted change in the session, the hook
refused the app's summary call and the summary failed. Every other MCP tool
is still compared.
Since 2026-11-21 a call is not compared in a session whose source changes
pass whatever the project holds: after `/banzai:auto`, and after
`/banzai:fix` while no planned work is attached. Nothing found there would be
held back, so the hook keeps no record of the call, and it no longer asks
about a call it cannot record. When the session's changes no longer pass by
the end of a call, because a planned work was attached to it or
`/banzai:feature` was typed while the call ran, that call was not compared
and counts as a change, even if it changed nothing.
Since 2026-11-22 an MCP call asks as a shell command does, with the same
list, and allowing it accepts the list. It also asks, where it was denied,
when the hook cannot record the call or fails. Seen on Claude Code 2.1.330
in a terminal: the dialog of an MCP tool shows the hook's text in full, in
the modes `default` and `auto` and when a rule already allows the tool, and
the host reports the call afterwards under the same id. `Monitor` and
`PowerShell` are still denied and sent to the shell, because their dialogs
were not seen. Not checked: the desktop app's dialog for an MCP tool, and
the mode `bypassPermissions`.
Cost: about 80 ms per call on a small repository, and an estimated 130 to
160 ms on one with 7,000 tracked files. Where the call is not compared it is
about 30 ms less on a small repository and about 50 ms less with 7,000
tracked files, measured on 2026-11-21. Not seen: projects outside
Git, ignored files, and changes by background processes after the call ends.
Rejected: asking before every shell command; parsing commands for writes;
hashing every tracked file; letting MCP calls pass while a change is
unaccepted, which leaves nothing to stop a tool that edits source through
MCP.

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
Seen on 2026-11-20 in the desktop app: its dialog shows about three rows of
the hook's text above a scroll bar, drops the line breaks, and names its
buttons "Allow once" and "Deny". So the quoted lines come first in the
hook's text, before the work's name, and the text names no button. The
skill also asks for a tool call description that says what is approved: the
desktop app shows that line in full. Sonnet and Opus wrote it in three runs
of that day, and kept a fourth wording of the chat summary in their
reasoning again.
Not checked: the IDE extensions.
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

## 2026-11-19: `epic start` plans a goal with the owner and writes the brief once

Given a goal instead of a brief, `start` reads the code, asks what changes
the scope, the order or the split in the host's question dialog, writes
`brief.md`, the tracker and the log once, and then shows the plan in its
reply. It asks for no approval before it writes: the owner changes the brief
by saying what to change. The command writes only under
`documentation/epics/`. A brief the owner brings is still stored as given.
Reason: an owner rarely arrives with stages, gates and "Done when" items.
In a session of 2026-11-19 the command showed the template and stopped, the
model then kept a draft in an ignored directory outside `documentation/`,
and the hook asked before each of ten writes to it, four for every answer
the owner gave. Answers given in a dialog cost no write, and files under
`documentation/` are outside the gate.
Observed on Claude Code 2.1.328 with Opus 5.5, three interactive runs: told
to show the plan before the question dialog, the model composed it in its
reasoning, and the terminal showed one line of summary, so a question
"create the epic from this plan?" asked about a plan nobody had seen. The
reply at the end of the turn is always shown, so the plan goes there, after
the files exist. A headless run asks in its reply and writes after the
answers arrive.
The host's dialog takes four questions, so the questions are ranked by how
much of the plan each changes, and a second dialog may follow the first.
Two dialogs, eight questions, are the limit: a detail of one package is
asked later by that package's own `feature`, and asking about every open
choice teaches the owner to answer without reading. Observed with a goal of
seven parts: Opus 5.5 asked eight questions in two dialogs, Sonnet 5.5
asked four in one and decided the rest itself.
Cost: the brief may hold the model's wording, so a drafted brief marks each
choice nobody was asked about as `(proposed)`, and the log says the brief
was drafted. The owner reads the stages after the files are written.
Rejected: a draft file edited after every answer; an approval question
before the files are written; dialogs without a limit; treating ignored files as free in the hook,
because `.env` is one; a separate `draft` mode.

## 2026-11-19: A review stays inside the working copy

The reviewer reads the project's files and runs its local checks. It calls
no external or deployed system, not even to read, and reads no credentials.
A claim that can be checked only against such a system is listed as not
checked; the session then asks the developer whether to check it live. The
developer may allow live checks in the request by naming the systems.
Reason: the brief said "read anything" and "run the checks again", and a
subagent cannot ask the developer. Observed on a project whose report
claimed a check on a staging stack: the reviewer queried the cloud account
and read a chat token from `.env` to repeat that check, and the session had
added the project's access rules to the brief on its own.
Rejected: a question before the reviewer starts, which blocks every review;
a list of forbidden tools in the hook.

## 2026-11-20: `/banzai:auto` runs planned work without the approval click

Owner decision. A third entry command, typed by the developer, lets a
session plan, build, review and fix one request with no approval of the
plan. To the hook such a session passes every source change, as after
`/banzai:fix`, and a plan written in it closes nothing. The approval command
still asks when it is run, and typing `/banzai:feature <work>` afterwards
puts the work behind the approval again.
The command asks the developer once, before any file is written: up to four
questions of substance in the session's question dialog. It stops there, and
again after the plan's audit, when the work decides something that is costly
to reverse, and names `/banzai:feature`. One such decision that a single
question settles goes into the dialog instead, and the developer's answer
decides it; with no dialog the command stops. After that it asks nothing and
reports in its last message.
Two audits take the place of the developer's reading: one of the plan before
any source change, one of the finished change. Each runs as a hidden skill
with `context: fork` and the plugin's own agent, which has no file-writing
tool. The session confirms each finding, fixes the confirmed `blocker` and
`major` ones and has the change audited once more; one round of fixes is the
limit. `/banzai:review` is unchanged and fixes nothing.
Reason: whether a person must read a plan before the code is written depends
on the task, not on the project, and a typed command is already how the
developer gives their word. Seen on Claude Code 2.1.329 with Sonnet: a typed
skill started the hidden skill, which ran as the plugin's agent and saw no
earlier conversation. With `background: false` it returned in the same turn,
while an agent started through the `Agent` tool went to the background and
ended the turn. The agent named no `Write` or `Edit` among its tools.
The hook gives no notice when such a plan is written. The terminal shows a
hook's `systemMessage` under the tool's result, but the desktop app folds it
two clicks deep, so the last message carries the plan.
This takes back, for this command only, the rejection of "a separate
reviewer agent shipped by the plugin" of 2026-11-18.
Runs of 2026-11-20 on Sonnet and Opus. Two early runs led to corrections of
the text: one asked nothing about a request that named no language and
chose one itself, and one ran the approval command out of habit, which the
session-start text had taught it. After that both models raised the dialog,
with two questions, for the open request; both stopped at once and changed
nothing for a new dependency and for data kept between runs; and on a work
with a seeded defect that its tests did not catch, both reported it as a
blocker, fixed it with a failing test first and had a second audit confirm
it closed. A run in the desktop app on 2026-11-20, on Opus, raised the dialog
with three questions and went through to its last message. Its plan audit
built the planned change in a copy to try it, and a minor finding of that
audit, left open as the text then said, came back from the change audit.
Since then the plan audit reads and runs only what exists, and the session
corrects minor findings of the plan too. Not checked: Haiku.
Rejected: a mode per project, chosen in `setup`, because every rule of the
hook and every public statement would then depend on a setting, and a commit
could switch a team's approval off; removing `disable-model-invocation` from
`review` so that it could be called, because its description would load into
every session and its text forbids fixes; questions at a later point of the
run.

## 2026-11-21: The commands' behaviour is checked with the host's `claude plugin eval`

The plugin carries eight eval cases in `plugins/banzai/evals/`, run by
`npm run eval`. Each starts a real run of one prompt in a small project that
a scaffold script builds, and is graded by the files the run left, by its
tool calls and, in six cases, by a model that reads the last message. A typed
`/banzai:fix` changes a source file and its test. A file-tool write with no
entry command changes nothing. `/banzai:feature` writes a plan, asks for the
approval and stops. `/banzai:auto` writes its documents, has both audits run
and never runs the approval command. `/banzai:auto` in a project whose main
source file is past the size limit builds the change and leaves that file
no longer than it was. `/banzai:review` of a finished work
that misses a requirement its tests do not cover starts the reviewer,
records the defect with the verdict `changes needed` and changes no source
file. `/banzai:setup` in a project that was never set up creates the work
directory and the decisions index, recommends a linter and installs none.
In a project whose linter only warns about complexity, it shows the lines
that set the limits as errors and leaves the configuration as it is.
Reason: the tests cover the hook only, and how the commands behave was
checked by hand on the day a text changed, so a new model or host release
could break a command unnoticed.
Seen on Claude Code 2.1.330 with Sonnet: an eval run executes the plugin's
hooks; a prompt that starts with an entry command raises the expansion event
as a typed command does; the run's permission mode, `dontAsk`, returns the
hook's `ask` to the model as a refusal with the hook's text; and the forked
audit runs as the plugin's agent and returns in the same turn. The eight
cases take about five minutes and 1.20 USD. A run needs the machine awake:
on 2026-11-22 three runs of one case stopped in the middle of an answer
while the Mac slept, and timed out.
Seen on 2026-11-22 with other models and repeated runs: one run of the
eight on Haiku passed every case, for 0.34 USD. Three runs on Sonnet passed
every case but one run of `setup-linter-only-warns`, whose skill text was
then changed (see the entry on the linter). One run on Opus cost 3.29 USD
and passed seven cases. In `feature-waits` the run was right and a grader
was wrong: the hook refused the first approval command for the plan's "For
approval" section, Opus shortened the section, ran the command again and
stopped, and two of three model graders, which saw the trace with its
middle left out, voted that it had not stopped. Two patterns over the whole
trace replaced that grader, and the case then passed on Opus. A fourth and
a fifth run on Sonnet, the fifth on the texts and graders as they stand,
passed all eight.
Limits: in the run's sandbox the model and the reviewer have no `git`, so
the audits see no diff. No grader runs a command, so that the project's
tests pass is read from the tool call and the last message. A grader reads a
file by its exact path and the name of a work holds the date, so the content
of a plan is not graded. A grader sees which files a run created, not what
changed in them. A model grader that reads the trace sees only its first
and last twelve messages, so no case uses one: what a run did in the middle
is graded by a pattern over the whole trace. The pattern in `feature-waits`
knows the file tools by name, so a file written through the shell after the
request passes it. The host takes a scaffold script from the case's own
directory only, so each case has a three-line script that reads the shared
`fixture.sh`. The run's permission mode refuses the write of
`.claude/settings.json` and nobody answers a question, so the `setup` cases
grade neither the settings file nor the lines for the instructions file.
Their graders of the last message know how ESLint spells a rule and a
severity, so a right report that recommends another tool fails them.
The cases need a signed-in host and are not part of CI.
Not checked: more than one run of a case on Opus or Haiku, a review of a
work that has no defect, and the command `epic`.
Rejected: a harness of our own around `claude -p`; cases outside the
plugin's directory, where the host's command does not look; running them in
CI, which needs an API key in a public repository.

## 2026-11-21: Without the hook, `feature` asks for the approval in the question dialog

When the approval command returns and no hook message follows, the `feature`
step says that the hook is not running, then asks for the approval in the
session's question dialog, with the plan's "For approval" lines and the
plan's path in the question and the options "Approve" and "Change the plan".
It goes on after "Approve". With no such dialog, or with nobody to answer
it, it stops and says that the plan waits.
Reason, seen on Claude Code 2.1.329 with the plugin's hooks removed, and
with a hook command that fails as on a machine without Node.js: Sonnet and
Opus wrote the plan, ran the command, got an empty result and stopped. None
changed source, and each asked for a confirmation in chat that the skill did
not describe, so without the hook the work could not be finished and what
followed a reply was left to the model. In `acceptEdits` mode the host
raised its own dialog for the command; it showed the tool call's description
and the command, not the plan's lines.
With the new text, on 2.1.330 with the hooks removed: in an interactive
session Sonnet asked in the dialog with the lines and the path in the
question, built and tested the change after "Approve", and stopped and asked
what to change after "Change the plan". A headless session has no such
dialog; Sonnet and Opus stopped there and changed no source.
Limit: this approval binds nothing. No record is written, no file is hashed,
a later change to the plan is not detected, and nothing holds the file tools
back. It keeps the developer's reading of the plan before the code, and no
more.
The step also says why the approval command never shares a message with a
write: the hook reads the plan when the command starts. In five of six
runs on Sonnet without the hook the plan's write and the command had been
sent in one message, three of them after the text asked for "the only tool
call of its message". With the reason given, three runs of three sent them
apart. By the hook's code, a command sent too early is refused for a
missing plan, or its dialog quotes the plan as it was; this was not run.
Not checked: Opus in an interactive session, the modes `default` and
`acceptEdits` with the new text, and a failing hook command with the new
text.
Rejected: taking the silent return for "Yes"; stopping for good, which
leaves the command useless where hooks are switched off or Node.js is
missing; a confirmation typed in chat, which the model would have to
interpret; the question dialog as a second way to approve while the hook
runs, which is still not built.

## 2026-11-22: A file that is past a size limit does not grow

The plan step keeps source and test files within the project's size limit:
the one its `CLAUDE.md` or `AGENTS.md` names, or 500 lines when neither
names one. A task that would take a file past the limit, or leave a file
that is already past it longer than it was before the work, puts the new
code in another file, or an earlier task splits the file. Such a file may
still change. The implement step keeps to the limit where a task as written
would break it, keeps the public contracts the plan fixes, and records the
move as a deviation when the plan named the file. Both audits of
`/banzai:auto` and the reviewer of `/banzai:review` check it. A breach in
a built change is a `major` finding, so `/banzai:auto` fixes it, unless
the fix needs a different design, and the verdict of a review is `changes
needed`: a finding left open is a warning, and a limit that only warns does
not hold. `setup` offers to record a limit in the project's instructions:
the one the project's linter sets on the length of a file, or 500 lines.
Files that a tool generates and data files are exempt.
Reason: an agent adds new code to the file that already owns the behaviour,
and the rules "the smallest change", "no unrelated refactoring" and "reuse
what the project has" keep it there, so a file grows a little with every
piece of work and nothing in the skills pushed the other way. Test files
are no exception. This repository's one test file of 920 lines ran in 31
seconds; split into four files, the same 65 tests run in 11 seconds,
because the test runner starts the files side by side and runs the tests
of one file in turn.
The rule first read "no new behaviour in a file that is already past the
limit". Whether a change is new behaviour is a judgment; the length of a
file is a count, which the implement step, an audit and a grader make the
same way. Under the first wording a run changed an existing function in
such a file, as its plan said, and left the file three lines shorter: a
breach by the letter, and no growth. The runs below were made under the
first wording, except the last.
Seen with the eval case `auto-large-file` on Claude Code 2.1.330 with
Sonnet, one run each, in a project that names no limit and whose main
source file has 519 lines: without the rule the run wrote the new behaviour
into that file; with it, the run moved the command line's parsing into a
new file and said in its last message that the first file is over 500
lines. In a second run with the rule the plan first put the behaviour into
that file; the plan audit reported it and the plan was corrected before
any code.
Seen in a terminal session on Sonnet, where `/banzai:feature` continued a
work whose approved plan named that file for both tasks: while the
implement step only pointed at the limit of the plan step, which such a
session never reads, the run wrote everything into that file and reported
no deviation. With the limit stated in the implement step, the run counted
the file's lines, wrote the command line's code into a new file, recorded
the deviation and named the file as a follow-up; it still changed the
existing function in that file, as the plan said, and the file ended three
lines shorter.
The eval case also passed in one run on Haiku and in one on Opus.
Under the present wording, in one run of the case on Sonnet, the run wrote
the command line's parsing into a new file, and the large file ended at 515
lines. In a terminal session on Sonnet, `/banzai:feature` continued the
same work as above: the run counted the file's lines, wrote the command
line's code into a new file, changed the existing function in the large
file, which ended at 516 lines, and recorded the deviation. The words
"before the work", the clause on public contracts in the implement step and
the limit `setup` takes from a linter came after these two runs, from a
review. In one more run of the eval case, with those words in place, the
plan split the file first: the templates went into two new files of 251
lines each, the large file re-exports them and ended at 21 lines, and the
run recorded as a deviation that the plan had named one new file, which
would have had 503 lines.
500 is a convention, not a measurement. A project sets its own number in
its instructions.
Rejected: rules in the skills on architecture, on paradigms or on a
test-first order of work, which differ by project, belong in its
instructions and decision records, and, for an order of work, cannot be
checked from what a piece of work leaves; a limit that the hook enforces,
which is a new mechanism and would refuse in the middle of a change; no
default, which leaves a project that names no limit with none.
Not checked: under the present wording, more than one run of each kind,
Opus and Haiku, and a task whose new lines cannot move out of such a file;
a move that would change a public contract; `setup` in a project whose
linter limits the length of a file and whose instructions name no limit; a
size finding in a change audit or a review, which no case produces;
`/banzai:fix`, which has no such rule; `/banzai:feature`, whose plan no
eval case grades; a project that names its own limit; a file that a task
would take past the limit, as opposed to one already past it. In the one
run of `setup` in a project that names no limit, the report offered a line
with 500 lines for the instructions file.

## 2026-11-22: `setup` recommends a linter and installs none

When a project has no linter, `setup` names one in its report: a single
tool that is standard for the project's main language, with the command
that installs it, a minimal configuration and the command that runs it.
Where the tool can, that configuration limits the length of a file to the
project's size limit, and the complexity and the length of a function to
the tool's default values, each as an error. Test files have no limit on
the length of a function. The report says that code which already breaks
a limit has to be split, or recorded as an exception, in the work that
adds the linter. When the project has a linter whose configuration lacks
one of these limits or sets one as a warning, the report names what is
missing and shows the lines that set it; a limit the configuration already
has keeps its value, and only its severity changes. `setup` installs no
linter and changes no configuration.
Reason: the test step runs the project's linter when there is one, so a
project without one has no mechanical check of what the skills only ask
for, and a linter that limits file length holds the size limit without a
model. The file limit does not hold a function: a file within it can
carry one function of several hundred lines. A model cannot count the
branches of a function as a linter does, so these two limits go to the
linter and not into the skills. Each limit is an error because the checks
do not fail on a warning, and code grows past a limit that only warns. A
test suite is often one function, so a limit on its length would measure
the suite. Installing a linter adds a dependency and changes source
files, which `setup` never does and which is planned work under
`/banzai:feature`.
Rejected: installing the linter in `setup`; naming tools in the skill's
text, which would go stale and cannot cover every language; rules in the
skills on the complexity or the length of a function; a limit on the
depth of nesting or on the number of functions in a file, which add
little to the other three.
Seen with the eval case `setup-recommends-linter` on Claude Code 2.1.330
with Sonnet, one run each, in a JavaScript project with no linter: without
this text the report said only that it found no lint command; with it, the
report recommended ESLint with the command that installs it, the command
that runs it and a configuration that sets `max-lines` to 500,
`complexity` to 20 and `max-lines-per-function` to 50 as errors and
switches the last one off for test files, said what to do with code
already past a limit, and installed nothing.
Seen with the eval case `setup-linter-only-warns`, one run each, in the
same project with ESLint and `complexity` set as a warning at 15: without
the paragraph on an existing linter the report showed none of the three
limits; with it, the report showed `complexity`, `max-lines` and
`max-lines-per-function` set as errors, and the configuration file stayed
as it was. While the paragraph only said "on the same terms" and "keep a
value the configuration already sets", one run in seven did not show
`complexity` at 15, and the reports weighed 15 against the tool's default
of 20; with the exception spelled out, five runs of five kept 15.
Both cases passed in one run on Haiku and in one on Opus.
Seen once each on Sonnet, in control cases that are not part of the suite:
with a linter that already sets every limit as an error the report proposed
no lines and left the file as it was; in a Python project with no linter it
recommended ruff with limits on complexity, statements and branches as
errors, none of the last two for the tests, and said that ruff has no rule
for the length of a file.
Not checked: whether the values a report calls a tool's defaults are its
defaults; a third language; a project whose code already breaks a limit.

## 2026-11-22: The repository lints itself with the limits `setup` recommends

ESLint is the repository's one development dependency, with `@eslint/js`
for its recommended rules. `npm run lint` fails on a source or test file
past 500 lines, on a function with a complexity over 20 and on a function
longer than 50 lines; a test file has no limit on the length of a function.
CI runs it in a job of its own. The hook and the plugin's directory still
have no dependency, and the tests still run without an install.
Reason: the plugin tells a project that a limit holds only where a check
fails on it, and this repository had no such check.
Measured on the day the linter was added: no file past 500 lines; three
functions of the hook past the limit on complexity, at 29, 23 and 22, and
one of them past the limit on length, at 71 lines; two unused imports in a
test and one unused initial value in the hook, both removed.
The three functions were split in the same work, so the configuration
records no exception. The hook's decisions did not change: the tests' 419
hook events got the same answers, word for word, from the hook before the
split and after it. The split took the hook from 797 to 815 lines.
Rejected: recording the three functions as exceptions, by a comment that
switches a rule off for one function, which lets that function grow
without a word, or by a higher limit for its file, which lets its
neighbours grow to it; the `globals` package, for three names; limits as
warnings.
Breaking the new functions on purpose, one place at a time, the tests
noticed eleven breaks of sixteen; the five they missed were in conditions
the split did not change. Two tests added afterwards notice three of them.
The other two were faults of the hook and left it: a line that no call
reached, and a condition under which the approval command promised a
dialog that never came. That was for a work approved again while a change
still waited; the command now answers that the work is already approved.
Not checked: the lint job on GitHub.
