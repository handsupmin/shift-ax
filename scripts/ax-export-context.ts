#!/usr/bin/env node

import { getGlobalContextHome } from '../core/settings/global-context-home.js';

const home = getGlobalContextHome();

process.stdout.write(
  JSON.stringify(
    {
      share_root: home.root,
      index_path: home.indexPath,
      message: `Share ${home.root} with teammates who do similar work and tell them to place it at the same location on their machine.`,
    },
    null,
    2,
  ) + '\n',
);
