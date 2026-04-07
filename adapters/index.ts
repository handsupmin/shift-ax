import type { ShiftAxPlatform, ShiftAxPlatformAdapter } from './contracts.js';
import { claudeCodeAdapter } from './claude-code/adapter.js';
import { codexAdapter } from './codex/adapter.js';

const ADAPTERS: Record<ShiftAxPlatform, ShiftAxPlatformAdapter> = {
  codex: codexAdapter,
  'claude-code': claudeCodeAdapter,
};

export function listPlatformAdapters(): ShiftAxPlatformAdapter[] {
  return Object.values(ADAPTERS);
}

export function getPlatformAdapter(
  platform: ShiftAxPlatform,
): ShiftAxPlatformAdapter {
  return ADAPTERS[platform];
}
