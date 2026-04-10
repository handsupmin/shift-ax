import { mkdir, writeFile } from 'node:fs/promises';
import { basename, dirname, join } from 'node:path';

import { getGlobalContextHome } from '../settings/global-context-home.js';

export interface ShiftAxGlobalDomainLanguageInput {
  term: string;
  definition: string;
}

export interface ShiftAxGlobalRepositoryProcedureInput {
  repository: string;
  repositoryPath?: string;
  purpose?: string;
  directories: string[];
  workflow: string;
  inferredNotes?: string[];
  confirmationNotes?: string;
  volatility?: 'stable' | 'volatile';
}

export interface ShiftAxGlobalWorkTypeInput {
  name: string;
  summary?: string;
  repositories: ShiftAxGlobalRepositoryProcedureInput[];
}

export interface ShiftAxGlobalKnowledgeAuthoringInput {
  primaryRoleSummary: string;
  workTypes: ShiftAxGlobalWorkTypeInput[];
  domainLanguage: ShiftAxGlobalDomainLanguageInput[];
}

export interface ShiftAxGlobalKnowledgeAuthoringResult {
  indexPath: string;
  contextDocs: Array<{ label: string; path: string }>;
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

async function writeMarkdown(path: string, content: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, `${content.trimEnd()}\n`, 'utf8');
}

function renderProcedurePage({
  workType,
  repository,
}: {
  workType: string;
  repository: ShiftAxGlobalRepositoryProcedureInput;
}): string {
  const repoTitle = repository.repository;
  const lines = [
    `# ${workType} — ${repoTitle}`,
    '',
    '## Repository',
    '',
    `- Name: ${repoTitle}`,
    ...(repository.repositoryPath ? [`- Path: ${repository.repositoryPath}`] : []),
    ...(repository.purpose ? [`- Purpose: ${repository.purpose}`] : []),
    '',
    '## Working Directories',
    '',
    ...(repository.directories.length > 0
      ? repository.directories.map((directory) => `- ${directory}`)
      : ['- No directories were recorded yet.']),
    '',
    '## Working Method',
    '',
    repository.workflow.trim(),
    '',
  ];

  if ((repository.inferredNotes ?? []).length > 0) {
    lines.push('## Inferred Workflow Notes', '');
    lines.push(...(repository.inferredNotes ?? []).map((note) => `- ${note}`));
    lines.push('');
  }

  if (repository.confirmationNotes?.trim()) {
    lines.push('## Confirmation Notes', '', repository.confirmationNotes.trim(), '');
  }

  lines.push(
    '## Volatility',
    '',
    repository.volatility === 'stable'
      ? 'This workflow is treated as stable cross-repo guidance.'
      : 'This workflow is treated as volatile inspect-and-confirm guidance.',
    '',
  );

  return lines.join('\n');
}

function renderRepositoryPage({
  repository,
  workTypes,
}: {
  repository: ShiftAxGlobalRepositoryProcedureInput;
  workTypes: string[];
}): string {
  const lines = [
    `# ${repository.repository}`,
    '',
    '## Work Types',
    '',
    ...workTypes.map((workType) => `- ${workType}`),
    '',
  ];

  if (repository.repositoryPath) {
    lines.push('## Repository Path', '', repository.repositoryPath, '');
  }

  if (repository.purpose?.trim()) {
    lines.push('## Purpose', '', repository.purpose.trim(), '');
  }

  lines.push(
    '## Notes',
    '',
    'This page is a repository index. Detailed working methods live in linked procedure pages.',
    '',
  );

  return lines.join('\n');
}

function renderWorkTypePage({
  workType,
  procedureLinks,
}: {
  workType: ShiftAxGlobalWorkTypeInput;
  procedureLinks: Array<{ repository: string; path: string }>;
}): string {
  return [
    `# ${workType.name}`,
    '',
    '## Summary',
    '',
    workType.summary?.trim() || 'No summary recorded yet.',
    '',
    '## Related Repositories',
    '',
    ...procedureLinks.map((item) => `- ${item.repository} -> ${item.path}`),
    '',
  ].join('\n');
}

function renderDomainLanguagePage(entry: ShiftAxGlobalDomainLanguageInput): string {
  return [
    `# ${entry.term}`,
    '',
    entry.definition.trim(),
    '',
  ].join('\n');
}

function renderIndex({
  primaryRoleSummary,
  workTypeEntries,
  domainEntries,
}: {
  primaryRoleSummary: string;
  workTypeEntries: Array<{ label: string; path: string }>;
  domainEntries: Array<{ label: string; path: string }>;
}): string {
  return [
    '# Shift AX Global Index',
    '',
    '## Primary Role',
    '',
    primaryRoleSummary.trim(),
    '',
    '## Work Types',
    '',
    ...(workTypeEntries.length > 0
      ? workTypeEntries.map((entry) => `- ${entry.label} -> ${entry.path}`)
      : ['- None yet.']),
    '',
    '## Domain Language',
    '',
    ...(domainEntries.length > 0
      ? domainEntries.map((entry) => `- ${entry.label} -> ${entry.path}`)
      : ['- None yet.']),
    '',
    'Notes:',
    '',
    '- The index stays intentionally lightweight.',
    '- Detailed procedures and repository notes live in linked markdown pages.',
    '- Reviewed topic artifacts override repository evidence, which override global knowledge, when they conflict.',
    '',
  ].join('\n');
}

export async function authorGlobalKnowledgeBase({
  primaryRoleSummary,
  workTypes,
  domainLanguage,
}: ShiftAxGlobalKnowledgeAuthoringInput): Promise<ShiftAxGlobalKnowledgeAuthoringResult> {
  const home = getGlobalContextHome();
  const contextDocs: Array<{ label: string; path: string }> = [];
  const workTypeEntries: Array<{ label: string; path: string }> = [];
  const domainEntries: Array<{ label: string; path: string }> = [];
  const repoWorkTypeMap = new Map<string, Set<string>>();

  for (const workType of workTypes) {
    const workTypeSlug = slugify(workType.name);
    const procedureLinks: Array<{ repository: string; path: string }> = [];

    for (const repository of workType.repositories) {
      const repoSlug = slugify(repository.repository || basename(repository.repositoryPath || 'repo'));
      const procedureFileName = `${workTypeSlug}--${repoSlug}.md`;
      const procedureAbsolutePath = join(home.proceduresDir, procedureFileName);
      const procedureRelativePath = `procedures/${procedureFileName}`;

      await writeMarkdown(
        procedureAbsolutePath,
        renderProcedurePage({
          workType: workType.name,
          repository,
        }),
      );

      procedureLinks.push({
        repository: repository.repository,
        path: procedureRelativePath,
      });
      contextDocs.push({
        label: `${workType.name} — ${repository.repository}`,
        path: procedureRelativePath,
      });

      const repoKey = repoSlug;
      if (!repoWorkTypeMap.has(repoKey)) {
        repoWorkTypeMap.set(repoKey, new Set<string>());
      }
      repoWorkTypeMap.get(repoKey)!.add(workType.name);

      const repoAbsolutePath = join(home.reposDir, `${repoSlug}.md`);
      const repoRelativePath = `repos/${repoSlug}.md`;
      await writeMarkdown(
        repoAbsolutePath,
        renderRepositoryPage({
          repository,
          workTypes: [...repoWorkTypeMap.get(repoKey)!],
        }),
      );
      if (!contextDocs.some((entry) => entry.path === repoRelativePath)) {
        contextDocs.push({
          label: repository.repository,
          path: repoRelativePath,
        });
      }
    }

    const workTypeRelativePath = `work-types/${workTypeSlug}.md`;
    await writeMarkdown(
      join(home.workTypesDir, `${workTypeSlug}.md`),
      renderWorkTypePage({
        workType,
        procedureLinks,
      }),
    );

    workTypeEntries.push({
      label: workType.name,
      path: workTypeRelativePath,
    });
    contextDocs.push({
      label: workType.name,
      path: workTypeRelativePath,
    });
  }

  for (const entry of domainLanguage) {
    const slug = slugify(entry.term);
    const relativePath = `domain-language/${slug}.md`;
    await writeMarkdown(join(home.domainLanguageDir, `${slug}.md`), renderDomainLanguagePage(entry));
    domainEntries.push({
      label: entry.term,
      path: relativePath,
    });
    contextDocs.push({
      label: entry.term,
      path: relativePath,
    });
  }

  await writeMarkdown(
    home.indexPath,
    renderIndex({
      primaryRoleSummary,
      workTypeEntries,
      domainEntries,
    }),
  );

  return {
    indexPath: home.indexPath,
    contextDocs,
  };
}
