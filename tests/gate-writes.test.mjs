// The gate's rules for a file-tool write and for the entry commands.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  COMMAND, SUMMARY, dataOf, repo, put, hook, pre, write, shell, post, entry, plannedRepo, gitRepo, call,
  approve, recordExists
} from './helpers.mjs';

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
  entry(root, 'banzai:auto', '', { command_source: 'bundled' });
  entry(root, 'other:auto');
  assert.equal(write(root, 'src/a.js').decision, 'ask');
});

test('/banzai:auto allows source writes, before a plan and after one is written', () => {
  const root = repo();
  entry(root, 'banzai:auto', 'add a thing');
  assert.equal(write(root, 'src/a.js').decision, null);
  put(root, 'documentation/work/demo/plan.md', '# Plan\n' + SUMMARY);
  post(root, 'Write', { file_path: path.join(root, 'documentation/work/demo/plan.md') }, 'p1');
  assert.equal(write(root, 'src/a.js').decision, null, 'the plan needs no approval here');
  assert.equal(recordExists(root), false);
});

test('/banzai:auto accepts a change made through the shell', () => {
  const root = gitRepo();
  entry(root, 'banzai:auto', 'add a thing');
  assert.equal(call(root, () => put(root, 'src/base.js', 'changed\n')).note, '');
  assert.equal(shell(root, 'git status').decision, null);
});

test('/banzai:feature typed after /banzai:auto closes the source again', () => {
  const root = plannedRepo();
  entry(root, 'banzai:auto', 'demo go on');
  assert.equal(write(root, 'src/a.js').decision, null);
  entry(root, 'banzai:feature', 'demo go on');
  assert.match(write(root, 'src/a.js').reason, /has not approved/);
});

test('in a /banzai:auto session the approval command still asks the developer', () => {
  const root = plannedRepo();
  entry(root, 'banzai:auto', 'demo go on');
  post(root, 'Write', { file_path: path.join(root, 'documentation/work/demo/plan.md') }, 'p1');
  approve(root, 'demo');
  assert.equal(recordExists(root), true);
});

test('/banzai:feature allows no source write before a plan exists', () => {
  const root = repo();
  entry(root, 'banzai:feature', 'add a thing');
  const denied = write(root, 'src/a.js');
  assert.equal(denied.decision, 'deny');
  assert.match(denied.reason, /starts with a plan/);
  assert.equal(pre(root, 'NotebookEdit', { notebook_path: path.join(root, 'src/n.ipynb') }).decision, 'deny');
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
