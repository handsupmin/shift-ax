import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('codex tmux provenance doc defines the minimal import boundary', async () => {
  const readme = await readFile(
    new URL('../platform/codex/upstream/README.md', import.meta.url),
    'utf8',
  );
  const provenance = await readFile(
    new URL('../platform/codex/upstream/tmux/provenance.md', import.meta.url),
    'utf8',
  );

  assert.match(readme, /tmux/i);
  assert.match(provenance, /tmux/i);
  assert.match(provenance, /src\/team\/tmux-session\.ts/);
  assert.match(provenance, /minimal/i);
});

test('claude-code tmux provenance doc defines the minimal import boundary', async () => {
  const readme = await readFile(
    new URL('../platform/claude-code/upstream/README.md', import.meta.url),
    'utf8',
  );
  const provenance = await readFile(
    new URL('../platform/claude-code/upstream/tmux/provenance.md', import.meta.url),
    'utf8',
  );

  assert.match(readme, /tmux/i);
  assert.match(provenance, /tmux/i);
  assert.match(provenance, /src\/team\/tmux-session\.ts/);
  assert.match(provenance, /minimal/i);
});
