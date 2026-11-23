// What the second review found.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { test } from 'node:test';
import {
  SUMMARY, dataOf, repo, put, hook, write, shell, post, entry, plannedRepo, git, gitRepo, call,
  nothing, commit, full
} from './helpers.mjs';

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

test('a branch Git cannot compare after the call counts as a change', () => {
  // The branch has no commit after the call, and its files are gone.
  const emptied = gitRepo();
  const orphan = call(emptied, () => { git(emptied, 'checkout', '-q', '--orphan', 'empty'); git(emptied, 'rm', '-rfq', '.'); });
  assert.match(orphan.note, /could not be compared/);

  // The commit from before the call is gone, so Git cannot list what moved.
  const amended = gitRepo();
  const rewritten = call(amended, () => {
    put(amended, 'src/base.js', 'other\n');
    git(amended, 'commit', '-q', '-a', '--amend', '-m', 'base');
    git(amended, 'reflog', 'expire', '--expire=now', '--all');
    git(amended, 'gc', '-q', '--prune=now');
  });
  assert.match(rewritten.note, /could not be compared/);
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

test('"Yes" leaves a change that another call reported while the dialog was open', () => {
  const root = gitRepo('demo');
  entry(root, 'banzai:feature', 'demo');
  const slow = shell(root, 'slow');
  call(root, () => put(root, 'src/early.js', 'x\n'));
  // The slow call made it before the question, so the asked call's own
  // comparison does not find it.
  put(root, 'src/late.js', 'x\n');
  const asked = shell(root, 'ls');
  assert.doesNotMatch(asked.reason, /src\/late\.js/);
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
