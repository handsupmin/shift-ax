import { buildContextBundle, type ShiftAxContextBundle } from '../context/context-bundle.js';

export interface ShiftAxContextHealthReport {
  status: 'ok' | 'warn' | 'critical';
  recommendation: string;
  bundle: ShiftAxContextBundle;
}

export async function assessContextHealth({
  rootDir,
  topicDir,
  query,
  maxChars = 6000,
}: {
  rootDir?: string;
  topicDir?: string;
  query: string;
  maxChars?: number;
}): Promise<ShiftAxContextHealthReport> {
  const bundle = await buildContextBundle({
    ...(rootDir ? { rootDir } : {}),
    ...(topicDir ? { topicDir } : {}),
    query,
    maxChars,
  });

  if (bundle.issues.length > 0) {
    return {
      status: 'critical',
      recommendation:
        'Base-context issues are present. Repair the shared docs or index before trusting this context bundle.',
      bundle,
    };
  }

  const ratio = bundle.total_source_chars / Math.max(maxChars, 1);
  if (bundle.truncated && ratio >= 1.5) {
    return {
      status: 'critical',
      recommendation:
        'The current context is far above the bundle budget. Split the work, pause safely, or build a smaller bundle.',
      bundle,
    };
  }

  if (bundle.truncated || ratio >= 1.0) {
    return {
      status: 'warn',
      recommendation:
        'The current context is approaching the bundle budget. Narrow the query or checkpoint the work soon.',
      bundle,
    };
  }

  return {
    status: 'ok',
    recommendation: 'The current context fits safely inside the bundle budget. Continue working.',
    bundle,
  };
}
