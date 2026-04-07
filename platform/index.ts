export interface ShiftAxBootstrapAsset {
  path: string;
  description: string;
  content: string;
}
export {
  codexScaffoldTemplateFiles,
  getCodexBootstrapAssets,
  renderCodexAgentsBootstrap,
} from './codex/bootstrap.js';
export {
  claudeCodeScaffoldTemplateFiles,
  getClaudeCodeBootstrapAssets,
  renderClaudeCodeSessionStartContext,
} from './claude-code/bootstrap.js';

import { getClaudeCodeBootstrapAssets } from './claude-code/bootstrap.js';
import { getCodexBootstrapAssets } from './codex/bootstrap.js';

export function getPlatformBootstrapAssets(
  platform: 'codex' | 'claude-code',
  rootDir: string,
): ShiftAxBootstrapAsset[] {
  if (platform === 'codex') {
    return getCodexBootstrapAssets(rootDir);
  }

  return getClaudeCodeBootstrapAssets(rootDir);
}
