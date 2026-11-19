// Every rule of the gate, driven the way the host drives it: one process per
// hook event, the event as JSON on stdin, the answer as JSON on stdout.
import assert from 'node:assert/strict';
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';

const GATE = fileURLToPath(new URL('../plugins/banzai/hooks/gate.mjs', import.meta.url));
const COMMAND = ': banzai-request-approval';
// What the approval dialog quotes from a plan. A plan without it is refused.
const SUMMARY = '\n## For approval\n\nBuild the demo.\n';
// Session state and the key that seals state files live in the plugin's data
// directory. Each test project gets its own, next to it.
const dataOf = (root) => `${root}-data`;
const envOf = (root, more) => ({ ...process.env, CLAUDE_PROJECT_DIR: '', CLAUDE_PLUGIN_DATA: dataOf(root), ...more });
let counter = 0;

function repo({ adopted = true } = {}) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'banzai-gate-')));
  if (adopted) fs.mkdirSync(path.join(root, 'documentation/work'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  return root;
}

function put(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

// `extra.env` sets the hook's environment; `extra.raw` replaces stdin.
function run(root, payload, extra = {}) {
  const result = spawnSync(process.execPath, [GATE], {
    input: extra.raw ?? JSON.stringify({ session_id: 's1', cwd: root, ...payload }),
    encoding: 'utf8',
    env: envOf(root, extra.env)
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

const hook = (root, payload, extra) => (run(root, payload, extra) || {}).hookSpecificOutput || null;

const pre = (root, tool_name, tool_input, fields = {}, extra) => {
  const tool_use_id = 'tool_use_id' in fields ? fields.tool_use_id : `t${++counter}`;
  const out = hook(root, { hook_event_name: 'PreToolUse', tool_name, tool_input, ...fields, tool_use_id }, extra);
  return { id: tool_use_id, decision: out ? out.permissionDecision : null, reason: out ? out.permissionDecisionReason : '' };
};
const write = (root, rel, fields, extra) =>
  pre(root, 'Write', { file_path: path.isAbsolute(rel) ? rel : path.join(root, rel), content: 'x' }, fields, extra);
const shell = (root, command, fields) => pre(root, 'Bash', { command }, fields);
const post = (root, tool_name, tool_input, tool_use_id, fields = {}) =>
  hook(root, { hook_event_name: 'PostToolUse', tool_name, tool_input, tool_use_id, ...fields });
const entry = (root, name = 'banzai:fix', args = '', fields = {}, extra) =>
  hook(root, { hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: name, command_args: args, command_source: 'plugin', ...fields }, extra);
const recordExists = (root, work = 'demo') => fs.existsSync(path.join(root, `.banzai/approvals/${work}.json`));

// The developer's "Yes": the host runs the tool, then reports it.
function approve(root, work, fields = {}) {
  const asked = shell(root, `${COMMAND} ${work}`, fields);
  assert.equal(asked.decision, 'ask', asked.reason);
  return post(root, 'Bash', { command: `${COMMAND} ${work}` }, asked.id, fields);
}

function plannedRepo(work = 'demo') {
  const root = repo();
  put(root, `documentation/work/${work}/plan.md`, '# Plan\n' + SUMMARY);
  return root;
}

test('a project without documentation/work/ gets no decision', () => {
  const root = repo({ adopted: false });
  assert.equal(write(root, 'src/a.js').decision, null);
  assert.equal(shell(root, `${COMMAND} demo`).decision, null);
  assert.equal(fs.existsSync(path.join(root, '.banzai')), false);
});

test('the project is found from a nested working directory', () => {
  const root = repo();
  fs.mkdirSync(path.join(root, 'src/deep'));
  const out = hook(root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_use_id: 'n1', cwd: path.join(root, 'src/deep'), tool_input: { file_path: 'a.js' } });
  assert.equal(out.permissionDecision, 'ask');
});

test('the project the host names wins over the working directory', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  fs.mkdirSync(path.join(root, 'documentation/x/documentation/work'), { recursive: true });
  const moved = { cwd: path.join(root, 'documentation/x') };
  const host = { env: { CLAUDE_PROJECT_DIR: root } };
  assert.equal(write(root, 'src/a.js', moved, host).decision, 'deny');
  assert.equal(write(root, '.banzai/approvals/demo.json', moved, host).decision, 'deny');
});

test('documentation and notes files are free', () => {
  const root = repo();
  for (const rel of ['documentation/guide.md', 'documentation/work/demo/plan.md', 'CLAUDE.md', 'AGENTS.md']) {
    assert.equal(write(root, rel).decision, null, rel);
  }
  for (const rel of ['src/CLAUDE.md', 'NOTES.md', 'README.md']) {
    assert.equal(write(root, rel).decision, 'ask', rel);
  }
});

test('a target outside the project gets no decision', () => {
  const root = repo();
  const outside = repo({ adopted: false });
  assert.equal(write(root, path.join(outside, 'a.js')).decision, null);
});

test('a name that starts with two dots is still inside the project', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  assert.equal(write(root, '..src/a.js').decision, 'deny');
  assert.equal(write(root, '...js').decision, 'deny');
});

test('the gate state cannot be written with a file tool', () => {
  const root = repo();
  entry(root);
  for (const rel of ['.banzai/approvals/demo.json', '.BANZAI/Approvals/demo.json', '.banzai/approval\u017f/demo.json']) {
    assert.equal(write(root, rel).decision, 'deny', rel);
  }
  assert.equal(pre(root, 'Edit', { file_path: path.join(root, '.banzai/approvals/demo.json') }).decision, 'deny');
  // Session state and the key are outside the project, and closed all the same.
  assert.equal(write(root, path.join(dataOf(root), 'sessions/s1.json')).decision, 'deny');
  assert.equal(pre(root, 'MultiEdit', { file_path: path.join(dataOf(root), 'state-key') }).decision, 'deny');
  fs.symlinkSync(dataOf(root), path.join(root, 'documentation/data'));
  assert.equal(write(root, 'documentation/data/sessions/s1.json').decision, 'deny');
});

test('without an entry command every source write asks', () => {
  const root = repo();
  const first = write(root, 'src/a.js');
  assert.equal(first.decision, 'ask');
  assert.match(first.reason, /this one change to src\/a\.js/);
  post(root, 'Write', { file_path: path.join(root, 'src/a.js') }, first.id);
  assert.equal(write(root, 'src/b.js').decision, 'ask', 'a "Yes" covers one change');
});

test('/banzai:fix allows source writes', () => {
  const root = repo();
  entry(root, 'banzai:fix', 'the typo');
  assert.equal(write(root, 'src/a.js').decision, null);
  assert.equal(pre(root, 'NotebookEdit', { notebook_path: path.join(root, 'src/n.ipynb') }).decision, null);
  assert.equal(pre(root, 'MultiEdit', { file_path: path.join(root, 'src/a.js') }).decision, null);
});

test('/banzai:fix never attaches to a work, whatever its first word', () => {
  const root = plannedRepo('api');
  entry(root, 'banzai:fix', 'api returns 500');
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('only the plugin\'s own entry commands count', () => {
  const root = repo();
  entry(root, 'banzai:fix', '', { command_source: 'bundled' });
  entry(root, 'other:fix');
  entry(root, 'banzai:review');
  entry(root, 'fix');
  assert.equal(write(root, 'src/a.js').decision, 'ask');
});

test('/banzai:feature allows no source write before a plan exists', () => {
  const root = repo();
  entry(root, 'banzai:feature', 'add a thing');
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /starts with a plan/);
  assert.equal(write(root, 'documentation/work/demo/plan.md').decision, null);
});

test('writing a plan attaches the session, and source writes are denied until approval', () => {
  const root = repo();
  entry(root, 'banzai:fix', 'small thing');
  put(root, 'documentation/work/demo/plan.md', '# Plan\n' + SUMMARY);
  post(root, 'Edit', { file_path: path.join(root, 'documentation/work/demo/plan.md') }, 'p1');
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /has not approved.*: banzai-request-approval demo$/);
  assert.equal(write(root, 'documentation/work/demo/plan.md').decision, null, 'the plan stays editable');
});

test('the approval command asks and names the files it will hash', () => {
  const root = plannedRepo();
  put(root, 'documentation/work/demo/requirements.md', '# Requirements\n');
  entry(root, 'banzai:feature', 'demo');
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /^Approval requested for work "demo"\. Its plan says:\nBuild the demo\.\n"Yes" approves these files until one of them changes:\n/);
  assert.match(asked.reason, /until one of them changes:\n {2}• documentation\/work\/demo\/requirements\.md\n {2}• documentation\/work\/demo\/plan\.md\nNot approved until the developer answers "Yes" here\.$/);
  assert.equal(recordExists(root), false, 'asking approves nothing');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
});

test('the approval dialog quotes the plan\'s "For approval" section, and a plan without one is refused', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  const plan = (section) => put(root, 'documentation/work/demo/plan.md', `# Plan\n${section}\n## Goal\n\n- R1. Not shown.\n`);
  plan('\n## For approval\n\nAdds a --shout flag.\n- My choice: the flag works before or after the name.\u0007\n');
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /Its plan says:\nAdds a --shout flag\.\n- My choice: the flag works before or after the name\.\?\n"Yes" approves these files/);
  assert.doesNotMatch(asked.reason, /Not shown/);
  post(root, 'Bash', {}, asked.id);
  assert.equal(write(root, 'src/a.js').decision, null, 'the quoted plan is the approved one');
  plan('\n## For approval\n\nAdds a --shout flag and deletes the old one.\n');
  assert.equal(write(root, 'src/a.js').decision, 'deny', 'a changed section ends the approval');
  for (const [name, section] of [
    ['no section', ''],
    ['an empty section', '\n## For approval\n\n'],
    ['two sections', '\n## For approval\n\nThe old summary.\n\n## For approval\n\nThe new summary.\n'],
    ['six lines', `\n## For approval\n${'\n- a choice'.repeat(6)}\n`],
    ['a line of 73 characters', `\n## For approval\n\n${'x'.repeat(73)}\n`]
  ]) {
    plan(section);
    const refused = shell(root, `${COMMAND} demo`);
    assert.equal(refused.decision, 'deny', name);
    assert.match(refused.reason, /needs exactly one "## For approval" section: one to 5 lines, each of at most 72 characters/, name);
  }
  plan(`\n## for approval\n${`\n${'x'.repeat(72)}`.repeat(5)}\n`);
  assert.equal(shell(root, `${COMMAND} demo`).decision, 'ask', 'five lines fit');
});

test('"Yes" creates the record and source writes pass', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'new thing');
  post(root, 'Write', { file_path: path.join(root, 'documentation/work/demo/plan.md') }, 'p1');
  const out = approve(root, 'demo');
  assert.match(out.additionalContext, /The developer answered "Yes"\. Work "demo" is approved/);
  const record = JSON.parse(fs.readFileSync(path.join(root, '.banzai/approvals/demo.json'), 'utf8'));
  assert.deepEqual(record.files.map((file) => file.path), ['documentation/work/demo/plan.md']);
  assert.match(record.files[0].sha256, /^[0-9a-f]{64}$/);
  assert.equal(write(root, 'src/a.js').decision, null);
  const again = shell(root, `${COMMAND} demo`);
  assert.equal(again.decision, 'deny');
  assert.match(again.reason, /already approved/);
});

test('a failed run of the command still records the answer', () => {
  const root = plannedRepo();
  const asked = shell(root, 'banzai-request-approval demo');
  assert.equal(asked.decision, 'ask');
  const out = hook(root, { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_use_id: asked.id, error: 'command not found' });
  assert.match(out.additionalContext, /is approved/);
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('a refused or stopped approval approves and attaches nothing', () => {
  const root = plannedRepo();
  entry(root, 'banzai:fix', 'typo');
  shell(root, `${COMMAND} demo`);
  assert.equal(write(root, 'src/a.js').decision, null, 'a refused request does not attach the session');
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(hook(root, { hook_event_name: 'PostToolUseFailure', tool_name: 'Bash', tool_use_id: asked.id, is_interrupt: true }), null);
  assert.equal(recordExists(root), false);
  assert.equal(post(root, 'Bash', {}, asked.id), null, 'the request is used up');
});

test('a report that matches no request approves nothing', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  shell(root, `${COMMAND} demo`);
  post(root, 'Bash', { command: `${COMMAND} demo` }, 'forged');
  assert.equal(recordExists(root), false);
  assert.equal(write(root, 'src/a.js').decision, 'deny');
});

test('events without a tool call id create nothing', () => {
  const root = plannedRepo();
  assert.equal(shell(root, `${COMMAND} demo`, { tool_use_id: undefined }).decision, 'deny');
  assert.equal(shell(root, `${COMMAND} demo`, { tool_use_id: '' }).decision, 'deny');
  hook(root, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {} });
  assert.equal(recordExists(root), false);
});

test('changing the plan ends the approval, and the reason names the file', () => {
  const root = plannedRepo();
  approve(root, 'demo');
  put(root, 'documentation/work/demo/plan.md', '# Plan\nmore\n' + SUMMARY);
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /ended because documentation\/work\/demo\/plan\.md changed/);
  approve(root, 'demo');
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('adding requirements.md after approval ends it', () => {
  const root = plannedRepo();
  approve(root, 'demo');
  put(root, 'documentation/work/demo/requirements.md', 'new\n');
  assert.match(write(root, 'src/a.js').reason, /requirements\.md changed/);
});

test('a plan that disappears does not open the gate', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  fs.renameSync(path.join(root, 'documentation/work/demo'), path.join(root, 'documentation/work/demo-done'));
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /has no plan/);
});

test('decision records linked from the plan are part of the approval', () => {
  const root = repo();
  put(root, 'documentation/decisions/0001-storage.md', 'v1\n');
  put(root, 'documentation/decisions/0002-other.md', 'v1\n');
  put(root, 'documentation/decisions/security/0007-auth.md', 'v1\n');
  put(root, 'documentation/work/demo/plan.md', 'See [storage](../../decisions/0001-storage.md), ../../decisions/security/0007-auth.md and decisions/../../../src/x.md.\n' + SUMMARY);
  const asked = shell(root, `${COMMAND} demo`);
  assert.match(asked.reason, /documentation\/decisions\/0001-storage\.md/);
  assert.match(asked.reason, /documentation\/decisions\/security\/0007-auth\.md/);
  assert.doesNotMatch(asked.reason, /0002-other|src\/x/);
  post(root, 'Bash', {}, asked.id);
  put(root, 'documentation/decisions/0002-other.md', 'v2\n');
  assert.equal(write(root, 'src/a.js').decision, null);
  put(root, 'documentation/decisions/security/0007-auth.md', 'v2\n');
  assert.match(write(root, 'src/a.js').reason, /0007-auth\.md changed/);
});

test('the approval command must be the whole command, on one line', () => {
  const root = plannedRepo();
  for (const command of [
    `${COMMAND} demo && echo x > src/a.js`,
    `echo ok; ${COMMAND} demo`,
    `${COMMAND} demo extra`,
    COMMAND,
    ':\nbanzai-request-approval\ndemo',
    `${COMMAND} demo\necho x > src/a.js`,
    `echo ok\n${COMMAND} demo`
  ]) {
    const out = shell(root, command);
    assert.equal(out.decision, 'deny', command);
    assert.match(out.reason, /alone/);
  }
  assert.equal(shell(root, 'grep -r banzai-request-approval .').decision, null);
  assert.equal(shell(root, 'ls').decision, null);
  assert.equal(fs.existsSync(path.join(root, '.banzai/approvals')), false, 'nothing was approved');
});

test('the approval command needs a real work directory with a plan', () => {
  const root = plannedRepo();
  fs.mkdirSync(path.join(root, 'documentation/work/empty'));
  fs.symlinkSync(path.join(root, 'src'), path.join(root, 'documentation/work/link'));
  put(root, 'src/plan.md', '# Not a plan\n');
  assert.match(shell(root, `${COMMAND} missing`).reason, /not a work directory/);
  assert.match(shell(root, `${COMMAND} ../../src`).reason, /not a work directory/);
  assert.match(shell(root, `${COMMAND} link`).reason, /not a work directory/);
  assert.match(shell(root, `${COMMAND} empty`).reason, /has no plan/);
});

test('work approved in another session needs the developer\'s word in this one', () => {
  const root = plannedRepo('old');
  put(root, 'documentation/work/demo/plan.md', '# Demo\n' + SUMMARY);
  approve(root, 'old', { session_id: 's0' });

  // A feature session on unapproved work cannot move itself onto the old work.
  entry(root, 'banzai:feature', 'demo');
  assert.equal(shell(root, `${COMMAND} old`).decision, 'ask');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  post(root, 'Write', { file_path: path.join(root, 'documentation/work/old/plan.md') }, 'p1');
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /approved in another session/);

  // Nor can a session with no entry command.
  shell(root, `${COMMAND} old`, { session_id: 's2' });
  assert.equal(write(root, 'src/a.js', { session_id: 's2' }).decision, 'ask');

  // The developer's "Yes" in this session is enough.
  approve(root, 'old');
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('a new session that names approved work in /banzai:feature passes', () => {
  const root = plannedRepo();
  approve(root, 'demo');
  entry(root, 'banzai:feature', 'demo continue', { session_id: 's2' });
  assert.equal(write(root, 'src/a.js', { session_id: 's2' }).decision, null);
  put(root, 'documentation/work/demo/plan.md', 'changed\n' + SUMMARY);
  assert.equal(write(root, 'src/a.js', { session_id: 's2' }).decision, 'deny');
});

test('the session approval does not outrank planned work', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  entry(root, 'banzai:fix', 'something else');
  assert.equal(write(root, 'src/a.js').decision, null, 'a new entry command starts new work');
});

test('symlinks do not move a target out of its rule', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  fs.symlinkSync(path.join(root, 'src'), path.join(root, 'documentation/link'));
  assert.equal(write(root, 'documentation/link/a.js').decision, 'deny');
  assert.equal(write(root, `documentation/link/${Array(70).fill('d').join('/')}/a.js`).decision, 'deny');
  fs.symlinkSync(path.join(root, '.banzai/approvals'), path.join(root, 'documentation/state'));
  assert.equal(write(root, 'documentation/state/demo.json').decision, 'deny');
  fs.symlinkSync('loop-b', path.join(root, 'documentation/loop-a'));
  fs.symlinkSync('loop-a', path.join(root, 'documentation/loop-b'));
  assert.equal(write(root, 'documentation/loop-a/a.js').decision, 'ask', 'an unresolvable path fails closed');
});

test('files changed while the dialog was open are not approved', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  const asked = shell(root, `${COMMAND} demo`);
  put(root, 'documentation/work/demo/plan.md', 'swapped\n' + SUMMARY);
  const out = post(root, 'Bash', {}, asked.id);
  assert.match(out.additionalContext, /is not approved/);
  assert.equal(recordExists(root), false);
  assert.equal(write(root, 'src/a.js').decision, 'deny');
});

test('state files not written by the hook are ignored', () => {
  const root = plannedRepo();
  approve(root, 'demo', { session_id: 's0' });
  const sessions = path.join(dataOf(root), 'sessions');
  const record = fs.readFileSync(path.join(root, '.banzai/approvals/demo.json'), 'utf8');
  const session = fs.readFileSync(path.join(sessions, 's0.json'), 'utf8');

  // A session file copied under another session's name, then a hand-made one.
  fs.writeFileSync(path.join(sessions, 's1.json'), session);
  assert.equal(write(root, 'src/a.js').decision, 'ask');
  fs.writeFileSync(path.join(sessions, 's1.json'), JSON.stringify({ root, entry: 'fix', work: null, cleared: null, unapproved: [] }));
  assert.equal(write(root, 'src/a.js').decision, 'ask');
  // A hand-made record with the right hashes, and an edited one that keeps the old seal.
  entry(root, 'banzai:feature', 'demo');
  const { seal, ...unsealed } = JSON.parse(record);
  put(root, '.banzai/approvals/demo.json', JSON.stringify(unsealed));
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  put(root, '.banzai/approvals/demo.json', record.replace(/"approvedAt": "[^"]+"/, '"approvedAt": "2020-01-01T00:00:00.000Z"'));
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  // A record copied to another work.
  put(root, 'documentation/work/other/plan.md', '# Plan\n' + SUMMARY);
  put(root, '.banzai/approvals/other.json', record);
  entry(root, 'banzai:feature', 'other');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  // The hook's own record still works.
  put(root, '.banzai/approvals/demo.json', record);
  entry(root, 'banzai:feature', 'demo');
  assert.equal(write(root, 'src/a.js').decision, null);
  // The same record in another checkout, under the same key, does not.
  const copy = `${root}-copy`;
  fs.cpSync(root, copy, { recursive: true });
  const same = { env: { CLAUDE_PLUGIN_DATA: dataOf(root) } };
  entry(copy, 'banzai:feature', 'demo', { session_id: 's9' }, same);
  assert.equal(write(copy, 'src/a.js', { session_id: 's9' }, same).decision, 'deny');
});

test('a hand-made request for a tool call approves nothing', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  const forged = path.join(dataOf(root), 'sessions/s1/forged.json');
  fs.mkdirSync(path.dirname(forged), { recursive: true });
  fs.writeFileSync(forged, JSON.stringify({ approval: { work: 'demo', files: [] }, at: Date.now() }));
  post(root, 'Bash', {}, 'forged');
  assert.equal(recordExists(root), false);
  assert.equal(write(root, 'src/a.js').decision, 'deny');
});

test('requests asked at the same time are all kept', async () => {
  const root = plannedRepo();
  const run = (payload) => new Promise((resolve) => {
    const child = spawn(process.execPath, [GATE], { env: envOf(root) });
    let out = '';
    child.stdout.on('data', (chunk) => { out += chunk; });
    child.on('close', () => resolve(out ? JSON.parse(out).hookSpecificOutput : null));
    child.stdin.end(JSON.stringify({ session_id: 's1', cwd: root, tool_name: 'Bash', ...payload }));
  });
  const ids = Array.from({ length: 12 }, (_, index) => `c${index}`);
  const asked = await Promise.all(ids.map((id) => run({ hook_event_name: 'PreToolUse', tool_use_id: id, tool_input: { command: `${COMMAND} demo` } })));
  assert.deepEqual(asked.map((out) => out.permissionDecision), ids.map(() => 'ask'));
  const answered = await Promise.all(ids.map((id) => run({ hook_event_name: 'PostToolUse', tool_use_id: id, tool_input: {} })));
  for (const out of answered) assert.match(out.additionalContext, /is approved/);
});

test('a gate that cannot keep its state does not pass silently', () => {
  const root = repo();
  entry(root, 'banzai:fix');
  fs.rmSync(path.join(root, '.banzai'), { recursive: true, force: true });
  fs.writeFileSync(path.join(root, '.banzai'), 'not a directory');
  const out = write(root, 'src/a.js');
  assert.equal(out.decision, 'ask');
  assert.match(out.reason, /gate failed/);

  // A shell call whose snapshot cannot be stored asks; an MCP call is denied.
  fs.writeFileSync(path.join(dataOf(root), 'sessions/s1'), 'not a directory');
  const asked = shell(root, 'ls');
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /could not record this tool call/);
  assert.equal(pre(root, 'mcp__docs__search', {}).decision, 'deny');
  assert.equal(shell(root, 'ls', { tool_use_id: '' }).decision, 'ask');

  // A broken key stops everything that would run.
  fs.writeFileSync(path.join(dataOf(root), 'state-key'), '');
  assert.equal(shell(root, 'ls').decision, 'ask');
  assert.equal(pre(root, 'mcp__docs__search', {}).decision, 'deny');
});

test('malformed or empty input is ignored', () => {
  const root = repo();
  assert.equal(hook(root, null, { raw: '{not json' }), null);
  assert.equal(hook(root, null, { raw: '' }), null);
  assert.equal(hook(root, null, { raw: 'null' }), null);
  assert.equal(hook(root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: {} }), null);
});

// --- Changes made through the shell and other tools ---

const git = (root, ...args) => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};

function gitRepo(work) {
  const root = repo();
  put(root, 'src/base.js', 'base\n');
  put(root, '.gitignore', '.banzai/\nbuild/\n');
  if (work) put(root, `documentation/work/${work}/plan.md`, '# Plan\n' + SUMMARY);
  git(root, 'init', '-q');
  git(root, 'add', '-A');
  git(root, 'commit', '-q', '-m', 'base');
  return root;
}

// One tool call as the host reports it: before, the change it makes, after.
function call(root, change, { tool = 'Bash', event = 'PostToolUse', fields = {} } = {}) {
  const before = pre(root, tool, { command: 'something' }, fields);
  if (before.decision === 'deny') return { before, note: '' };
  change();
  const out = hook(root, { hook_event_name: event, tool_name: tool, tool_input: {}, tool_use_id: before.id, ...fields });
  return { before, note: out ? out.additionalContext : '' };
}

const nothing = () => {};

test('a shell change to source without approval is remembered, and the next call asks', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const first = call(root, () => { put(root, 'src/new.js', 'x\n'); put(root, 'src/base.js', 'changed\n'); });
  assert.equal(first.before.decision, null);
  assert.match(first.note, /changed source files without the developer's approval: src\/base\.js, src\/new\.js/);

  const asked = shell(root, 'ls');
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /\n {2}• src\/base\.js\n {2}• src\/new\.js\n/);
  assert.equal(shell(root, 'ls').decision, 'ask', 'no answer yet');

  const accepted = call(root, nothing);
  assert.equal(accepted.before.decision, 'ask');
  assert.equal(accepted.note, '');
  assert.equal(shell(root, 'ls').decision, null, '"Yes" accepted the changes');
});

test('changes to documentation, ignored files and the gate state are not source changes', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => {
    put(root, 'documentation/notes.md', 'x\n');
    put(root, 'CLAUDE.md', 'x\n');
    put(root, 'build/out.js', 'x\n');
    put(root, '.banzai/other.txt', 'x\n');
  });
  assert.equal(out.note, '');
  assert.equal(shell(root, 'ls').decision, null);
});

test('a session that may change source is not asked about shell changes', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  assert.equal(call(root, () => put(root, 'src/base.js', 'fixed\n')).note, '');

  entry(root, 'banzai:feature', 'demo');
  approve(root, 'demo');
  assert.equal(call(root, () => put(root, 'src/base.js', 'planned\n')).note, '');
  assert.equal(shell(root, 'ls').decision, null);
});

test('without an entry command a shell change is asked about', () => {
  const root = gitRepo();
  assert.match(call(root, () => put(root, 'src/base.js', 'x\n')).note, /src\/base\.js/);
  assert.equal(shell(root, 'ls').decision, 'ask');
});

test('a failed or stopped command is compared too', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  assert.match(call(root, () => put(root, 'src/a.js', 'x\n'), { event: 'PostToolUseFailure' }).note, /src\/a\.js/);
  const stopped = call(root, () => put(root, 'src/b.js', 'x\n'), { event: 'PostToolUseFailure', fields: { is_interrupt: true } });
  assert.equal(stopped.before.decision, 'ask');
  assert.match(stopped.note, /src\/b\.js/);
  assert.match(shell(root, 'ls').reason, /src\/a\.js\n {2}• src\/b\.js/, 'a stopped call accepted nothing');
});

test('a change committed by the same command is still seen', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => {
    put(root, 'src/base.js', 'committed\n');
    git(root, 'commit', '-q', '-am', 'sneak');
  });
  assert.match(out.note, /src\/base\.js/);
});

test('committing or reverting files changes nothing by itself', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  put(root, 'src/base.js', 'edited with approval\n');
  put(root, 'src/new.js', 'new\n');
  entry(root, 'banzai:feature', 'demo');
  const committed = call(root, () => { git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'work'); });
  assert.equal(committed.note, '');
  put(root, 'src/base.js', 'dirty\n');
  const reverted = call(root, () => git(root, 'checkout', '--', 'src/base.js'));
  assert.match(reverted.note, /src\/base\.js/, 'a revert is a change to source');
});

test('earlier unapproved changes are accepted in their own dialog, before the approval dialog', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  call(root, () => { for (let i = 1; i <= 9; i += 1) put(root, `src/early-${i}.js`, 'x\n'); });
  const refused = shell(root, `${COMMAND} demo`);
  assert.equal(refused.decision, 'deny', 'their list would fold the plan out of the dialog');
  assert.match(refused.reason, /changed before this approval: src\/early-1\.js, .* and more\. The developer accepts them first/);
  assert.equal(recordExists(root), false);
  const accept = shell(root, 'git status');
  assert.equal(accept.decision, 'ask');
  assert.match(accept.reason, /src\/early-9\.js/);
  post(root, 'Bash', {}, accept.id);
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /^Approval requested for work "demo"\. Its plan says:\nBuild the demo\.\n/);
  assert.doesNotMatch(asked.reason, /early/);
  post(root, 'Bash', {}, asked.id);
  assert.equal(shell(root, 'ls').decision, null);
  assert.equal(write(root, 'src/a.js').decision, null);
});

test('a typed entry command starts over', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  call(root, () => put(root, 'src/early.js', 'x\n'));
  entry(root, 'banzai:fix', 'keep going');
  assert.equal(shell(root, 'ls').decision, null);
});

test('MCP tools are compared, and the shell takes the question', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const tool = 'mcp__editor__replace_content';
  assert.match(call(root, () => put(root, 'src/base.js', 'via mcp\n'), { tool }).note, /src\/base\.js/);
  const denied = pre(root, 'mcp__docs__search', { query: 'x' });
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /src\/base\.js.*Run one, for example: git status$/);
  assert.equal(shell(root, 'git status').decision, 'ask');
});

test('the hook is registered for the tools that can change files, and no others', () => {
  const config = JSON.parse(fs.readFileSync(new URL('../plugins/banzai/hooks/hooks.json', import.meta.url), 'utf8')).hooks;
  for (const event of ['PreToolUse', 'PostToolUse', 'PostToolUseFailure']) {
    const matcher = new RegExp(config[event][0].matcher);
    for (const tool of ['Write', 'Edit', 'MultiEdit', 'NotebookEdit', 'Bash', 'Monitor', 'PowerShell', 'mcp__a__b']) assert.equal(matcher.test(tool), true, tool);
    for (const tool of ['TodoWrite', 'Read', 'BashOutput', 'Agent']) assert.equal(matcher.test(tool), false, tool);
  }
  assert.ok(config.SessionStart && config.UserPromptExpansion);
});

test('a work typed as a path or with punctuation is the same work', () => {
  for (const typed of ['documentation/work/alpha continue', './documentation/work/alpha/ continue', 'alpha, then add JSON', '`alpha` continue']) {
    const root = plannedRepo('alpha');
    approve(root, 'alpha', { session_id: 's0' });
    entry(root, 'banzai:feature', typed);
    assert.equal(write(root, 'src/a.js').decision, null, typed);
  }
  // Another path that only ends in the name is not the work.
  const root = plannedRepo('alpha');
  approve(root, 'alpha', { session_id: 's0' });
  entry(root, 'banzai:feature', 'src/alpha continue');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  // The exact word wins over its trimmed form.
  const both = plannedRepo('alpha');
  put(both, 'documentation/work/alpha./plan.md', '# Other\n' + SUMMARY);
  approve(both, 'alpha', { session_id: 's0' });
  entry(both, 'banzai:feature', 'alpha. continue');
  assert.match(write(both, 'src/a.js').reason, /alpha\./);
});

test('every skill is typed by the developer only, and the skill text stays within its budget', () => {
  const skills = fileURLToPath(new URL('../plugins/banzai/skills/', import.meta.url));
  const files = fs.readdirSync(skills, { recursive: true }).filter((name) => name.endsWith('.md'));
  const read = (name) => fs.readFileSync(path.join(skills, name), 'utf8');
  for (const name of ['setup', 'fix', 'feature', 'review', 'epic']) {
    assert.match(read(`${name}/SKILL.md`), /^---\n[\s\S]*?\ndisable-model-invocation: true\n[\s\S]*?---\n/, name);
  }
  // The hook answers this exact command with the approval dialog.
  assert.match(read('feature/SKILL.md'), /```bash\n: banzai-request-approval <work>\n```/);
  const lines = files.reduce((sum, name) => sum + read(name).split('\n').length - 1, 0);
  assert.ok(lines <= 1500, `${lines} lines of skill text`);
  // `setup` writes the install id into a project, so it must match the manifests.
  const manifest = (rel) => JSON.parse(fs.readFileSync(fileURLToPath(new URL(rel, import.meta.url)), 'utf8'));
  const id = `${manifest('../plugins/banzai/.claude-plugin/plugin.json').name}@${manifest('../.claude-plugin/marketplace.json').name}`;
  assert.equal(id, 'banzai@parabolic-plugins');
  assert.ok(read('setup/SKILL.md').includes(`enabledPlugins["${id}"]`) && read('setup/SKILL.md').includes(`claude plugin install ${id}`));
  // An installed plugin is a copy of its own directory alone, so the licence travels in it.
  const top = (rel) => fs.readFileSync(fileURLToPath(new URL(`../${rel}`, import.meta.url)), 'utf8');
  for (const name of ['LICENSE', 'NOTICE']) assert.equal(top(`plugins/banzai/${name}`), top(name), name);
  assert.ok(top('README.md').includes(`claude plugin install ${id}`));
});

test('outside a Git repository shell changes are not seen', () => {
  const root = plannedRepo();
  entry(root, 'banzai:feature', 'demo');
  assert.equal(call(root, () => put(root, 'src/a.js', 'x\n')).note, '');
});

test('a lock left by a dead hook process is broken', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:fix', 'typo');
  const lock = path.join(dataOf(root), 'sessions/s1.lock');
  fs.mkdirSync(lock);
  const old = new Date(Date.now() - 60000);
  fs.utimesSync(lock, old, old);
  entry(root, 'banzai:feature', 'demo');
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  assert.equal(fs.existsSync(lock), false);
});

test('session start tells the model where the session stands', () => {
  const root = plannedRepo('alpha');
  put(root, 'documentation/work/beta/plan.md', '# Beta\n' + SUMMARY);
  fs.mkdirSync(path.join(root, 'documentation/work/no-plan'));
  approve(root, 'alpha', { session_id: 's0' });
  approve(root, 'beta', { session_id: 's0' });
  put(root, 'documentation/work/beta/plan.md', '# Beta, changed\n' + SUMMARY);
  const start = (fields = {}) => hook(root, { hook_event_name: 'SessionStart', source: 'startup', ...fields }).additionalContext;

  const fresh = start();
  assert.match(fresh, /\/banzai:fix/);
  assert.match(fresh, /\/banzai:review <work>/);
  assert.match(fresh, /: banzai-request-approval <work>/);
  assert.match(fresh, /alpha \(approved\)/);
  assert.match(fresh, /beta \(approval ended, documentation\/work\/beta\/plan\.md changed\)/);
  assert.doesNotMatch(fresh, /no-plan/);
  assert.match(fresh, /This session: no entry command typed yet\./);

  entry(root, 'banzai:feature', 'alpha');
  assert.match(start({ source: 'resume' }), /This session: attached to work "alpha"\./);
  entry(root, 'banzai:fix', 'typo');
  assert.match(start({ source: 'compact' }), /This session: started with \/banzai:fix\./);

  const elsewhere = repo({ adopted: false });
  assert.equal(hook(elsewhere, { hook_event_name: 'SessionStart', source: 'startup' }), null);
});

// --- What the second review found ---

const commit = (root, message) => git(root, 'commit', '-q', '-am', message);
const full = (root, id, fields = {}) => run(root, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {}, tool_use_id: id, ...fields });

test('a command that removes the project\'s state is still compared', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => { put(root, 'src/base.js', 'evil\n'); fs.rmSync(path.join(root, '.banzai'), { recursive: true, force: true }); });
  assert.match(out.note, /src\/base\.js/);
  assert.equal(shell(root, 'ls').decision, 'ask');
});

test('a tool call the gate did not follow counts as a change', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const before = shell(root, 'ls');
  fs.rmSync(path.join(dataOf(root), 'sessions/s1'), { recursive: true });
  assert.match(post(root, 'Bash', {}, before.id).additionalContext, /could not be compared/);
  assert.match(shell(root, 'ls').reason, /\(a tool call could not be compared\)/);
});

test('the project stays fixed when the model renames or adds directories', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  fs.renameSync(path.join(root, 'documentation/work'), path.join(root, 'documentation/work.off'));
  assert.equal(write(root, 'src/a.js').decision, 'deny');
  assert.match(call(root, () => put(root, 'src/base.js', 'evil\n')).note, /src\/base\.js/);

  const mono = gitRepo('demo');
  fs.mkdirSync(path.join(mono, 'packages/api'), { recursive: true });
  const host = { env: { CLAUDE_PROJECT_DIR: path.join(mono, 'packages/api') } };
  entry(mono, 'banzai:feature', 'demo', {}, host);
  fs.mkdirSync(path.join(mono, 'packages/api/documentation/work'), { recursive: true });
  assert.equal(write(mono, 'src/a.js', {}, host).decision, 'deny');
});

test('a file write finds its project when the session started above it', () => {
  const top = repo({ adopted: false });
  fs.mkdirSync(path.join(top, 'packages/x/documentation/work'), { recursive: true });
  assert.equal(write(top, 'packages/x/src/a.js').decision, 'ask');
  assert.equal(write(top, 'other/a.js').decision, null);
});

test('files Git was told not to look at are compared', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const hidden = call(root, () => { git(root, 'update-index', '--skip-worktree', 'src/base.js'); put(root, 'src/base.js', 'evil\n'); });
  assert.match(hidden.note, /src\/base\.js/);
  const later = gitRepo('demo');
  entry(later, 'banzai:feature', 'demo');
  git(later, 'update-index', '--assume-unchanged', 'src/base.js');
  assert.match(call(later, () => put(later, 'src/base.js', 'evil\n')).note, /src\/base\.js/);
});

test('content put into the index or a commit behind an unchanged file is seen', () => {
  const dirty = () => {
    const root = gitRepo('demo');
    entry(root, 'banzai:fix', 'typo');
    put(root, 'src/base.js', 'edited with approval\n');
    entry(root, 'banzai:feature', 'demo');
    return root;
  };
  const swap = (root, between) => { put(root, 'src/base.js', 'evil\n'); between(); put(root, 'src/base.js', 'edited with approval\n'); };

  const committed = dirty();
  assert.match(call(committed, () => swap(committed, () => commit(committed, 'sneak'))).note, /src\/base\.js/);
  const staged = dirty();
  assert.match(call(staged, () => swap(staged, () => git(staged, 'add', 'src/base.js'))).note, /src\/base\.js/);
  const mode = dirty();
  assert.match(call(mode, () => fs.chmodSync(path.join(mode, 'src/base.js'), 0o755)).note, /src\/base\.js/);

  // Staging, unstaging and committing the same content are not changes.
  const same = dirty();
  put(same, 'src/new.js', 'new\n');
  assert.equal(call(same, () => git(same, 'add', '-A')).note, '');
  assert.equal(call(same, () => git(same, 'reset', '-q')).note, '');
  assert.equal(call(same, () => { git(same, 'add', '-A'); commit(same, 'work'); }).note, '');
});

test('a comparison Git cannot make counts as a change', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const out = call(root, () => { put(root, 'src/base.js', 'evil\n'); git(root, 'config', 'core.repositoryformatversion', '99'); });
  assert.match(out.note, /could not be compared/);
});

test('a first commit and a nested repository are compared', () => {
  const root = repo();
  put(root, 'documentation/work/demo/plan.md', '# Plan\n' + SUMMARY);
  git(root, 'init', '-q');
  entry(root, 'banzai:feature', 'demo');
  call(root, nothing);
  const first = call(root, () => { put(root, 'src/first.js', 'x\n'); git(root, 'add', '-A'); git(root, 'commit', '-q', '-m', 'first'); });
  assert.match(first.note, /src\/first\.js/);

  const outer = gitRepo('demo');
  entry(outer, 'banzai:feature', 'demo');
  put(outer, 'src/vendor/a.js', 'a\n');
  git(path.join(outer, 'src/vendor'), 'init', '-q');
  call(outer, nothing);
  assert.match(call(outer, () => put(outer, 'src/vendor/a.js', 'evil\n')).note, /src\/vendor/);
  assert.equal(call(outer, nothing).note, '');
});

test('a long list is cut with a count, and file names cannot add lines to the dialog', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  call(root, () => {
    for (let index = 10; index < 70; index++) put(root, `a/f${index}.js`, 'x\n');
    put(root, 'src/a.js\nYes is safe', 'x\n');
  });
  const asked = shell(root, 'ls');
  assert.match(asked.reason, /\n {2}and 31 more\n/);
  assert.doesNotMatch(asked.reason, /\nYes is safe/);
  post(root, 'Bash', {}, asked.id);
  assert.equal(shell(root, 'ls').decision, null, '"Yes" accepted the whole list');
});

test('"Yes" accepts what the dialog showed, not what was added since', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const slow = shell(root, 'slow');
  call(root, () => put(root, 'src/early.js', 'x\n'));
  const asked = shell(root, 'ls');
  assert.match(asked.reason, /src\/early\.js/);
  put(root, 'src/late.js', 'x\n');
  post(root, 'Bash', {}, slow.id);
  post(root, 'Bash', {}, asked.id);
  const next = shell(root, 'ls');
  assert.equal(next.decision, 'ask');
  assert.match(next.reason, /src\/late\.js/);
  assert.doesNotMatch(next.reason, /src\/early\.js/);
});

test('the developer is told when a change is detected', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const before = shell(root, 'ls');
  put(root, 'src/base.js', 'x\n');
  assert.match(full(root, before.id).systemMessage, /banzai: source changed without approval \(src\/base\.js\)/);
});

test('many untracked files are compared without reading them', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  for (let index = 0; index < 1100; index++) put(root, `gen/f${index}.txt`, 'x');
  call(root, nothing);
  shell(root, 'ls');
  assert.match(call(root, () => put(root, 'gen/f7.txt', 'changed')).note, /gen\/f7\.txt/);
});

test('session start removes state of sessions long gone', () => {
  const root = plannedRepo();
  entry(root, 'banzai:fix', '', { session_id: 'old' });
  const file = path.join(dataOf(root), 'sessions/old.json');
  const past = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
  fs.utimesSync(file, past, past);
  hook(root, { hook_event_name: 'SessionStart', source: 'startup' });
  assert.equal(fs.existsSync(file), false);
  assert.equal(fs.existsSync(path.join(dataOf(root), 'state-key')), true);
});
