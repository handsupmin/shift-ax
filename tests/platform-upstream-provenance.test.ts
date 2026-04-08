import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('codex upstream worktree provenance docs define the import boundary', async () => {
  const readme = await readFile(
    new URL('../platform/codex/upstream/README.md', import.meta.url),
    'utf8',
  );
  const provenance = await readFile(
    new URL('../platform/codex/upstream/worktree/provenance.md', import.meta.url),
    'utf8',
  );

  assert.match(readme, /worktree/i);
  assert.match(provenance, /OMC|OMX/);
  assert.match(provenance, /team|tmux/i);
  assert.match(provenance, /minimal/i);
  assert.match(provenance, /src\/team\/worktree\.ts/);
  assert.match(provenance, /src\/team\/state-root\.ts/);
});

test('claude-code upstream worktree provenance docs define the import boundary', async () => {
  const readme = await readFile(
    new URL('../platform/claude-code/upstream/README.md', import.meta.url),
    'utf8',
  );
  const provenance = await readFile(
    new URL('../platform/claude-code/upstream/worktree/provenance.md', import.meta.url),
    'utf8',
  );

  assert.match(readme, /worktree/i);
  assert.match(provenance, /OMC|OMX/);
  assert.match(provenance, /team|tmux/i);
  assert.match(provenance, /minimal/i);
  assert.match(provenance, /src\/team\/git-worktree\.ts/);
  assert.match(provenance, /src\/lib\/worktree-paths\.ts/);
});
