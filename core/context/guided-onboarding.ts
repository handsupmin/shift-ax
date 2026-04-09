import { access } from 'node:fs/promises';
import { constants } from 'node:fs';

import {
  onboardProjectContextFromDiscovery,
  persistProjectContextProfile,
  writeOnboardingDocuments,
  type OnboardProjectContextResult,
  type ShiftAxOnboardingDocumentInput,
} from './onboarding.js';
import {
  defaultEngineeringDefaults,
  type ShiftAxEngineeringDefaults,
  type ShiftAxOnboardingContextProfile,
  type ShiftAxProjectContextDoc,
} from '../policies/project-profile.js';
import {
  extractDomainGlossaryEntries,
  writeDomainGlossaryDocument,
  type ShiftAxGlossaryEntry,
} from './glossary.js';
import { discoverBaseContextEntries } from './discovery.js';
import type { ShiftAxLocale } from '../settings/project-settings.js';

type Ask = (question: string) => Promise<string>;

const COPY = {
  en: {
    shouldDiscover:
      'I found existing docs in this repo. Should I scan them first and reuse them in the base-context index? [Y/n]: ',
    businessContext:
      'What product, service, or business area does this repository support? ',
    userJourney:
      'What user or business workflow does this repository mostly handle? ',
    policyAreas:
      'Which policy or rule areas should the AI never guess about? (comma-separated, e.g. auth, billing, permissions): ',
    riskyDomains:
      'Which areas are risky or sensitive? (comma-separated, e.g. payments, personal data, permissions): ',
    architectureSummary:
      'How is this system structured? Describe the architecture in plain language: ',
    importantPaths:
      'Which folders or files matter most for this repo? (comma-separated paths, optional): ',
    domainTerms:
      'List important internal terms, service names, or aliases the AI should know. (comma-separated, optional): ',
    verificationCommands:
      'What verification commands should Shift AX run by default? (comma-separated)',
    labels: {
      business: 'Business Context',
      policy: 'Domain and Policy Guardrails',
      architecture: 'Architecture Overview',
      importantPaths: 'Important Paths',
      glossary: 'Domain Glossary',
    },
    glossaryDefinition: (term: string) =>
      `Team-provided glossary term for ${term}. Treat this as shared vocabulary for the repository.`,
  },
  ko: {
    shouldDiscover:
      '이 repo 안에 기존 문서가 보입니다. 먼저 스캔해서 base-context index에 재사용할까요? [Y/n]: ',
    businessContext:
      '이 저장소가 담당하는 제품, 서비스, 비즈니스 영역은 무엇인가요? ',
    userJourney:
      '이 저장소가 주로 처리하는 사용자 흐름이나 업무 흐름은 무엇인가요? ',
    policyAreas:
      'AI가 절대 추측하면 안 되는 정책/규칙 영역은 무엇인가요? (쉼표로 구분, 예: auth, billing, permissions): ',
    riskyDomains:
      '위험하거나 민감한 영역은 무엇인가요? (쉼표로 구분, 예: payments, personal data, permissions): ',
    architectureSummary:
      '시스템 구조를 자연어로 설명해주세요. 이 저장소의 아키텍처는 어떤 형태인가요? ',
    importantPaths:
      '중요하게 봐야 할 폴더나 파일 경로는 무엇인가요? (쉼표로 구분, 선택 사항): ',
    domainTerms:
      'AI가 알아야 할 내부 용어, 서비스 이름, 별칭을 적어주세요. (쉼표로 구분, 선택 사항): ',
    verificationCommands:
      'Shift AX가 기본으로 실행해야 할 검증 명령은 무엇인가요? (쉼표로 구분)',
    labels: {
      business: '비즈니스 컨텍스트',
      policy: '도메인 및 정책 가드레일',
      architecture: '아키텍처 개요',
      importantPaths: '중요 경로',
      glossary: '도메인 용어집',
    },
    glossaryDefinition: (term: string) =>
      `${term}에 대한 팀 제공 용어 설명 항목입니다. 이 저장소의 공통 용어로 취급합니다.`,
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

function promptMarkdown(label: string, body: string): string {
  return `# ${label}\n\n${body.trim()}\n`;
}

function joinBullets(items: string[]): string {
  return items.map((item) => `- ${item}`).join('\n');
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

function buildGeneratedDocuments({
  locale,
  businessContext,
  userJourney,
  policyAreas,
  riskyDomains,
  architectureSummary,
  importantPaths,
}: {
  locale: ShiftAxLocale;
  businessContext: string;
  userJourney: string;
  policyAreas: string[];
  riskyDomains: string[];
  architectureSummary: string;
  importantPaths: string[];
}): ShiftAxOnboardingDocumentInput[] {
  const copy = COPY[locale];
  const docs: ShiftAxOnboardingDocumentInput[] = [
    {
      label: copy.labels.business,
      path: 'docs/base-context/business-context.md',
      content: promptMarkdown(
        copy.labels.business,
        locale === 'ko'
          ? `${businessContext}\n\n## 주요 흐름\n\n${userJourney}`
          : `${businessContext}\n\n## Primary Workflow\n\n${userJourney}`,
      ),
    },
    {
      label: copy.labels.policy,
      path: 'docs/base-context/domain-policy-guardrails.md',
      content: promptMarkdown(
        copy.labels.policy,
        [
          locale === 'ko'
            ? '## 추측 금지 영역'
            : '## No-Guessing Areas',
          '',
          joinBullets(policyAreas),
          '',
          locale === 'ko' ? '## 위험 / 민감 영역' : '## Risky / Sensitive Areas',
          '',
          joinBullets(riskyDomains),
        ].join('\n'),
      ),
    },
    {
      label: copy.labels.architecture,
      path: 'docs/base-context/architecture-overview.md',
      content: promptMarkdown(copy.labels.architecture, architectureSummary),
    },
  ];

  if (importantPaths.length > 0) {
    docs.push({
      label: copy.labels.importantPaths,
      path: 'docs/base-context/important-paths.md',
      content: promptMarkdown(copy.labels.importantPaths, joinBullets(importantPaths)),
    });
  }

  return docs;
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

  const hasDocsDir = await pathExists(`${rootDir}/docs`);
  const discoverAnswer =
    hasDocsDir
      ? (await ask(copy.shouldDiscover)).trim().toLowerCase()
      : 'n';
  const useDiscovery = hasDocsDir && !['n', 'no'].includes(discoverAnswer);

  const businessContext = await promptNonEmpty(ask, copy.businessContext);
  const userJourney = await promptNonEmpty(ask, copy.userJourney);
  const policyAreas = normalizeCommaList(await promptNonEmpty(ask, copy.policyAreas));
  const riskyDomains = normalizeCommaList(await promptNonEmpty(ask, copy.riskyDomains));
  const architectureSummary = await promptNonEmpty(ask, copy.architectureSummary);
  const importantPaths = normalizeCommaList(await ask(copy.importantPaths));
  const domainTerms = normalizeCommaList(await ask(copy.domainTerms));
  const verificationCommands = normalizeCommaList(
    await promptWithDefault(
      ask,
      copy.verificationCommands,
      defaults.verification_commands?.join(', ') || 'npm test, npm run build',
    ),
  );

  const onboardingContext: ShiftAxOnboardingContextProfile = {
    business_context: businessContext,
    policy_areas: policyAreas,
    architecture_summary: architectureSummary,
    risky_domains: riskyDomains,
  };

  const engineeringDefaults: ShiftAxEngineeringDefaults = {
    ...defaults,
    verification_commands: verificationCommands.length > 0 ? verificationCommands : defaults.verification_commands,
  };

  const writtenDocs = await writeOnboardingDocuments({
    rootDir,
    documents: buildGeneratedDocuments({
      locale,
      businessContext,
      userJourney,
      policyAreas,
      riskyDomains,
      architectureSummary,
      importantPaths,
    }),
  });

  const entries: ShiftAxProjectContextDoc[] = [...writtenDocs];

  if (useDiscovery) {
    const discovered = await discoverBaseContextEntries({ rootDir });
    for (const entry of discovered) {
      if (!entries.some((existing) => existing.label === entry.label && existing.path === entry.path)) {
        entries.push({ label: entry.label, path: entry.path });
      }
    }
  }

  const glossaryEntries: ShiftAxGlossaryEntry[] = [];
  if (domainTerms.length > 0) {
    glossaryEntries.push(
      ...domainTerms.map((term) => ({
        term,
        definition: copy.glossaryDefinition(term),
        sources: ['guided-onboarding'],
      })),
    );
  }

  if (useDiscovery && glossaryEntries.length === 0) {
    glossaryEntries.push(
      ...(await extractDomainGlossaryEntries({
        rootDir,
        documentPaths: entries.map((entry) => entry.path),
      })),
    );
  }

  if (glossaryEntries.length > 0) {
    const glossary = await writeDomainGlossaryDocument({
      rootDir,
      entries: glossaryEntries,
    });
    if (!entries.some((entry) => entry.path === glossary.path)) {
      entries.push({ label: copy.labels.glossary, path: glossary.path });
    }
  }

  const { index, profile } = await persistProjectContextProfile({
    rootDir,
    entries,
    onboardingContext,
    engineeringDefaults,
    now: new Date(),
  });

  return {
    documents: entries,
    index,
    profile,
  };
}
