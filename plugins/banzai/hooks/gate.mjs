#!/usr/bin/env node
// The banzai gate. One process per hook event: it reads the event from stdin,
// answers with at most one JSON object on stdout. Approval records are kept
// under `.banzai/` in the project, session state in the plugin's data directory.
//
// The project is the nearest directory with `documentation/work/` at or above
// the directory the session started in, fixed at the session's first event.
// Rules for a file-tool write, in order:
//   1. there is no such project                    -> no decision
//   2. the target is outside the project           -> no decision
//   3. the target is the gate's own state          -> deny
//   4. the target is documentation or a notes file -> no decision
//   5. the session started with /banzai:auto       -> no decision
//   6. the session is attached to a work           -> pass only with a valid
//      approval record that the developer named or approved in this session
//   7. the session started with /banzai:fix        -> no decision
//   8. the session started with /banzai:feature    -> deny until a plan is
//      written with a file tool
//   9. otherwise                                   -> ask, for this one change
//
// The shell and MCP tools can change files too, and the host does not say
// which. Except in a session whose changes all pass, the hook compares source
// content before and after each such call. A change the rules above would not
// have passed is remembered, the developer is told, and the next shell command
// or MCP call asks to accept it. A call it could not compare counts as one.
//
// An approval record is written only when the developer answers "Yes" to the
// dialog the hook raises for the approval command: the hook asks before the
// command runs and writes the record when the host reports that the same tool
// call ran. The hook never answers `allow`.
import fs from 'node:fs';
import path from 'node:path';
import {
  NOT_COMPARED, WORK_DIR, bundle, changedFile, changedSource, ensureState, findRoot, isDir, isFree,
  isState, isWork, listWorks, planOwner, putPending, readRecord, readSession, relativeTo, sameFiles,
  snapshot, sweepSessions, takePending, updateSession, writeRecord
} from './state.mjs';

const ENTRY_COMMANDS = { 'banzai:fix': 'fix', 'banzai:feature': 'feature', 'banzai:auto': 'auto' };
const FILE_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'NotebookEdit']);
// The dialogs of the shell and of an MCP tool show the hook's text in full.
const showsText = (tool) => tool === 'Bash' || String(tool).startsWith('mcp__');
const APPROVAL_NAME = 'banzai-request-approval';
const APPROVAL_COMMAND = new RegExp(`^(?::[ \\t]*)?${APPROVAL_NAME}[ \\t]+(\\S+)$`);
const APPROVAL_IN_COMPOUND = new RegExp(`(^|[;&|(\\n]\\s*)(:\\s*)?${APPROVAL_NAME}(\\s|$)`);
const MAX_UNAPPROVED = 1000;
const MAX_SHOWN = 30;
const MAX_WORKS = 8;
// A terminal's dialog shows up to twelve rows of the hook's text, its own first
// row included, and folds the rest. In a terminal of 80 columns a row holds 72
// characters, so five such lines leave room for three file names.
const MAX_SUMMARY_LINES = 5;
const MAX_SUMMARY_WIDTH = 72;

const approvalCommand = (work) => `: ${APPROVAL_NAME} ${work}`;
// A bullet marks each item: the host strips leading spaces when it folds a
// long text.
const bulleted = (items) => items.map((item) => `  • ${item}`);
// File names are shown to the developer: no control characters, no flood.
const printable = (name) => name.replace(/[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g, '?');
const listed = (items) => [...bulleted(items.slice(0, MAX_SHOWN)), ...(items.length > MAX_SHOWN ? [`  and ${items.length - MAX_SHOWN} more`] : [])];

function emit(output) {
  if (output) fs.writeSync(1, JSON.stringify(output));
}

const decision = (permissionDecision, permissionDecisionReason) => ({
  hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision, permissionDecisionReason }
});

const context = (hookEventName, additionalContext) => ({
  hookSpecificOutput: { hookEventName, additionalContext }
});

// The absolute path a file tool is about to write, or null.
function targetOf(payload) {
  const input = payload.tool_input || {};
  const target = FILE_TOOLS.has(payload.tool_name) ? input.file_path || input.notebook_path : null;
  if (typeof target !== 'string' || !target) return null;
  return path.resolve(payload.cwd || process.cwd(), target);
}

// The lines of the plan's "For approval" section, which the approval dialog
// shows to the developer, or null when they are missing or would not fit.
function summaryOf(root, work) {
  let lines;
  try {
    lines = fs.readFileSync(path.join(root, WORK_DIR, work, 'plan.md'), 'utf8').split(/\r?\n/);
  } catch {
    return null;
  }
  const isHead = (line) => /^##\s+For approval\s*$/i.test(line);
  const start = lines.findIndex(isHead);
  const rest = lines.slice(start + 1);
  // A second section would leave a stale one in the dialog.
  if (start < 0 || rest.some(isHead)) return null;
  const end = rest.findIndex((line) => /^#{1,6}\s/.test(line));
  const summary = (end < 0 ? rest : rest.slice(0, end)).map((line) => printable(line.trim())).filter(Boolean);
  const fits = summary.length > 0 && summary.length <= MAX_SUMMARY_LINES && summary.every((line) => line.length <= MAX_SUMMARY_WIDTH);
  return fits ? summary : null;
}

// A session whose source changes pass whatever the project holds: after
// /banzai:auto, and after /banzai:fix while no work is attached.
const isOpen = (session) => session.entry === 'auto' || (!session.work && session.entry === 'fix');

// Whether a source change passes now. With `reason`, why it does not.
function standing(root, session) {
  if (isOpen(session)) return { ok: true };
  const work = session.work;
  if (!work) return { ok: false };
  const run = `run exactly this shell command, alone: ${approvalCommand(work)}`;
  const current = isWork(root, work) ? bundle(root, work) : null;
  if (!current) return { ok: false, reason: `Work "${work}" has no plan at documentation/work/${work}/plan.md. Write or restore it, then ${run}` };
  const record = readRecord(root, work);
  const valid = Boolean(record && sameFiles(record.files, current));
  if (valid && session.cleared === work) return { ok: true };
  const why = valid
    ? `Work "${work}" was approved in another session, and the developer has not confirmed it in this one.`
    : record
      ? `The approval of work "${work}" ended because ${changedFile(record.files, current)} changed after the developer approved it.`
      : `Work "${work}" has a plan that the developer has not approved.`;
  return { ok: false, reason: `${why} To show the developer the approval dialog, ${run}` };
}

function onSessionStart(payload, root, session) {
  sweepSessions();
  const works = listWorks(root, MAX_WORKS);
  const here = session.work ? `attached to work "${session.work}"` : session.entry ? `started with /banzai:${session.entry}` : 'no entry command typed yet';
  return context('SessionStart', [
    'This project uses the banzai plugin: source changes need the developer\'s go-ahead.',
    '- The developer starts work by typing /banzai:fix <request> for a small direct change, /banzai:feature <request or work name> for planned work, or /banzai:auto <request or work name> for planned work that runs with no approval dialog. Only a command the developer typed counts; one you start through the Skill tool does not. Without one, each source change asks the developer.',
    `- Planned work has a plan at documentation/work/<work>/plan.md. After writing or changing it, show the developer the approval dialog by running exactly this shell command, alone: ${approvalCommand('<work>')} Work the developer started with /banzai:auto needs no approval: do not run it there.`,
    '- Source changes made through the shell or other tools are compared before and after, and unapproved ones are shown to the developer in the dialog of the next shell command or MCP tool call.',
    '- The developer can also type /banzai:review <work> for an independent review and /banzai:epic for large work split into packages. Always name a command in full; a bare /review is a different command.',
    `Newest work: ${works.length ? works.join('; ') : 'none yet'}.`,
    `This session: ${here}.`
  ].join('\n'));
}

// A typed entry command starts the session's work over. Only `feature` can
// name an existing work, and naming it is the developer's word for it.
function onExpansion(payload, root) {
  const entry = payload.command_source === 'plugin' ? ENTRY_COMMANDS[payload.command_name] : null;
  if (!entry) return null;
  // The developer may type the work as its name or as its path, with quotes or
  // a comma around it. The exact word wins when it names a work itself.
  const first = String(payload.command_args || '').trim().split(/\s+/)[0];
  const plain = first.replace(/^[`'"]+|[`'",.;:]+$/g, '').replace(/^(\.\/)?documentation\/work\//, '').replace(/\/+$/, '');
  const work = (entry === 'feature' && [first, plain].find((name) => isWork(root, name))) || null;
  updateSession(payload.session_id, (session) => Object.assign(session, { entry, work, cleared: work, unapproved: [] }));
  return null;
}

function onFileWrite(payload, root, session) {
  ensureState(root);
  const target = targetOf(payload);
  if (target === null) return null;
  if (isState(root, target)) {
    return decision('deny', 'The files under .banzai/approvals/ and in the plugin\'s data directory are approval state. Only the banzai hook writes them.');
  }
  const rel = relativeTo(root, target);
  if (rel === null || isFree(rel)) return null;
  const { ok, reason } = standing(root, session);
  if (ok) return null;
  if (reason) return decision('deny', reason);
  if (session.entry === 'feature') {
    return decision('deny', `Planned work starts with a plan. Write documentation/work/<work>/plan.md with a file tool first, then run exactly this shell command, alone: ${approvalCommand('<work>')}`);
  }
  return decision('ask', `This session has no typed /banzai:fix, /banzai:feature or /banzai:auto command. Allowing it permits this one change to ${rel}.`);
}

// What the approval command gets: a refusal, or the question and what the
// developer's answer to it will mean.
function approvalStep(root, session, work) {
  const refuse = (text) => ({ refusal: decision('deny', text) });
  if (!isWork(root, work)) return refuse(`"${work}" is not a work directory under documentation/work/. Its name may hold letters, digits, ".", "_" and "-", and it must be a real directory, not a link. Use the directory's name: ${approvalCommand('<work>')}`);
  const files = bundle(root, work);
  if (!files) return refuse(`Work "${work}" has no plan. Write documentation/work/${work}/plan.md first, then run: ${approvalCommand(work)}`);
  if (session.entry !== 'auto' && session.work === work && standing(root, session).ok) {
    return refuse(`Work "${work}" is already approved and its files have not changed. Source writes are allowed; there is no need to run this command.`);
  }
  // Their list would push the plan's lines out of the dialog's visible rows.
  if (session.unapproved.length) return refuse(`Source files were changed before this approval: ${session.unapproved.slice(0, 5).join(', ')}${session.unapproved.length > 5 ? ' and more' : ''}. The developer accepts them first, in the dialog of a shell command. Run one, for example: git status. Then run: ${approvalCommand(work)}`);
  const summary = summaryOf(root, work);
  if (!summary) return refuse(`The plan of work "${work}" needs exactly one "## For approval" section: one to ${MAX_SUMMARY_LINES} lines, each of at most ${MAX_SUMMARY_WIDTH} characters, that say what will be built and name each choice the developer did not make. The approval dialog shows exactly these lines to the developer. Add or shorten the section, then run: ${approvalCommand(work)}`);
  // The plan's lines come first: the desktop app shows about three rows.
  const output = decision('ask', [
    ...summary,
    `Approval requested for work "${work}".`,
    'Allowing this command approves these files until one of them changes:',
    ...bulleted(files.map((file) => file.path)),
    'Not approved until the developer allows it here.'
  ].join('\n'));
  return { request: { approval: { work, files } }, output };
}

// A call while changes wait for the developer: they pass by now, or the
// call asks about them, or it is refused.
function unapprovedStep(payload, root, session) {
  if (standing(root, session).ok) {
    updateSession(payload.session_id, (current) => { current.unapproved = []; });
    return {};
  }
  // Another tool's dialog is not known to show the hook's text.
  if (!showsText(payload.tool_name)) return { refusal: decision('deny', `Tool calls in this session changed source files without the developer's approval: ${session.unapproved.slice(0, 5).join(', ')}${session.unapproved.length > 5 ? ' and more' : ''}. The developer accepts them in the dialog of a shell command. Run one, for example: git status`) };
  const output = decision('ask', [
    'Tool calls in this session changed source files without the developer\'s approval:',
    ...listed(session.unapproved),
    'They are not accepted until the developer allows this tool call. Allowing it accepts them and runs it.'
  ].join('\n'));
  return { request: { accept: session.unapproved }, output };
}

// Remembers the call so that its changes can be compared after it. Returns
// why it could not, or null.
function recordCall(payload, root, request) {
  const id = payload.tool_use_id;
  if (typeof id !== 'string' || !id) return 'the host sent no tool call id';
  try {
    putPending(payload.session_id, id, { ...request, before: snapshot(root), at: Date.now() });
    return null;
  } catch (error) {
    return error.message;
  }
}

// Before a shell or MCP call. A step's `request` is what the developer's
// answer will mean.
function onToolCall(payload, root, session) {
  const isShell = payload.tool_name === 'Bash';
  const command = isShell ? String((payload.tool_input || {}).command || '').trim() : '';
  const match = APPROVAL_COMMAND.exec(command);
  let step = {};
  if (match) step = approvalStep(root, session, match[1]);
  else if (APPROVAL_IN_COMPOUND.test(command)) step = { refusal: decision('deny', `Run the approval command alone, on one line, with nothing before or after it: ${approvalCommand('<work>')}`) };
  else if (session.unapproved.length) step = unapprovedStep(payload, root, session);
  if (step.refusal) return step.refusal;

  // Nothing such a session changes is held back, so the call is not compared.
  // If the session stops being open while the call runs, the call has no
  // entry afterwards and counts as a change.
  if (!match && isOpen(session)) return null;

  const failure = recordCall(payload, root, step.request);
  // A call the gate cannot follow must not run unseen.
  const canAsk = showsText(payload.tool_name) && !match;
  if (failure) return decision(canAsk ? 'ask' : 'deny', `The banzai gate could not record this tool call (${failure}), so its changes would not be compared.${canAsk ? ' Allowing it runs the call anyway.' : ''}`);
  return step.output ?? null;
}

// Writing a plan with a file tool attaches the session to that work.
function attachPlan(payload, root) {
  const target = payload.hook_event_name === 'PostToolUse' ? targetOf(payload) : null;
  const owner = target && planOwner(relativeTo(root, target) || '');
  if (owner && isWork(root, owner)) updateSession(payload.session_id, (session) => { session.work = owner; });
  return null;
}

// What the developer's "Yes" to this call's question did: it approved a
// work or accepted changes. Returns the notes for the model.
function settleAnswer(pending, root, sessionId) {
  const notes = [];
  if (pending.approval) {
    const { work } = pending.approval;
    const files = isWork(root, work) ? bundle(root, work) : null;
    if (files && sameFiles(files, pending.approval.files)) {
      writeRecord(root, work, files, sessionId);
      updateSession(sessionId, (session) => Object.assign(session, { work, cleared: work }));
      notes.push(`The developer answered "Yes". Work "${work}" is approved. Source writes are allowed until one of the approved files changes.`);
    } else {
      notes.push(`Work "${work}" is not approved: its files changed while the dialog was open. Run the command again: ${approvalCommand(work)}`);
    }
  }
  if (Array.isArray(pending.accept) && pending.accept.length) {
    // "Yes" accepts what the dialog showed, not what was added since.
    updateSession(sessionId, (session) => { session.unapproved = session.unapproved.filter((name) => !pending.accept.includes(name)); });
  }
  return notes;
}

// The host reports a tool call here only after it ran, so a question the hook
// asked for the same tool use id was answered "Yes".
function onAfterTool(payload, root) {
  if (FILE_TOOLS.has(payload.tool_name)) return attachPlan(payload, root);
  const event = payload.hook_event_name;
  const sessionId = payload.session_id;
  const id = payload.tool_use_id;
  const pending = typeof id === 'string' && id ? takePending(sessionId, id) : null;
  const notes = pending && payload.is_interrupt !== true ? settleAnswer(pending, root, sessionId) : [];

  // A call with no entry was not compared: the session was open when it
  // started, or its state was lost or removed.
  const changed = pending ? changedSource(root, pending.before).map(printable) : [NOT_COMPARED];
  if (!changed.length || standing(root, readSession(sessionId)).ok) return notes.length ? context(event, notes.join('\n')) : null;
  updateSession(sessionId, (session) => {
    session.unapproved = [...new Set([...session.unapproved, ...changed])].sort().slice(0, MAX_UNAPPROVED);
  });
  const what = `${changed.slice(0, 10).join(', ')}${changed.length > 10 ? ` and ${changed.length - 10} more` : ''}`;
  notes.push(`This tool call changed source files without the developer's approval: ${what}. The next shell command or MCP tool call will ask the developer to accept them.`);
  return { ...context(event, notes.join('\n')), systemMessage: `banzai: source changed without approval (${what}). The next shell command or MCP tool call will ask you to accept it.` };
}

function handle(payload) {
  // The project is fixed at the session's first event. The model can move the
  // working directory and rename directories, so later events do not look
  // again while the remembered project still exists. The host's project
  // directory is preferred; then the working directory; then, for a file
  // write, the directory of the target.
  const sessionId = payload.session_id;
  let session = readSession(sessionId);
  let root = session.root && isDir(session.root) ? session.root : null;
  if (!root) {
    const target = payload.hook_event_name === 'PreToolUse' ? targetOf(payload) : null;
    root = findRoot(process.env.CLAUDE_PROJECT_DIR) || findRoot(payload.cwd) || findRoot(target && path.dirname(target));
    if (!root) return null;
    session = updateSession(sessionId, (current) => { current.root = root; });
  }
  switch (payload.hook_event_name) {
    case 'SessionStart':
      return onSessionStart(payload, root, session);
    case 'UserPromptExpansion':
      return onExpansion(payload, root);
    case 'PreToolUse':
      return FILE_TOOLS.has(payload.tool_name) ? onFileWrite(payload, root, session) : onToolCall(payload, root, session);
    case 'PostToolUse':
    case 'PostToolUseFailure':
      return onAfterTool(payload, root);
    default:
      return null;
  }
}

let payload = null;
try {
  payload = JSON.parse(fs.readFileSync(0, 'utf8'));
} catch {}

if (payload && typeof payload === 'object') {
  try {
    emit(handle(payload));
  } catch (error) {
    // A broken gate must not open silently: before a tool runs, stop or ask.
    if (payload.hook_event_name === 'PreToolUse') {
      const canAsk = showsText(payload.tool_name) || FILE_TOOLS.has(payload.tool_name);
      emit(decision(canAsk ? 'ask' : 'deny', `The banzai gate failed (${error && error.message}).${canAsk ? ' Allowing it permits this one tool call.' : ''}`));
    }
  }
}
