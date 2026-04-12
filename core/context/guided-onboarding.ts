import { access, readdir, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { isAbsolute, join, resolve } from 'node:path';

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
type RepositoryHypothesisChoice = 'confirmed' | 'partial' | 'wrong-frame';

interface RepositoryInference {
  likelyPurpose: string;
  focusPaths: string[];
  architectureSignals: string[];
  hiddenConventions: string[];
  workingMethod: string;
  codeHint?: string;
}

const IGNORED_DIRS = new Set([
  '.git',
  '.next',
  '.turbo',
  '.yarn',
  'build',
  'coverage',
  'dist',
  'node_modules',
  'out',
  'tmp',
]);

const YES_ANSWERS = new Set(['1', 'y', 'yes', 'yeah', 'yep', '네', '예', '응', 'ㅇ']);

const COPY = {
  en: {
    intro:
      'This step matters most. It may take a while, and that is okay — please invest the time so Shift AX can make accurate decisions later.',
    roleSummary: 'What kind of work do you usually own or lead? ',
    firstWorkType: 'What is one core kind of work I should understand first? ',
    nextWorkType: 'What is another core kind of work I should learn? ',
    moreWorkTypes: 'Should we capture another work type? [y/N]: ',
    workTypeSummary: (workType: string) => `How does "${workType}" usually show up in your day-to-day work? `,
    firstRepository: (workType: string) => `What is one repository I should understand for "${workType}"? `,
    nextRepository: (workType: string) => `What is another repository I should understand for "${workType}"? `,
    moreRepositories: (workType: string) => `Should I capture another repository for "${workType}"? [y/N]: `,
    repositoryPath: (repository: string, defaultPath: string) =>
      `Where should Shift AX inspect "${repository}"? [${defaultPath || 'blank if unknown'}]: `,
    repositoryHypothesis: (repository: string, inference: RepositoryInference) =>
      [
        `I inspected "${repository}" and this is my current hypothesis:`,
        `- Likely role: ${inference.likelyPurpose}`,
        `- Likely architecture/layers: ${inference.architectureSignals.join('; ') || 'No strong signal yet.'}`,
        `- Likely focus paths: ${inference.focusPaths.join(', ') || 'repo root only so far.'}`,
        `- Likely hidden conventions: ${inference.hiddenConventions.join('; ') || 'No hidden convention inferred yet.'}`,
        ...(inference.codeHint ? [`- Code/doc hint: ${inference.codeHint}`] : []),
        '',
        'Choose one:',
        '1. This is basically correct.',
        '2. Part of it is wrong. I will explain what differs.',
        '3. This is the wrong frame. I will explain how Shift AX should approach it.',
        '> ',
      ].join('\n'),
    partialCorrection: (repository: string) =>
      `What part of "${repository}" is off, and what should Shift AX remember instead? `,
    wrongFrameCorrection: (repository: string) =>
      `What is the right frame for "${repository}" and how should Shift AX approach it instead? `,
    repositoryPurpose: (repository: string) => `What role does "${repository}" mainly play in your work?`,
    repositoryFocusPaths: (repository: string) => `Which directories or files matter most in "${repository}"?`,
    confirmedWorkflow: (workType: string, repository: string) =>
      `What is the actual working method for "${workType}" in "${repository}"?`,
    hiddenConventions: (repository: string) =>
      `What hidden convention, architecture intent, or layer boundary should Shift AX remember for "${repository}"?`,
    firstGlossaryTerm:
      'Tell me one company-specific term, acronym, or alias I should learn first. Leave blank if none: ',
    nextGlossaryTerm: 'Tell me another company-specific term, acronym, or alias: ',
    moreGlossaryTerms: 'Should I capture another company term or acronym? [y/N]: ',
    glossaryDefinition: (term: string) => `What does "${term}" mean in your company/domain? `,
    verificationCommands:
      'Which verification commands should Shift AX run by default?',
    overwrite: (path: string) =>
      `Global knowledge already exists at ${path}. Overwrite and back up the previous files? [y/N]: `,
    shareMessage: (path: string) =>
      `Onboarding finished. Please share ${path} with teammates who do similar work and ask them to place it in the same location.`,
  },
  ko: {
    intro:
      '이 단계가 가장 중요합니다. 시간이 조금 오래 걸려도 괜찮으니, 앞으로 정확하게 판단할 수 있도록 기꺼이 시간을 투자해 주세요.',
    roleSummary: '당신이 주로 맡거나 리드하는 업무는 무엇인가요? ',
    firstWorkType: '제가 먼저 이해해야 할 핵심 업무 하나를 알려주세요. ',
    nextWorkType: '추가로 이해해야 할 핵심 업무가 또 있나요? ',
    moreWorkTypes: '다른 작업 유형도 이어서 기록할까요? [y/N]: ',
    workTypeSummary: (workType: string) => `"${workType}" 업무는 일상에서 보통 어떤 식으로 나타나나요? `,
    firstRepository: (workType: string) => `"${workType}" 업무에서 먼저 이해해야 할 레포 하나를 알려주세요. `,
    nextRepository: (workType: string) => `"${workType}" 업무에서 추가로 이해해야 할 레포가 또 있나요? `,
    moreRepositories: (workType: string) => `"${workType}" 업무에 대해 다른 레포도 기록할까요? [y/N]: `,
    repositoryPath: (repository: string, defaultPath: string) =>
      `Shift AX가 "${repository}"를 어디서 읽어야 하나요? [${defaultPath || '모르면 공백'}]: `,
    repositoryHypothesis: (repository: string, inference: RepositoryInference) =>
      [
        `"${repository}"를 읽어보고 현재 이렇게 가설을 세웠습니다:`,
        `- 추정 역할: ${inference.likelyPurpose}`,
        `- 추정 아키텍처/레이어: ${inference.architectureSignals.join('; ') || '뚜렷한 신호를 아직 찾지 못했습니다.'}`,
        `- 추정 집중 경로: ${inference.focusPaths.join(', ') || '지금은 레포 루트만 보였습니다.'}`,
        `- 추정 숨은 규칙: ${inference.hiddenConventions.join('; ') || '숨은 규칙은 아직 강하게 보이지 않습니다.'}`,
        ...(inference.codeHint ? [`- 코드/문서 힌트: ${inference.codeHint}`] : []),
        '',
        '하나를 골라주세요:',
        '1. 지금 설명이 대체로 맞습니다.',
        '2. 일부가 틀렸습니다. 무엇이 다른지 설명하겠습니다.',
        '3. 완전히 다른 프레임입니다. 어떻게 접근해야 하는지 설명하겠습니다.',
        '> ',
      ].join('\n'),
    partialCorrection: (repository: string) =>
      `"${repository}"에 대해 무엇이 다른지, 그리고 Shift AX가 무엇을 기억해야 하는지 알려주세요. `,
    wrongFrameCorrection: (repository: string) =>
      `"${repository}"는 어떤 프레임으로 봐야 하는지, 그리고 Shift AX가 어떻게 접근해야 하는지 알려주세요. `,
    repositoryPurpose: (repository: string) => `"${repository}"는 당신의 업무에서 어떤 역할을 하나요?`,
    repositoryFocusPaths: (repository: string) => `"${repository}"에서 특히 중요한 디렉토리나 파일은 무엇인가요?`,
    confirmedWorkflow: (workType: string, repository: string) =>
      `"${workType}" 업무를 "${repository}"에서 실제로 어떤 절차로 진행하나요?`,
    hiddenConventions: (repository: string) =>
      `"${repository}"에서 꼭 기억해야 할 숨은 컨벤션, 아키텍처 의도, 레이어 경계는 무엇인가요?`,
    firstGlossaryTerm:
      '먼저 알아야 할 회사 전용 용어, 약어, 별칭이 하나 있나요? 없으면 비워두세요: ',
    nextGlossaryTerm: '추가로 알아야 할 회사 전용 용어, 약어, 별칭이 있나요? ',
    moreGlossaryTerms: '다른 용어나 약어도 기록할까요? [y/N]: ',
    glossaryDefinition: (term: string) => `"${term}"는 회사/도메인에서 어떤 의미인가요? `,
    verificationCommands:
      'Shift AX가 기본으로 돌려야 하는 검증 명령은 무엇인가요?',
    overwrite: (path: string) =>
      `${path} 아래에 기존 글로벌 지식이 있습니다. 이전 파일을 백업하고 덮어쓸까요? [y/N]: `,
    shareMessage: (path: string) =>
      `온보딩이 끝났습니다. 비슷한 업무를 하는 동료에게 ${path} 를 공유하고 같은 위치에 넣어달라고 안내해주세요.`,
  },
} as const;

function normalizeCommaList(value: string): string[] {
  return value
    .split(/[\n,]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function uniqueList(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function normalizeInlineText(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeYesNo(value: string): boolean {
  return YES_ANSWERS.has(value.trim().toLowerCase());
}

function renderDefaultList(values: string[]): string {
  return values.join(', ');
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

async function promptOptionalWithDefault(
  ask: Ask,
  question: string,
  defaultValue = '',
): Promise<string> {
  const suffix = defaultValue ? ` [${defaultValue}]` : '';
  const answer = (await ask(`${question}${suffix}: `)).trim();
  return answer || defaultValue;
}

async function promptChoice(ask: Ask, question: string): Promise<RepositoryHypothesisChoice> {
  while (true) {
    const answer = (await ask(question)).trim();
    if (answer === '' || answer === '1') return 'confirmed';
    if (answer === '2') return 'partial';
    if (answer === '3') return 'wrong-frame';
  }
}

async function promptAddAnother(ask: Ask, question: string): Promise<boolean> {
  return normalizeYesNo(await ask(question));
}

async function collectInterestingPaths(rootDir: string, requestedPaths: string[]): Promise<string[]> {
  const seeds = requestedPaths.length > 0 ? requestedPaths : ['.'];
  const queue = seeds.map((relativePath) => ({ relativePath, depth: 0 }));
  const seen = new Set<string>();
  const interesting: string[] = [];

  while (queue.length > 0 && seen.size < 80 && interesting.length < 12) {
    const current = queue.shift()!;
    const normalized = current.relativePath === '' ? '.' : current.relativePath;
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const absolute = resolve(rootDir, normalized);
    if (!(await pathExists(absolute))) continue;

    const entries = await readdir(absolute, { withFileTypes: true }).catch(() => []);
    for (const entry of entries.slice(0, 30)) {
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory() && IGNORED_DIRS.has(entry.name)) continue;

      const relative = normalized === '.' ? entry.name : join(normalized, entry.name);
      if (entry.isDirectory()) {
        if (
          /adapter|api|app|apps|architecture|controller|controllers|core|domain|docs|dto|entity|handler|infra|model|package|packages|prisma|repo|repository|route|routes|schema|service|services|src|test|tests|usecase|worker|job/i.test(
            entry.name,
          )
        ) {
          interesting.push(relative);
        }
        if (current.depth < 2) {
          queue.push({ relativePath: relative, depth: current.depth + 1 });
        }
        continue;
      }

      if (/\.(md|ts|tsx|js|jsx|json|yaml|yml|sql|prisma)$/.test(entry.name)) {
        interesting.push(relative);
      }

      if (interesting.length >= 12) break;
    }
  }

  return uniqueList(interesting).slice(0, 8);
}

async function readHint(rootDir: string, interestingPaths: string[]): Promise<string | undefined> {
  const candidates = uniqueList([
    'README.md',
    'docs/architecture/system-overview.md',
    'docs/architecture/README.md',
    ...interestingPaths,
  ]);

  for (const candidate of candidates) {
    const absolute = resolve(rootDir, candidate);
    if (!(await pathExists(absolute))) continue;
    const excerpt = await readFile(absolute, 'utf8')
      .then((content) => normalizeInlineText(content.slice(0, 220)))
      .catch(() => '');
    if (excerpt) return excerpt;
  }

  return undefined;
}

function deriveArchitectureSignals(interestingPaths: string[]): string[] {
  const haystack = interestingPaths.join(' ').toLowerCase();
  const signals: string[] = [];

  if (/controller/.test(haystack) && /service/.test(haystack)) {
    signals.push('controller/service boundaries look intentional');
  }
  if (/model/.test(haystack) && /view/.test(haystack) && /controller/.test(haystack)) {
    signals.push('an MVC-style split may be in play');
  }
  if (/route|routes|router|api|handler/.test(haystack)) {
    signals.push('request entrypoints appear to flow through route or handler layers');
  }
  if (/dto|schema|serializer|contract/.test(haystack)) {
    signals.push('DTO or schema boundaries appear to matter');
  }
  if (/domain|usecase|use-case|entity|aggregate|value-object/.test(haystack)) {
    signals.push('domain/use-case layering suggests a clean-architecture style');
  }
  if (/adapter|infra|repository|port/.test(haystack)) {
    signals.push('adapter/infra/repository layers suggest ports-and-adapters conventions');
  }
  if (/packages|apps/.test(haystack)) {
    signals.push('apps/packages boundaries suggest a workspace or monorepo structure');
  }
  if (/docs\/architecture|adr|decision/.test(haystack)) {
    signals.push('architecture docs likely encode intentional boundaries');
  }

  return uniqueList(signals);
}

function deriveHiddenConventions(interestingPaths: string[]): string[] {
  const haystack = interestingPaths.join(' ').toLowerCase();
  const conventions: string[] = [];

  if (/controller/.test(haystack) && /service/.test(haystack)) {
    conventions.push('keep controller and service responsibilities separate when changing behavior');
  }
  if (/dto|schema|serializer|contract/.test(haystack)) {
    conventions.push('sync DTO/schema changes with boundary or contract updates');
  }
  if (/test|spec|__tests__/.test(haystack)) {
    conventions.push('tests appear to be part of the normal change path, not a final afterthought');
  }
  if (/prisma|schema|migration|sql/.test(haystack)) {
    conventions.push('data-shape changes may follow a separate schema or migration workflow');
  }
  if (/docs\/architecture|adr|decision/.test(haystack)) {
    conventions.push('read architecture docs or ADRs before changing layer ownership or flow boundaries');
  }
  if (/domain|usecase|use-case/.test(haystack) && /adapter|infra|repository/.test(haystack)) {
    conventions.push('respect domain versus adapter/infra boundaries instead of mixing layers');
  }
  if (/packages|apps/.test(haystack)) {
    conventions.push('shared packages likely need broader compatibility checks than app-local changes');
  }

  return uniqueList(conventions);
}

function deriveLikelyPurpose(repository: string, interestingPaths: string[]): string {
  const haystack = `${repository} ${interestingPaths.join(' ')}`.toLowerCase();

  if (/controller|service|route|routes|api|handler/.test(haystack)) {
    return 'primary application or service repository with API-style boundaries';
  }
  if (/packages|apps/.test(haystack)) {
    return 'workspace repository that likely splits apps from shared packages';
  }
  if (/docs\/architecture|adr|decision|readme/.test(haystack)) {
    return 'documentation-rich repository that likely defines shared technical rules';
  }

  return `${repository} is a repository that matters in this workflow, but its role still needs confirmation.`;
}

function buildWorkingMethod({
  interestingPaths,
  architectureSignals,
  hiddenConventions,
}: {
  interestingPaths: string[];
  architectureSignals: string[];
  hiddenConventions: string[];
}): string {
  const haystack = interestingPaths.join(' ').toLowerCase();
  const steps: string[] = [];

  if (/docs\/architecture|adr|decision/.test(haystack)) {
    steps.push('Check the architecture docs or ADRs first when a change might cross boundaries.');
  }
  if (architectureSignals.some((signal) => signal.includes('controller/service'))) {
    steps.push('Trace controller and service edges together before editing behavior.');
  }
  if (/route|routes|router|api|handler/.test(haystack) && /dto|schema|serializer|contract/.test(haystack)) {
    steps.push('Update request or response contracts alongside route and handler changes.');
  }
  if (/prisma|schema|migration|sql/.test(haystack)) {
    steps.push('Treat schema or migration work as a separate confirmation step when data contracts move.');
  }
  if (/test|spec|__tests__/.test(haystack)) {
    steps.push('Keep focused regression tests in the normal change path.');
  }
  if (steps.length === 0) {
    steps.push('Inspect the active code path carefully and confirm the current boundaries before editing.');
  }
  if (hiddenConventions.length > 0) {
    steps.push(`Remember the likely hidden rule set: ${hiddenConventions.join('; ')}.`);
  }

  return steps.join(' ');
}

async function inferRepositoryContext({
  rootDir,
  repository,
  focusPaths,
}: {
  rootDir?: string;
  repository: string;
  focusPaths: string[];
}): Promise<RepositoryInference> {
  const interestingPaths = rootDir ? await collectInterestingPaths(rootDir, focusPaths) : [];
  const architectureSignals = deriveArchitectureSignals(interestingPaths);
  const hiddenConventions = deriveHiddenConventions(interestingPaths);
  const codeHint = rootDir ? await readHint(rootDir, interestingPaths) : undefined;

  return {
    likelyPurpose: deriveLikelyPurpose(repository, interestingPaths),
    focusPaths: interestingPaths,
    architectureSignals,
    hiddenConventions,
    workingMethod: buildWorkingMethod({
      interestingPaths,
      architectureSignals,
      hiddenConventions,
    }),
    codeHint,
  };
}

function buildInferredNotes(inference: RepositoryInference): string[] {
  return uniqueList([
    `Likely role: ${inference.likelyPurpose}`,
    inference.architectureSignals.length > 0
      ? `Likely architecture/layers: ${inference.architectureSignals.join('; ')}`
      : '',
    inference.focusPaths.length > 0 ? `Likely focus paths: ${inference.focusPaths.join(', ')}` : '',
    inference.hiddenConventions.length > 0
      ? `Likely hidden conventions: ${inference.hiddenConventions.join('; ')}`
      : '',
    inference.codeHint ? `Code/doc hint: ${inference.codeHint}` : '',
  ]);
}

function buildConfirmationNotes({
  choice,
  correction,
}: {
  choice: RepositoryHypothesisChoice;
  correction: string;
}): string {
  if (choice === 'confirmed') {
    return 'User selected option 1 and confirmed the hypothesis.';
  }
  if (choice === 'partial') {
    return `User selected option 2. Correction: ${correction}`;
  }
  return `User selected option 3. Reframed approach: ${correction}`;
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
      ? (defaultPath || undefined)
      : isAbsolute(requestedPath)
        ? requestedPath
        : resolve(rootDir, requestedPath);

  const inference = await inferRepositoryContext({
    rootDir: repositoryPath,
    repository,
    focusPaths: [],
  });
  const choice = await promptChoice(ask, copy.repositoryHypothesis(repository, inference));
  const correction =
    choice === 'partial'
      ? await promptNonEmpty(ask, copy.partialCorrection(repository))
      : choice === 'wrong-frame'
        ? await promptNonEmpty(ask, copy.wrongFrameCorrection(repository))
        : '';

  const purpose = await promptOptionalWithDefault(ask, copy.repositoryPurpose(repository), inference.likelyPurpose);
  const directoriesDefault = renderDefaultList(inference.focusPaths);
  const directories = uniqueList(
    normalizeCommaList(
      await promptOptionalWithDefault(
        ask,
        copy.repositoryFocusPaths(repository),
        directoriesDefault,
      ),
    ),
  );
  const workflow = await promptOptionalWithDefault(
    ask,
    copy.confirmedWorkflow(workType, repository),
    choice === 'confirmed' ? inference.workingMethod : correction,
  );
  const hiddenConventions = uniqueList(
    normalizeCommaList(
      await promptOptionalWithDefault(
        ask,
        copy.hiddenConventions(repository),
        renderDefaultList(inference.hiddenConventions),
      ),
    ),
  );

  return {
    repository,
    repositoryPath,
    purpose,
    directories,
    workflow,
    hiddenConventions,
    inferredNotes: buildInferredNotes(inference),
    confirmationNotes: buildConfirmationNotes({ choice, correction }),
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
  const workTypes: ShiftAxGlobalOnboardingWorkTypeInput[] = [];
  let workTypeName = await promptNonEmpty(ask, copy.firstWorkType);

  while (workTypeName) {
    const summary = await promptNonEmpty(ask, copy.workTypeSummary(workTypeName));
    const repositoryInputs: ShiftAxGlobalOnboardingRepositoryInput[] = [];
    let repositoryName = await promptNonEmpty(ask, copy.firstRepository(workTypeName));
    let repositoryIndex = 0;

    while (repositoryName) {
      repositoryInputs.push(
        await buildRepositoryInput({
          ask,
          locale,
          rootDir,
          workType: workTypeName,
          repository: repositoryName,
          defaultPath: repositoryIndex === 0 ? rootDir : '',
        }),
      );
      repositoryIndex += 1;

      if (!(await promptAddAnother(ask, copy.moreRepositories(workTypeName)))) {
        break;
      }
      repositoryName = await promptNonEmpty(ask, copy.nextRepository(workTypeName));
    }

    workTypes.push({
      name: workTypeName,
      summary,
      repositories: repositoryInputs,
    });

    if (!(await promptAddAnother(ask, copy.moreWorkTypes))) {
      break;
    }
    workTypeName = await promptNonEmpty(ask, copy.nextWorkType);
  }

  const domainLanguage = [];
  let glossaryTerm = (await ask(copy.firstGlossaryTerm)).trim();
  while (glossaryTerm) {
    domainLanguage.push({
      term: glossaryTerm,
      definition: await promptNonEmpty(ask, copy.glossaryDefinition(glossaryTerm)),
    });

    if (!(await promptAddAnother(ask, copy.moreGlossaryTerms))) {
      break;
    }
    glossaryTerm = await promptNonEmpty(ask, copy.nextGlossaryTerm);
  }

  const verificationCommands = uniqueList(
    normalizeCommaList(
      await promptOptionalWithDefault(
        ask,
        copy.verificationCommands,
        defaults.verification_commands?.join(', ') || 'npm test, npm run build',
      ),
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
    } satisfies ShiftAxOnboardingContextProfile,
    engineeringDefaults: {
      ...defaults,
      verification_commands: verificationCommands.length > 0 ? verificationCommands : defaults.verification_commands,
    } as ShiftAxEngineeringDefaults,
    overwrite: normalizeYesNo(overwriteAnswer),
  });

  process.stderr.write(`${copy.shareMessage(result.sharePath)}\n`);
  return result;
}
