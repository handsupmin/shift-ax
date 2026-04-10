import type { ShiftAxBootstrapAsset } from './index.js';

export const SHIFT_AX_PRODUCT_SHELL_COMMANDS = [
  'onboard',
  'request',
  'export-context',
  'doctor',
  'status',
  'topics',
  'resume',
  'review',
] as const;

export type ShiftAxProductShellCommand =
  (typeof SHIFT_AX_PRODUCT_SHELL_COMMANDS)[number];

export function buildProductShellAssets({
  platform,
  commandBasePath,
  renderTemplate,
}: {
  platform: 'codex' | 'claude-code';
  commandBasePath: string;
  renderTemplate: (name: ShiftAxProductShellCommand) => string;
}): ShiftAxBootstrapAsset[] {
  return SHIFT_AX_PRODUCT_SHELL_COMMANDS.map((name) => ({
    path: `${commandBasePath}/${name}.md`,
    description: `Shift AX ${platform === 'codex' ? 'Codex' : 'Claude Code'} product-shell command: ${platform === 'codex' ? '$' : '/'}${name}`,
    content: renderTemplate(name),
  }));
}
