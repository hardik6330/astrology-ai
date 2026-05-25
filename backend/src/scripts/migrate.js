#!/usr/bin/env node
// Tiny CLI wrapper around umzug. Supported commands:
//   node src/scripts/migrate.js up     — run pending migrations
//   node src/scripts/migrate.js down   — rollback the last migration
//   node src/scripts/migrate.js status — show executed vs pending

import { umzug } from '../config/umzug.js';

const cmd = process.argv[2] || 'up';

try {
  if (cmd === 'up') {
    const ran = await umzug.up();
    console.log(`✓ ${ran.length} migration(s) applied.`);
  } else if (cmd === 'down') {
    const reverted = await umzug.down();
    console.log(`✓ ${reverted.length} migration(s) reverted.`);
  } else if (cmd === 'status') {
    const exec = await umzug.executed();
    const pend = await umzug.pending();
    console.log('Executed:');  exec.forEach((m) => console.log('  ✓', m.name));
    console.log('Pending:');   pend.forEach((m) => console.log('  …', m.name));
  } else {
    console.error(`Unknown command: ${cmd}. Use: up | down | status`);
    process.exit(1);
  }
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
