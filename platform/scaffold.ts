import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';

import { getPlatformBootstrapAssets } from './index.js';

export interface ScaffoldPlatformBuildInput {
  platform: 'codex' | 'claude-code';
  rootDir: string;
}

export interface ScaffoldPlatformBuildResult {
  platform: 'codex' | 'claude-code';
  rootDir: string;
  written: string[];
}

export async function scaffoldPlatformBuild({
  platform,
  rootDir,
}: ScaffoldPlatformBuildInput): Promise<ScaffoldPlatformBuildResult> {
  const assets = getPlatformBootstrapAssets(platform, rootDir);

  await Promise.all(
    assets.map(async (asset) => {
      const absolutePath = join(rootDir, asset.path);
      await mkdir(dirname(absolutePath), { recursive: true });
      await writeFile(absolutePath, asset.content, 'utf8');
    }),
  );

  return {
    platform,
    rootDir,
    written: assets.map((asset) => asset.path),
  };
}
