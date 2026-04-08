import { existsSync } from 'node:fs';
import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

import { authorBaseContextIndex, type AuthorBaseContextIndexResult } from '../context/index-authoring.js';
import {
  readProjectProfile,
  writeProjectProfile,
  type ShiftAxProjectContextDoc,
} from '../policies/project-profile.js';
import { getRootDirFromTopicDir, topicArtifactPath } from '../topics/topic-artifacts.js';
import { recordLifecycleEvent } from './lifecycle-events.js';
import { readWorkflowState, writeWorkflowState } from './workflow-state.js';

export interface ShiftAxPolicyContextSyncEntry {
  label: string;
  path: string;
}

export interface ShiftAxPolicyContextSyncArtifact {
  version: 1;
  status: 'not_needed' | 'required' | 'completed';
  required_updates: string[];
  created_at: string;
  updated_at: string;
  summary?: string;
  synced_paths?: string[];
  synced_entries?: ShiftAxPolicyContextSyncEntry[];
}

const POLICY_UPDATE_HEADING =
  /^#{2,}\s+(?:base-context\s+policy\s+updates?|base-context\s+updates?|policy\s+updates?)\s*$/i;
const POLICY_UPDATE_NONE =
  /^\s*-\s*(none(?:\s+yet)?|no(?:\s+updates?)?|n\/a|not needed|없음|해당 없음)\s*\.?\s*$/i;

function dedupeStrings(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeEntries(entries: ShiftAxPolicyContextSyncEntry[]): ShiftAxPolicyContextSyncEntry[] {
  const seen = new Set<string>();
  const result: ShiftAxPolicyContextSyncEntry[] = [];

  for (const entry of entries) {
    const normalized = {
      label: entry.label.trim(),
      path: entry.path.trim(),
    };
    if (!normalized.label || !normalized.path) continue;
    const key = `${normalized.label}::${normalized.path}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
  }

  return result;
}

export function extractPolicyContextUpdates(markdown: string): string[] {
  const lines = String(markdown || '').split(/\r?\n/);
  const items: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (POLICY_UPDATE_HEADING.test(line.trim())) {
      capturing = true;
      continue;
    }

    if (capturing && /^#{1,6}\s+/.test(line.trim())) {
      capturing = false;
      continue;
    }

    if (!capturing) continue;

    if (POLICY_UPDATE_NONE.test(line)) {
      continue;
    }

    const match = line.match(/^\s*-\s+(.+?)\s*$/);
    if (match?.[1]) {
      items.push(match[1].trim());
    }
  }

  return dedupeStrings(items);
}

export function inferPolicyContextSyncArtifact({
  brainstormContent,
  specContent,
  implementationPlanContent,
  now = new Date(),
}: {
  brainstormContent: string;
  specContent: string;
  implementationPlanContent: string;
  now?: Date;
}): ShiftAxPolicyContextSyncArtifact {
  const requiredUpdates = dedupeStrings([
    ...extractPolicyContextUpdates(brainstormContent),
    ...extractPolicyContextUpdates(specContent),
    ...extractPolicyContextUpdates(implementationPlanContent),
  ]);

  return {
    version: 1,
    status: requiredUpdates.length > 0 ? 'required' : 'not_needed',
    required_updates: requiredUpdates,
    created_at: now.toISOString(),
    updated_at: now.toISOString(),
  };
}

export async function writePolicyContextSyncArtifact(
  topicDir: string,
  artifact: ShiftAxPolicyContextSyncArtifact,
): Promise<void> {
  await writeFile(
    topicArtifactPath(topicDir, 'policy_context_sync'),
    `${JSON.stringify(artifact, null, 2)}\n`,
    'utf8',
  );
}

export async function readPolicyContextSyncArtifact(
  topicDir: string,
): Promise<ShiftAxPolicyContextSyncArtifact> {
  try {
    const raw = await readFile(topicArtifactPath(topicDir, 'policy_context_sync'), 'utf8');
    return JSON.parse(raw) as ShiftAxPolicyContextSyncArtifact;
  } catch {
    return {
      version: 1,
      status: 'not_needed',
      required_updates: [],
      created_at: new Date(0).toISOString(),
      updated_at: new Date(0).toISOString(),
    };
  }
}

async function mergeContextDocs(
  rootDir: string,
  entries: ShiftAxPolicyContextSyncEntry[],
): Promise<AuthorBaseContextIndexResult | undefined> {
  const mergedEntries = dedupeEntries(entries);
  if (mergedEntries.length === 0) return undefined;

  const index = await authorBaseContextIndex({
    rootDir,
    entries: mergedEntries,
  });

  const profile = await readProjectProfile(rootDir);
  if (profile) {
    const byKey = new Map<string, ShiftAxProjectContextDoc>();
    for (const doc of [...profile.context_docs, ...mergedEntries]) {
      byKey.set(`${doc.label}::${doc.path}`, doc);
    }
    profile.context_docs = [...byKey.values()];
    profile.updated_at = new Date().toISOString();
    await writeProjectProfile(rootDir, profile);
  }

  return index;
}

export async function completePolicyContextSync({
  topicDir,
  summary,
  syncedPaths = [],
  syncedEntries = [],
  now = new Date(),
}: {
  topicDir: string;
  summary: string;
  syncedPaths?: string[];
  syncedEntries?: ShiftAxPolicyContextSyncEntry[];
  now?: Date;
}): Promise<ShiftAxPolicyContextSyncArtifact> {
  if (!summary.trim()) {
    throw new Error('policy context sync summary is required');
  }

  const artifact = await readPolicyContextSyncArtifact(topicDir);
  const rootDir = getRootDirFromTopicDir(topicDir);
  const normalizedPaths = dedupeStrings(syncedPaths);
  const normalizedEntries = dedupeEntries(syncedEntries);

  if (artifact.status === 'required' && normalizedPaths.length === 0 && normalizedEntries.length === 0) {
    throw new Error('policy context sync requires at least one updated path or index entry');
  }

  for (const path of normalizedPaths) {
    if (!existsSync(join(rootDir, path))) {
      throw new Error(`policy context path does not exist: ${path}`);
    }
  }

  for (const entry of normalizedEntries) {
    if (!existsSync(join(rootDir, entry.path))) {
      throw new Error(`policy context entry path does not exist: ${entry.path}`);
    }
  }

  await mergeContextDocs(rootDir, normalizedEntries);

  const completed: ShiftAxPolicyContextSyncArtifact = {
    ...artifact,
    status: artifact.status === 'not_needed' ? 'not_needed' : 'completed',
    updated_at: now.toISOString(),
    summary: summary.trim(),
    synced_paths: normalizedPaths,
    ...(normalizedEntries.length > 0 ? { synced_entries: normalizedEntries } : {}),
  };
  await writePolicyContextSyncArtifact(topicDir, completed);

  const workflow = await readWorkflowState(topicDir);
  if (workflow.plan_review_status === 'approved') {
    workflow.phase = 'approved';
    workflow.updated_at = now.toISOString();
    await writeWorkflowState(topicDir, workflow);
  }

  await recordLifecycleEvent({
    topicDir,
    phase: workflow.plan_review_status === 'approved' ? 'approved' : workflow.phase,
    event: 'policy.sync_completed',
    summary: summary.trim(),
    now,
  });

  return completed;
}
