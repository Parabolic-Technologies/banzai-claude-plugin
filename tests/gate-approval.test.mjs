// The approval dialog, the approval record and the gate's own state.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  GATE, COMMAND, SUMMARY, dataOf, envOf, repo, put, hook, pre, write, shell, post, entry,
  recordExists, approve, plannedRepo
} from './helpers.mjs';

test('the approval command asks and names the files it will hash', () => {
  const root = plannedRepo();
  put(root, 'documentation/work/demo/requirements.md', '# Requirements\n');
  entry(root, 'banzai:feature', 'demo');
  const asked = shell(root, `${COMMAND} demo`);
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /^Build the demo\.\nApproval requested for work "demo"\.\nAllowing this command approves these files until one of them changes:\n/);
  assert.match(asked.reason, /until one of them changes:\n {2}• documentation\/work\/demo\/requirements\.md\n {2}• documentation\/work\/demo\/plan\.md\nNot approved until the developer allows it here\.$/);
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
  assert.match(asked.reason, /^Adds a --shout flag\.\n- My choice: the flag works before or after the name\.\?\nApproval requested for work "demo"\.\n/);
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

  // After /banzai:fix or /banzai:auto a call is not compared, so there is
  // nothing to store.
  fs.writeFileSync(path.join(dataOf(root), 'sessions/s1'), 'not a directory');
  assert.equal(shell(root, 'ls').decision, null);
  entry(root, 'banzai:auto');
  assert.equal(shell(root, 'ls').decision, null);
  // A shell or MCP call whose snapshot cannot be stored asks; another tool is denied.
  entry(root, 'banzai:feature');
  const asked = shell(root, 'ls');
  assert.equal(asked.decision, 'ask');
  assert.match(asked.reason, /could not record this tool call/);
  assert.equal(pre(root, 'mcp__docs__search', {}).decision, 'ask');
  assert.equal(pre(root, 'Monitor', {}).decision, 'deny');
  assert.equal(shell(root, 'ls', { tool_use_id: '' }).decision, 'ask');

  // A broken key stops everything that would run.
  fs.writeFileSync(path.join(dataOf(root), 'state-key'), '');
  assert.equal(shell(root, 'ls').decision, 'ask');
  assert.equal(pre(root, 'mcp__docs__search', {}).decision, 'ask');
  assert.equal(pre(root, 'Monitor', {}).decision, 'deny');
});

test('malformed or empty input is ignored', () => {
  const root = repo();
  assert.equal(hook(root, null, { raw: '{not json' }), null);
  assert.equal(hook(root, null, { raw: '' }), null);
  assert.equal(hook(root, null, { raw: 'null' }), null);
  assert.equal(hook(root, { hook_event_name: 'PreToolUse', tool_name: 'Write', tool_input: {} }), null);
});
