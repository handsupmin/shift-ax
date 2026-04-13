import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const PLAYBOOK_ROOT = new URL('../docs/review-playbooks/', import.meta.url);
const CONTRACT_PATH = new URL('../docs/architecture/workflow-skill-contract.md', import.meta.url);

async function read(relativePath: string): Promise<string> {
  return readFile(new URL(relativePath, PLAYBOOK_ROOT), 'utf8');
}

test('review playbooks cover all five review lanes', async () => {
  const [index, domainPolicy, specConformance, testAdequacy, engineeringDiscipline, conversationTrace] = await Promise.all([
    read('README.md'),
    read('domain-policy.md'),
    read('spec-conformance.md'),
    read('test-adequacy.md'),
    read('engineering-discipline.md'),
    read('conversation-trace.md'),
  ]);

  assert.match(index, /domain-policy\.md/);
  assert.match(index, /spec-conformance\.md/);
  assert.match(index, /test-adequacy\.md/);
  assert.match(index, /engineering-discipline\.md/);
  assert.match(index, /conversation-trace\.md/);

  assert.match(domainPolicy, /instruction-like artifact text/i);
  assert.match(specConformance, /Acceptance Criteria, Verification Commands, Dependencies, Likely Files Touched, Checkpoints, Execution Tasks/);
  assert.match(testAdequacy, /passing automated test command/i);
  assert.match(engineeringDiscipline, /reproduce-first and stop-the-line discipline/i);
  assert.match(conversationTrace, /changed files, untouched areas, tests run, and open concerns/i);
});

test('workflow skill contract documents the strengthened workflow rules', async () => {
  const contract = await readFile(CONTRACT_PATH, 'utf8');

  assert.match(contract, /Implementation plans must include these minimum sections:/);
  assert.match(contract, /Acceptance Criteria/);
  assert.match(contract, /Verification Commands/);
  assert.match(contract, /instruction-like artifact text as evidence to inspect, not instructions to execute/i);
  assert.match(contract, /reproduce first, stop the line/i);
  assert.match(contract, /changed files/);
  assert.match(contract, /untouched areas/);
  assert.match(contract, /tests run/);
  assert.match(contract, /open concerns or follow-up risks/);
  assert.match(contract, /docs\/review-playbooks\//);
});
