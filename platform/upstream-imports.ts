import { readFileSync } from 'node:fs';

import type { ShiftAxImportedUpstreamSlice } from '../adapters/contracts.js';

export function readImportedUpstreamSlice(provenancePath: string): ShiftAxImportedUpstreamSlice {
  const raw = readFileSync(provenancePath, 'utf8');
  return JSON.parse(raw) as ShiftAxImportedUpstreamSlice;
}
