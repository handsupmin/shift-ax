#!/usr/bin/env node

import { existsSync } from 'node:fs';
import { createInterface } from 'node:readline/promises';
import { join } from 'node:path';
import { stderr, stdin } from 'node:process';

import { getPlatformAdapter } from '../adapters/index.js';
import { resolveContextFromIndex } from '../core/context/index-resolver.js';
import { orchestrateExecutionTasks } from '../core/planning/execution-orchestrator.js';
import {
  resumeRequestPipeline,
  startRequestPipeline,
} from '../core/planning/request-pipeline.js';
import {
  buildPlanningArtifactsFromInterview,
  type ShiftAxPlanningInterviewAnswers,
} from '../core/planning/brainstorm.js';
import { parseEscalationArgument } from '../core/planning/escalation.js';
import {
  defaultEngineeringDefaults,
  readProjectProfile,
} from '../core/policies/project-profile.js';

function usage(): void {
  process.stderr.write(
    [
      'Usage:',
      '  ax-run-request --request "<text>" [--summary "<text>"] [--brainstorm-file PATH] [--spec-file PATH] [--plan-file PATH] [--index PATH] [--root DIR] [--base BRANCH]',
      '  ax-run-request --topic DIR --resume [--platform <codex|claude-code>] [--verify-command CMD]... [--escalation KIND[:summary]]... [--clear-escalations] [--escalation-resolution "<text>"] [--no-auto-commit]',
      '',
    ].join('\n'),
  );
}

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function readArgs(flag: string): string[] {
  const values: string[] = [];
  process.argv.forEach((arg, index) => {
    if (arg === flag && process.argv[index + 1]) {
      values.push(process.argv[index + 1]!);
    }
  });
  return values;
}

async function readMaybeFile(path: string | undefined): Promise<string | undefined> {
  if (!path) return undefined;
  const { readFile } = await import('node:fs/promises');
  return readFile(path, 'utf8');
}

async function promptInteractivePlanning(
  request: string,
  matchedContextLabels: string[],
  rootDir: string,
): Promise<ReturnType<typeof buildPlanningArtifactsFromInterview>> {
  const profile = (await readProjectProfile(rootDir)) ?? {
    engineering_defaults: defaultEngineeringDefaults(),
  };
  const fallbackAnswers = !stdin.isTTY
    ? (await new Promise<string>((resolve, reject) => {
        let raw = '';
        stdin.setEncoding('utf8');
        stdin.on('data', (chunk) => {
          raw += chunk;
        });
        stdin.on('end', () => resolve(raw));
        stdin.on('error', reject);
      }))
        .split(/\r?\n/)
    : null;
  let fallbackIndex = 0;
  const rl = stdin.isTTY
    ? createInterface({
        input: stdin,
        output: stderr,
      })
    : null;
  const ask = async (question: string) => {
    if (rl) {
      return rl.question(question);
    }

    stderr.write(question);
    const answer = fallbackAnswers?.[fallbackIndex] ?? '';
    fallbackIndex += 1;
    return answer;
  };

  const answers: ShiftAxPlanningInterviewAnswers = {
    outcome: (await ask('Clarified outcome: ')).trim(),
    constraints: (await ask('Constraints or policy notes: ')).trim(),
    outOfScope: (await ask('Explicitly out of scope: ')).trim(),
    verification: (await ask('Verification / tests that should prove this: ')).trim(),
    implementationAreas: (await ask('Likely implementation areas: ')).trim(),
    longRunningWork: (await ask('Any long-running or cross-cutting work: ')).trim(),
    policyUpdates: (await ask('Shared base-context or policy docs to add/update before implementation: ')).trim(),
  };

  rl?.close();

  return buildPlanningArtifactsFromInterview({
    request,
    matchedContextLabels,
    answers,
    engineeringDefaults: profile.engineering_defaults,
  });
}

async function resolveMatchedContextLabels(
  rootDir: string,
  query: string,
  indexPath?: string,
): Promise<string[]> {
  const effectiveIndexPath = indexPath || join(rootDir, 'docs', 'base-context', 'index.md');
  if (!existsSync(effectiveIndexPath)) {
    return [];
  }

  const resolved = await resolveContextFromIndex({
    rootDir,
    indexPath: effectiveIndexPath,
    query,
  });
  return resolved.matches.map((match) => match.label);
}

function buildContextResolutionQuery({
  request,
  brainstormContent,
  specContent,
  implementationPlanContent,
}: {
  request: string;
  brainstormContent?: string;
  specContent?: string;
  implementationPlanContent?: string;
}): string {
  return [
    request.trim(),
    brainstormContent?.trim() ?? '',
    specContent?.trim() ?? '',
    implementationPlanContent?.trim() ?? '',
  ]
    .filter(Boolean)
    .join('\n\n');
}

async function main(): Promise<void> {
  const topicDir = readArg('--topic');
  const resume = process.argv.includes('--resume');
  const platform = readArg('--platform');

  if (resume) {
    if (!topicDir) {
      usage();
      process.exit(1);
    }

    if (platform && platform !== 'codex' && platform !== 'claude-code') {
      usage();
      process.exit(1);
    }

    const runtimePlatform =
      platform === 'codex' || platform === 'claude-code' ? platform : undefined;

    const executionRunner = runtimePlatform
      ? async ({ topicDir }: { topicDir: string; worktreePath: string }) => {
          const adapter = getPlatformAdapter(runtimePlatform);
          const plan = await adapter.planExecution({ topicDir });
          return orchestrateExecutionTasks({
            topicDir,
            tasks: plan.tasks,
            runTask: async (task) => {
              await adapter.launchExecution({
                topicDir,
                taskId: task.task_id,
              });
            },
          });
        }
      : undefined;

    const result = await resumeRequestPipeline({
      topicDir,
      verificationCommands: readArgs('--verify-command'),
      escalationTriggers: readArgs('--escalation').map((value) =>
        parseEscalationArgument(value),
      ),
      clearEscalations: process.argv.includes('--clear-escalations'),
      escalationResolution: readArg('--escalation-resolution'),
      autoCommit: !process.argv.includes('--no-auto-commit'),
      executionRunner,
    });
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
    return;
  }

  const request = readArg('--request');
  if (!request) {
    usage();
    process.exit(1);
  }

  const rootDir = readArg('--root') || process.cwd();
  const indexPath = readArg('--index');
  let brainstormContent = await readMaybeFile(readArg('--brainstorm-file'));
  let specContent = await readMaybeFile(readArg('--spec-file'));
  let implementationPlanContent = await readMaybeFile(readArg('--plan-file'));

  if (!brainstormContent && !specContent && !implementationPlanContent) {
    const matchedContextLabels = await resolveMatchedContextLabels(rootDir, request, indexPath);
    const generated = await promptInteractivePlanning(request, matchedContextLabels, rootDir);
    brainstormContent = generated.brainstormContent;
    specContent = generated.specContent;
    implementationPlanContent = generated.implementationPlanContent;
  }

  const contextQuery = buildContextResolutionQuery({
    request,
    brainstormContent,
    specContent,
    implementationPlanContent,
  });

  const result = await startRequestPipeline({
    rootDir,
    request,
    summary: readArg('--summary'),
    indexPath,
    contextQuery,
    brainstormContent,
    specContent,
    implementationPlanContent,
    baseBranch: readArg('--base') || 'main',
  });

  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}

void main().catch((error) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(1);
});
