import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline/promises';
import { stdin, stdout } from 'node:process';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { constants } from 'node:fs';
import { dirname, join } from 'node:path';

import { getPlatformBootstrapAssets } from '../../platform/index.js';
import { readProjectProfile } from '../policies/project-profile.js';
import {
  readProjectSettings,
  writeProjectSettings,
  type ShiftAxLocale,
  type ShiftAxProjectSettings,
} from '../settings/project-settings.js';
import { runGuidedOnboarding } from '../context/guided-onboarding.js';
import type { ShiftAxPlatform } from '../../adapters/contracts.js';

const SHELL_COPY = {
  en: {
    chooseLanguage: 'Choose language / 언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
    choosePlatform: 'Choose platform:\n1. Codex (default)\n2. Claude Code\n> ',
    welcomeCodex:
      'Start Shift AX shell mode for this repository. Be conversational. Treat `/onboard`, `/doctor`, `/request <text>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` and the same `$...` aliases as Shift AX product-shell commands. Keep docs-first behavior, and if the user speaks naturally, map that intent to the right Shift AX flow without forcing raw CLI syntax.',
    welcomeClaude:
      'Start Shift AX shell mode for this repository. Be conversational. Treat `/onboard`, `/doctor`, `/request <text>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` and the same `$...` aliases as Shift AX product-shell commands. Keep docs-first behavior, and if the user speaks naturally, map that intent to the right Shift AX flow without forcing raw CLI syntax.',
  },
  ko: {
    chooseLanguage: '언어를 선택하세요:\n1. English (default)\n2. Korean\n> ',
    choosePlatform: '플랫폼을 선택하세요:\n1. Codex (default)\n2. Claude Code\n> ',
    welcomeCodex:
      '이 저장소에서 Shift AX 셸 모드로 시작하세요. 대화형으로 동작하세요. `/onboard`, `/doctor`, `/request <요청>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` 와 같은 slash 명령과 동일한 `$...` 명령을 Shift AX 제품 셸 명령으로 해석하세요. docs-first 원칙을 지키고, 사용자가 자연어로 말하면 원시 CLI 문법을 강요하지 말고 적절한 Shift AX 흐름으로 연결하세요.',
    welcomeClaude:
      '이 저장소에서 Shift AX 셸 모드로 시작하세요. 대화형으로 동작하세요. `/onboard`, `/doctor`, `/request <요청>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>`, `/help` 와 같은 slash 명령과 동일한 `$...` 명령을 Shift AX 제품 셸 명령으로 해석하세요. docs-first 원칙을 지키고, 사용자가 자연어로 말하면 원시 CLI 문법을 강요하지 말고 적절한 Shift AX 흐름으로 연결하세요.',
  },
} as const;

async function pathExists(path: string): Promise<boolean> {
  try {
    await access(path, constants.F_OK);
    return true;
  } catch {
    return false;
  }
}

export async function isProjectOnboarded(rootDir: string): Promise<boolean> {
  return (
    (await pathExists(`${rootDir}/docs/base-context/index.md`)) &&
    (await readProjectProfile(rootDir)) !== null
  );
}

async function promptChoice(
  question: string,
  options: Record<string, string>,
  fallback: string,
): Promise<string> {
  if (!stdin.isTTY) {
    return fallback;
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    const answer = (await rl.question(question)).trim();
    return options[answer] || fallback;
  } finally {
    rl.close();
  }
}

export async function resolveShellLocale({
  rootDir,
  requestedLocale,
}: {
  rootDir: string;
  requestedLocale?: ShiftAxLocale;
}): Promise<ShiftAxLocale> {
  if (requestedLocale) return requestedLocale;
  const settings = await readProjectSettings(rootDir);
  if (settings?.locale) return settings.locale;

  return (await promptChoice(SHELL_COPY.en.chooseLanguage, { '1': 'en', '2': 'ko' }, 'en')) as ShiftAxLocale;
}

export async function resolveShellPlatform({
  rootDir,
  requestedPlatform,
  locale,
}: {
  rootDir: string;
  requestedPlatform?: ShiftAxPlatform;
  locale: ShiftAxLocale;
}): Promise<ShiftAxPlatform> {
  if (requestedPlatform) return requestedPlatform;
  const settings = await readProjectSettings(rootDir);
  if (settings?.preferred_platform) return settings.preferred_platform;

  return (await promptChoice(
    SHELL_COPY[locale].choosePlatform,
    { '1': 'codex', '2': 'claude-code' },
    'codex',
  )) as ShiftAxPlatform;
}

export async function ensureShellOnboarding({
  rootDir,
  locale,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
}): Promise<void> {
  if (await isProjectOnboarded(rootDir)) return;

  if (!stdin.isTTY) {
    throw new Error('Interactive onboarding requires a TTY. Provide onboarding input or run in a terminal.');
  }

  const rl = createInterface({ input: stdin, output: stdout });
  try {
    await runGuidedOnboarding({
      rootDir,
      locale,
      ask: (question) => rl.question(question),
    });
  } finally {
    rl.close();
  }
}

export async function persistShellSettings({
  rootDir,
  locale,
  platform,
}: {
  rootDir: string;
  locale: ShiftAxLocale;
  platform: ShiftAxPlatform;
}): Promise<void> {
  const existing = (await readProjectSettings(rootDir)) as ShiftAxProjectSettings | null;
  await writeProjectSettings({
    rootDir,
    settings: {
      ...(existing ?? {}),
      version: 1,
      updated_at: new Date().toISOString(),
      locale,
      preferred_platform: platform,
    },
  });
}

export async function launchPlatformShell({
  rootDir,
  platform,
  locale,
  initialPrompt,
  onboardingRequired = false,
}: {
  rootDir: string;
  platform: ShiftAxPlatform;
  locale?: ShiftAxLocale;
  initialPrompt?: string;
  onboardingRequired?: boolean;
}): Promise<number> {
  await ensurePlatformShellAssets({ platform, rootDir });

  const promptBase = onboardingRequired
    ? buildInShellOnboardingPrompt({
        rootDir,
        platform,
        ...(locale ? { locale } : {}),
      })
    : platform === 'codex'
      ? SHELL_COPY[locale ?? 'en'].welcomeCodex
      : SHELL_COPY[locale ?? 'en'].welcomeClaude;
  const prompt = [promptBase, initialPrompt?.trim()].filter(Boolean).join('\n\n');

  const child =
    platform === 'codex'
      ? spawn('codex', ['-C', rootDir, prompt], { stdio: 'inherit' })
      : spawn('claude', [prompt], { cwd: rootDir, stdio: 'inherit' });

  return await new Promise<number>((resolve, reject) => {
    child.on('error', reject);
    child.on('exit', (code) => resolve(code ?? 0));
  });
}

function buildInShellOnboardingPrompt({
  rootDir,
  platform,
  locale,
}: {
  rootDir: string;
  platform: ShiftAxPlatform;
  locale?: ShiftAxLocale;
}): string {
  const platformHint = platform === 'codex' ? 'codex' : 'claude-code';
  const onboardingCommand = `ax onboard-context --root ${shellQuote(rootDir)} --input .ax/onboarding-input.json --platform ${platformHint}${locale ? ` --lang ${locale}` : ''}`;

  if (locale === 'ko') {
    return [
      '이 저장소는 아직 Shift AX 온보딩이 끝나지 않았습니다.',
      '지금부터 온보딩을 **이 대화 안에서** 진행하세요. 별도의 ax readline 인터뷰로 되돌아가지 마세요.',
      '사용자에게 먼저 언어를 다시 묻지 말고, 지금부터 한국어로 온보딩을 진행하세요.',
      '필수 수집 항목:',
      '- business context',
      '- primary workflow',
      '- no-guessing policy areas',
      '- risky domains',
      '- architecture summary',
      '- important paths',
      '- internal terms / aliases',
      '- default verification commands',
      '모든 답변을 모은 뒤 `.ax/onboarding-input.json` 파일을 만들고 아래 명령으로 저장하세요:',
      onboardingCommand,
      '온보딩이 끝나면 docs-first 원칙을 지키면서 일반 Shift AX product-shell 세션처럼 계속 진행하세요.',
      '셸 안에서는 `/onboard`, `/doctor`, `/request <요청>`, `/status`, `/topics`, `/resume <topic>`, `/review <topic>` 와 같은 slash 명령과 동일한 `$...` alias를 Shift AX 제품 명령으로 해석하세요.',
    ].join('\n');
  }

  return [
    'This repository is not onboarded for Shift AX yet.',
    'Handle onboarding **inside this platform session**. Do not hand control back to an external ax readline questionnaire.',
    locale
      ? `Do not ask for language again. Continue onboarding in ${locale === 'en' ? 'English' : 'Korean'}.`
      : 'Your first question must be language selection: `1. English (default)` or `2. Korean`. Then continue the rest of onboarding in the chosen language.',
    'Required onboarding fields:',
    '- business context',
    '- primary workflow',
    '- no-guessing policy areas',
    '- risky domains',
    '- architecture summary',
    '- important paths',
    '- internal terms / aliases',
    '- default verification commands',
    'After collecting the answers, create `.ax/onboarding-input.json` and persist onboarding with:',
    onboardingCommand,
    'Then continue as a normal Shift AX product-shell session with docs-first behavior.',
    'Inside the shell, interpret `/onboard`, `/doctor`, `/request <text>`, `/status`, `/topics`, `/resume <topic>`, and `/review <topic>` plus the same `$...` aliases as Shift AX product-shell commands.',
  ].join('\n');
}

function shellQuote(value: string): string {
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

async function ensurePlatformShellAssets({
  platform,
  rootDir,
}: {
  platform: ShiftAxPlatform;
  rootDir: string;
}): Promise<void> {
  const assets = getPlatformBootstrapAssets(platform, rootDir);

  await Promise.all(
    assets.map(async (asset) => {
      const absolutePath = join(rootDir, asset.path);
      const current = await readFile(absolutePath, 'utf8').catch(() => '');
      const isTopLevelBootstrap = asset.path === 'AGENTS.md' || asset.path === 'CLAUDE.md';
      if (isTopLevelBootstrap && current.trim() && !current.includes('Shift AX')) {
        return;
      }
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, asset.content, 'utf8');
    }),
  );
}
