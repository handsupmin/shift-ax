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
  hiddenConventions?: string[];
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
  qualityIssues: string[];
}

function slugify(value: string): string {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'context';
}

function toAliasCandidates(value: string): string[] {
  const raw = String(value || '').trim();
  if (!raw) return [];
  const withoutPath = raw.split(/[\\/]/).filter(Boolean).at(-1) || raw;
  const withoutExt = withoutPath.replace(/\.[a-z0-9]+$/i, '');
  const dashed = withoutExt.replace(/[-_]+/g, ' ').trim();
  return [...new Set([withoutExt, dashed].map((item) => item.trim()).filter(Boolean))];
}

function dictionaryEntriesFor({
  label,
  path,
  aliases = [],
}: {
  label: string;
  path: string;
  aliases?: string[];
}): Array<{ label: string; path: string }> {
  return [...new Set([label, ...aliases].map((item) => item.trim()).filter(Boolean))]
    .filter((item) => !/^\.?\/?\w*\/.+\.md$/i.test(item))
    .map((item) => ({ label: item, path }));
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
    '## Summary',
    '',
    `${repository.purpose?.trim() || repoTitle} workflow for ${workType}.`,
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

  if ((repository.hiddenConventions ?? []).length > 0) {
    lines.push('## Hidden Conventions and Layer Intent', '');
    lines.push(...(repository.hiddenConventions ?? []).map((note) => `- ${note}`));
    lines.push('');
  }

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
    '## Summary',
    '',
    repository.purpose?.trim() || `${repository.repository} repository context.`,
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
    '## Summary',
    '',
    entry.definition.trim(),
    '',
    '## Details',
    '',
    entry.definition.trim(),
    '',
  ].join('\n');
}

function renderPrimaryRolePage(primaryRoleSummary: string): string {
  return [
    '# Primary Role',
    '',
    '## Summary',
    '',
    primaryRoleSummary.trim(),
    '',
    '## Details',
    '',
    primaryRoleSummary.trim(),
    '',
  ].join('\n');
}

function renderIndex({
  entriesByCategory,
}: {
  entriesByCategory: Map<string, Array<{ label: string; path: string }>>;
}): string {
  const lines = [
    '# Shift AX Global Index',
    '',
    'Notes:',
    '',
    '- This file is the single Shift AX dictionary.',
    '- Labels are search terms, aliases, repository names, workflow names, and domain terms.',
    '- Detailed procedures and repository notes live in linked markdown pages.',
    '- Reviewed topic artifacts override repository evidence, which override global knowledge, when they conflict.',
    '',
  ];

  const order = ['Role', 'Work Types', 'Repositories', 'Procedures', 'Domain Language'];
  const globallySeenLabels = new Set<string>();
  for (const category of order) {
    const entries = entriesByCategory.get(category) || [];
    lines.push(`## ${category}`, '');
    const uniqueEntries = entries
      .filter((entry) => {
        const key = entry.label.toLowerCase();
        if (globallySeenLabels.has(key)) return false;
        globallySeenLabels.add(key);
        return true;
      })
      .sort((a, b) => a.label.localeCompare(b.label));
    if (uniqueEntries.length === 0) {
      lines.push('- None yet.', '');
      continue;
    }
    for (const entry of uniqueEntries) {
      lines.push(`- ${entry.label} -> ${entry.path}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

export async function authorGlobalKnowledgeBase({
  primaryRoleSummary,
  workTypes,
  domainLanguage,
}: ShiftAxGlobalKnowledgeAuthoringInput): Promise<ShiftAxGlobalKnowledgeAuthoringResult> {
  const home = getGlobalContextHome();
  const contextDocs: Array<{ label: string; path: string }> = [];
  const entriesByCategory = new Map<string, Array<{ label: string; path: string }>>();
  const qualityIssues: string[] = [];
  const repoWorkTypeMap = new Map<string, Set<string>>();

  const addEntries = (category: string, entries: Array<{ label: string; path: string }>) => {
    const current = entriesByCategory.get(category) || [];
    const merged = new Map<string, { label: string; path: string }>();
    for (const entry of [...current, ...entries]) {
      merged.set(`${entry.label}::${entry.path}`, entry);
    }
    entriesByCategory.set(category, [...merged.values()]);
  };

  const roleRelativePath = 'role/primary-role.md';
  await writeMarkdown(join(home.root, roleRelativePath), renderPrimaryRolePage(primaryRoleSummary));
  contextDocs.push({ label: 'Primary Role', path: roleRelativePath });
  addEntries('Role', dictionaryEntriesFor({ label: 'Primary Role', path: roleRelativePath, aliases: ['role', 'owner workflow'] }));

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
      addEntries(
        'Procedures',
        dictionaryEntriesFor({
          label: `${workType.name} — ${repository.repository}`,
          path: procedureRelativePath,
          aliases: [],
        }),
      );

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
      addEntries(
        'Repositories',
        dictionaryEntriesFor({
          label: repository.repository,
          path: repoRelativePath,
          aliases: [
            ...toAliasCandidates(repository.repository),
          ],
        }),
      );
    }

    const workTypeRelativePath = `work-types/${workTypeSlug}.md`;
    await writeMarkdown(
      join(home.workTypesDir, `${workTypeSlug}.md`),
      renderWorkTypePage({
        workType,
        procedureLinks,
      }),
    );

    contextDocs.push({
      label: workType.name,
      path: workTypeRelativePath,
    });
    addEntries(
      'Work Types',
      dictionaryEntriesFor({
        label: workType.name,
        path: workTypeRelativePath,
        aliases: toAliasCandidates(workType.name),
      }),
    );
  }

  for (const entry of domainLanguage) {
    const slug = slugify(entry.term);
    const relativePath = `domain-language/${slug}.md`;
    await writeMarkdown(join(home.domainLanguageDir, `${slug}.md`), renderDomainLanguagePage(entry));
    contextDocs.push({
      label: entry.term,
      path: relativePath,
    });
    addEntries(
      'Domain Language',
      dictionaryEntriesFor({
        label: entry.term,
        path: relativePath,
        aliases: toAliasCandidates(entry.term),
      }),
    );
  }

  await writeMarkdown(
    home.indexPath,
    renderIndex({
      entriesByCategory,
    }),
  );

  return {
    indexPath: home.indexPath,
    contextDocs,
    qualityIssues,
  };
}
