// Helpers for the gate's tests. The tests drive the gate the way the host
// drives it: one process per hook event, the event as JSON on stdin, the
// answer as JSON on stdout.
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const GATE = fileURLToPath(new URL('../plugins/banzai/hooks/gate.mjs', import.meta.url));
export const COMMAND = ': banzai-request-approval';
// What the approval dialog quotes from a plan. A plan without it is refused.
export const SUMMARY = '\n## For approval\n\nBuild the demo.\n';
// Session state and the key that seals state files live in the plugin's data
// directory. Each test project gets its own, next to it.
export const dataOf = (root) => `${root}-data`;
export const envOf = (root, more) => ({ ...process.env, CLAUDE_PROJECT_DIR: '', CLAUDE_PLUGIN_DATA: dataOf(root), ...more });
let counter = 0;

export function repo({ adopted = true } = {}) {
  const root = fs.realpathSync.native(fs.mkdtempSync(path.join(os.tmpdir(), 'banzai-gate-')));
  if (adopted) fs.mkdirSync(path.join(root, 'documentation/work'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'));
  return root;
}

export function put(root, rel, text) {
  fs.mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
  fs.writeFileSync(path.join(root, rel), text);
}

// `extra.env` sets the hook's environment; `extra.raw` replaces stdin.
export function run(root, payload, extra = {}) {
  const result = spawnSync(process.execPath, [GATE], {
    input: extra.raw ?? JSON.stringify({ session_id: 's1', cwd: root, ...payload }),
    encoding: 'utf8',
    env: envOf(root, extra.env)
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout ? JSON.parse(result.stdout) : null;
}

// Every answer names the event it answers.
export function hook(root, payload, extra) {
  const out = (run(root, payload, extra) || {}).hookSpecificOutput || null;
  if (out) assert.equal(out.hookEventName, payload.hook_event_name);
  return out;
}

export const pre = (root, tool_name, tool_input, fields = {}, extra) => {
  const tool_use_id = 'tool_use_id' in fields ? fields.tool_use_id : `t${++counter}`;
  const out = hook(root, { hook_event_name: 'PreToolUse', tool_name, tool_input, ...fields, tool_use_id }, extra);
  return { id: tool_use_id, decision: out ? out.permissionDecision : null, reason: out ? out.permissionDecisionReason : '' };
};
export const write = (root, rel, fields, extra) =>
  pre(root, 'Write', { file_path: path.isAbsolute(rel) ? rel : path.join(root, rel), content: 'x' }, fields, extra);
export const shell = (root, command, fields) => pre(root, 'Bash', { command }, fields);
export const post = (root, tool_name, tool_input, tool_use_id, fields = {}) =>
  hook(root, { hook_event_name: 'PostToolUse', tool_name, tool_input, tool_use_id, ...fields });
export const entry = (root, name = 'banzai:fix', args = '', fields = {}, extra) =>
  hook(root, { hook_event_name: 'UserPromptExpansion', expansion_type: 'slash_command', command_name: name, command_args: args, command_source: 'plugin', ...fields }, extra);
export const recordExists = (root, work = 'demo') => fs.existsSync(path.join(root, `.banzai/approvals/${work}.json`));

// The developer's "Yes": the host runs the tool, then reports it.
export function approve(root, work, fields = {}) {
  const asked = shell(root, `${COMMAND} ${work}`, fields);
  assert.equal(asked.decision, 'ask', asked.reason);
  return post(root, 'Bash', { command: `${COMMAND} ${work}` }, asked.id, fields);
}

export function plannedRepo(work = 'demo') {
  const root = repo();
  put(root, `documentation/work/${work}/plan.md`, '# Plan\n' + SUMMARY);
  return root;
}

// --- Changes made through the shell and other tools ---

export const git = (root, ...args) => {
  const result = spawnSync('git', ['-c', 'user.name=t', '-c', 'user.email=t@example.com', ...args], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
};

export function gitRepo(work) {
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
export function call(root, change, { tool = 'Bash', event = 'PostToolUse', fields = {} } = {}) {
  const before = pre(root, tool, { command: 'something' }, fields);
  if (before.decision === 'deny') return { before, note: '' };
  change();
  const out = hook(root, { hook_event_name: event, tool_name: tool, tool_input: {}, tool_use_id: before.id, ...fields });
  return { before, note: out ? out.additionalContext : '' };
}

export const nothing = () => {};

export const commit = (root, message) => git(root, 'commit', '-q', '-am', message);
export const full = (root, id, fields = {}) => run(root, { hook_event_name: 'PostToolUse', tool_name: 'Bash', tool_input: {}, tool_use_id: id, ...fields });
