import {
  buildContextBundle,
  classifyContextBundle,
  type ShiftAxContextBundle,
} from '../context/context-bundle.js';

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
  const classification = classifyContextBundle(bundle);
  return {
    status: classification.status,
    recommendation: classification.recommendation,
    bundle,
  };
}
