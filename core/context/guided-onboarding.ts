import { access, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { basename, isAbsolute, join, resolve } from 'node:path';

import {
  onboardProjectContext,
  type OnboardProjectContextResult,
  type ShiftAxGlobalOnboardingRepositoryInput,
  type ShiftAxGlobalOnboardingWorkTypeInput,
} from './onboarding.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxOnboardingContextProfile,
} from '../policies/project-profile.js';
import { getGlobalContextHome } from '../settings/global-context-home.js';
import type { ShiftAxLocale } from '../settings/project-settings.js';

type Ask = (question: string) => Promise<string>;

const COPY = {
  en: {
    intro:
      'This step matters most. Please invest 10 minutes so Shift AX can understand how you work.',
    roleSummary: '1. What kind of work do you usually do? ',
    workTypes: 'List your main work types (comma-separated, e.g. API development, incident response): ',
    workTypeSummary: (workType: string) => `Summarize how "${workType}" work usually looks for you: `,
    repositories: (workType: string) =>
      `Which repositories are involved in "${workType}"? (comma-separated): `,
    repositoryPath: (repository: string, defaultPath: string) =>
      `What path should Shift AX inspect for "${repository}"? [${defaultPath} or blank if unknown]: `,
    repositoryPurpose: (repository: string) =>
      `What does "${repository}" mainly do in your work? `,
    directories: (workType: string, repository: string) =>
      `For "${workType}" in "${repository}", which directories do you touch? (comma-separated): `,
    inferredWorkflow: (repository: string, inference: string) =>
      [
        `I inspected "${repository}" and inferred this workflow:`,
        inference,
        'What is wrong or missing? Be explicit.',
        '> ',
      ].join('\n'),
    confirmedWorkflow: (workType: string, repository: string) =>
      `Describe the actual working method for "${workType}" in "${repository}": `,
    glossaryTerms: 'List company-specific terms or aliases Shift AX should know. (comma-separated): ',
    glossaryDefinition: (term: string) => `What does "${term}" mean in your company/domain? `,
    verificationCommands:
      'Which verification commands should Shift AX run by default? (comma-separated)',
    overwrite: (path: string) =>
      `Global knowledge already exists at ${path}. Overwrite and back up the previous files? [y/N]: `,
    shareMessage: (path: string) =>
      `Onboarding finished. Please share ${path} with teammates who do similar work and ask them to place it in the same location.`,
  },
  ko: {
    intro:
      '이 절차가 가장 중요합니다. 당신을 잘 이해하기 위해 10분의 시간을 투자해주세요.',
    roleSummary: '1. 당신은 어떤 업무를 주로 하나요? ',
    workTypes: '주요 작업 유형을 적어주세요. (쉼표 구분, 예: API 개발, 장애 대응): ',
    workTypeSummary: (workType: string) => `"${workType}" 업무는 보통 어떤 식으로 진행되나요? `,
    repositories: (workType: string) =>
      `"${workType}" 업무에 관련된 레포는 무엇인가요? (쉼표 구분): `,
    repositoryPath: (repository: string, defaultPath: string) =>
      `"${repository}"를 Shift AX가 어디서 읽어야 하나요? [${defaultPath} 또는 모르면 공백]: `,
    repositoryPurpose: (repository: string) =>
      `"${repository}"는 당신의 업무에서 어떤 역할을 하나요? `,
    directories: (workType: string, repository: string) =>
      `"${workType}" 업무를 "${repository}"에서 할 때 주로 만지는 디렉토리는 무엇인가요? (쉼표 구분): `,
    inferredWorkflow: (repository: string, inference: string) =>
      [
        `"${repository}"를 읽어보고 제가 이렇게 추론했습니다:`,
        inference,
        '틀린 부분이나 빠진 부분을 꼭 짚어주세요.',
        '> ',
      ].join('\n'),
    confirmedWorkflow: (workType: string, repository: string) =>
      `"${workType}" 업무를 "${repository}"에서 실제로 어떤 절차로 진행하나요? `,
    glossaryTerms: '회사/도메인에서만 쓰는 용어를 적어주세요. (쉼표 구분): ',
    glossaryDefinition: (term: string) => `"${term}"는 무엇인가요? `,
    verificationCommands:
      'Shift AX가 기본으로 돌려야 하는 검증 명령은 무엇인가요? (쉼표 구분)',
    overwrite: (path: string) =>
      `${path} 아래에 기존 글로벌 지식이 있습니다. 이전 파일을 백업하고 덮어쓸까요? [y/N]: `,
    shareMessage: (path: string) =>
      `온보딩이 끝났습니다. 비슷한 업무를 하는 동료에게 ${path} 를 공유하고 같은 위치에 넣어달라고 안내해주세요.`,
  },
} as const;

function normalizeCommaList(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

async function homeHasExistingKnowledge(): Promise<boolean> {
  const home = getGlobalContextHome();
  return (
    (await pathExists(home.indexPath)) ||
    (await pathExists(home.profilePath)) ||
    (await pathExists(home.settingsPath))
  );
}

async function promptNonEmpty(ask: Ask, question: string): Promise<string> {
  while (true) {
    const answer = (await ask(question)).trim();
    if (answer) return answer;
  }
}

async function promptWithDefault(ask: Ask, question: string, defaultValue: string): Promise<string> {
  const answer = (await ask(`${question} [${defaultValue}]: `)).trim();
  return answer || defaultValue;
}

async function listInterestingFiles(rootDir: string, directories: string[]): Promise<string[]> {
  const candidates = directories.length > 0 ? directories : ['.'];
  const interesting: string[] = [];

  for (const directory of candidates.slice(0, 6)) {
    const absolute = resolve(rootDir, directory);
    if (!(await pathExists(absolute))) continue;
    const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.slice(0, 20)) {
      if (entry.name.startsWith('.')) continue;
      const relative = directory === '.' ? entry.name : join(directory, entry.name);
      if (entry.isDirectory()) {
        if (/controller|service|dto|schema|prisma|route|api|worker|job/i.test(entry.name)) {
          interesting.push(relative);
        }
      } else if (/\.(ts|tsx|js|jsx|prisma|sql|md|yaml|yml)$/.test(entry.name)) {
        interesting.push(relative);
      }
      if (interesting.length >= 8) return interesting;
    }
  }

  return interesting;
}

async function inferWorkflow({
  rootDir,
  repository,
  directories,
}: {
  rootDir: string;
  repository: string;
  directories: string[];
}): Promise<string> {
  const interestingFiles = await listInterestingFiles(rootDir, directories);
  const heuristics: string[] = [];
  const haystack = interestingFiles.join(' ');

  if (/controller/i.test(haystack) && /service/i.test(haystack)) {
    heuristics.push('It looks like controller/service boundaries matter here.');
  }
  if (/dto/i.test(haystack)) {
    heuristics.push('DTO definitions appear to be part of the change flow.');
  }
  if (/prisma/i.test(haystack)) {
    heuristics.push('It looks like Prisma schema files may define database changes here.');
  }
  if (/worker|job/i.test(haystack)) {
    heuristics.push('There appear to be worker/job paths that may need runtime or queue-specific handling.');
  }

  let excerpt = '';
  const firstInterestingFile = interestingFiles.find((path) => /\.(ts|tsx|js|jsx|prisma)$/.test(path));
  if (firstInterestingFile) {
    excerpt = await readFile(resolve(rootDir, firstInterestingFile), 'utf8')
      .then((content) => content.slice(0, 220).trim())
      .catch(() => '');
  }

  return [
    `Repository: ${repository}`,
    directories.length > 0 ? `Directories: ${directories.join(', ')}` : 'Directories: none recorded yet.',
    interestingFiles.length > 0
      ? `Observed files/dirs: ${interestingFiles.join(', ')}`
      : 'Observed files/dirs: none',
    heuristics.length > 0 ? `Inferences: ${heuristics.join(' ')}` : 'Inferences: no strong file-pattern inference yet.',
    excerpt ? `First code excerpt hint: ${excerpt}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

async function buildRepositoryInput({
  ask,
  locale,
  rootDir,
  workType,
  repository,
  defaultPath,
}: {
  ask: Ask;
  locale: ShiftAxLocale;
  rootDir: string;
  workType: string;
  repository: string;
  defaultPath: string;
}): Promise<ShiftAxGlobalOnboardingRepositoryInput> {
  const copy = COPY[locale];
  const requestedPath = (await ask(copy.repositoryPath(repository, defaultPath))).trim();
  const repositoryPath =
    requestedPath === ''
      ? defaultPath
      : isAbsolute(requestedPath)
        ? requestedPath
        : resolve(rootDir, requestedPath);
  const purpose = await promptNonEmpty(ask, copy.repositoryPurpose(repository));
  const directories = normalizeCommaList(await ask(copy.directories(workType, repository)));
  const inference = await inferWorkflow({
    rootDir: repositoryPath,
    repository,
    directories,
  });
  const correction = await ask(copy.inferredWorkflow(repository, inference));
  const workflow = await promptNonEmpty(ask, copy.confirmedWorkflow(workType, repository));

  return {
    repository,
    repositoryPath,
    purpose,
    directories,
    workflow,
    inferredNotes: correction.trim() ? [correction.trim()] : [inference],
    confirmationNotes: correction.trim() || 'User accepted the inferred workflow with no further edits.',
    volatility: 'volatile',
  };
}

export async function runGuidedOnboarding({
  rootDir,
  locale,
  ask,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
  ask: Ask;
}): Promise<OnboardProjectContextResult> {
  const copy = COPY[locale];
  const defaults = defaultEngineeringDefaults();
  const home = getGlobalContextHome();

  await ask(`${copy.intro}\n\n(press Enter to continue)\n> `);

  const primaryRoleSummary = await promptNonEmpty(ask, copy.roleSummary);
  const workTypeNames = normalizeCommaList(await promptNonEmpty(ask, copy.workTypes));
  const workTypes: ShiftAxGlobalOnboardingWorkTypeInput[] = [];

  for (const workType of workTypeNames) {
    const summary = await promptNonEmpty(ask, copy.workTypeSummary(workType));
    const repositories = normalizeCommaList(await promptNonEmpty(ask, copy.repositories(workType)));
    const repositoryInputs: ShiftAxGlobalOnboardingRepositoryInput[] = [];

    for (let index = 0; index < repositories.length; index += 1) {
      const repository = repositories[index]!;
      repositoryInputs.push(
        await buildRepositoryInput({
          ask,
          locale,
          rootDir,
          workType,
          repository,
          defaultPath: index === 0 ? rootDir : '',
        }),
      );
    }

    workTypes.push({
      name: workType,
      summary,
      repositories: repositoryInputs,
    });
  }

  const glossaryTerms = normalizeCommaList(await ask(copy.glossaryTerms));
  const domainLanguage = [];
  for (const term of glossaryTerms) {
    domainLanguage.push({
      term,
      definition: await promptNonEmpty(ask, copy.glossaryDefinition(term)),
    });
  }

  const verificationCommands = normalizeCommaList(
    await promptWithDefault(
      ask,
      copy.verificationCommands,
      defaults.verification_commands?.join(', ') || 'npm test, npm run build',
    ),
  );

  const overwriteAnswer = (await homeHasExistingKnowledge())
    ? (await ask(copy.overwrite(home.root))).trim().toLowerCase()
    : 'y';

  const result = await onboardProjectContext({
    rootDir,
    primaryRoleSummary,
    workTypes,
    domainLanguage,
    onboardingContext: {
      primary_role_summary: primaryRoleSummary,
      work_types: workTypes.map((item) => item.name),
      domain_language: domainLanguage.map((item) => item.term),
    },
    engineeringDefaults: {
      ...defaults,
      verification_commands: verificationCommands.length > 0 ? verificationCommands : defaults.verification_commands,
    } as ShiftAxEngineeringDefaults,
    overwrite: ['y', 'yes'].includes(overwriteAnswer),
  });

  process.stderr.write(`${copy.shareMessage(result.sharePath)}\n`);
  return result;
}
