#!/usr/bin/env node

import { consolidateMemory } from '../core/memory/consolidation.js';

const rootDir = process.argv.includes('--root')
  ? process.argv[process.argv.indexOf('--root') + 1]
  : process.cwd();

const result = await consolidateMemory({ rootDir });
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
