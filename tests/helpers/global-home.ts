import { mkdtemp } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

export async function withTempGlobalHome<T>(prefix: string, fn: (home: string) => Promise<T>): Promise<T> {
  const previous = process.env.SHIFT_AX_HOME;
  const home = await mkdtemp(join(tmpdir(), prefix));
  process.env.SHIFT_AX_HOME = home;
  try {
    return await fn(home);
  } finally {
    if (previous === undefined) {
      delete process.env.SHIFT_AX_HOME;
    } else {
      process.env.SHIFT_AX_HOME = previous;
    }
  }
}
