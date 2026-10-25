// Safety guard shared by the destructive scripts in scripts/. Works out
// whether DATABASE_URL is the test or the production database and refuses
// to delete from production unless --production is passed as well.
//
// Production when either:
//   - the URL contains PRODUCTION_DB_ENDPOINT (the prod Neon endpoint ID,
//     e.g. "ep-little-lake-ai56mbdn"; matches its pooled and direct hosts), or
//   - DB_ENV is anything but "test" (unset counts as production).
// So a fresh or half-configured .env is treated as production by default.

require('dotenv').config();

function databaseTarget() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Set DATABASE_URL first');
  // Host only — never print the user or password.
  const host = url.replace(/^.*@/, '').replace(/[/?].*$/, '');
  const endpoint = (process.env.PRODUCTION_DB_ENDPOINT || '').trim();
  const dbEnv = (process.env.DB_ENV || '').trim().toLowerCase();

  let production = false;
  let why = 'DB_ENV=test';
  if (endpoint && host.includes(endpoint)) {
    production = true;
    why = 'host matches PRODUCTION_DB_ENDPOINT';
  } else if (dbEnv !== 'test') {
    production = true;
    why = dbEnv ? `DB_ENV=${dbEnv}` : 'DB_ENV is not set';
  }
  return { host, production, why, endpointSet: Boolean(endpoint) };
}

// Prints which database this is; with --confirm on production and no
// --production flag, stops before anything is deleted.
function guardDestructive() {
  const confirm = process.argv.includes('--confirm');
  const allowProduction = process.argv.includes('--production');
  const t = databaseTarget();

  console.log(`Database: ${t.host}`);
  console.log(`Environment: ${t.production ? 'PRODUCTION' : 'test'} (${t.why})`);
  if (!t.endpointSet) {
    console.log('Warning: PRODUCTION_DB_ENDPOINT is not set, so the production host is not recognised by name.');
  }
  console.log('');

  if (confirm && t.production && !allowProduction) {
    console.log('Refusing to delete from the PRODUCTION database.');
    console.log('If you really mean it, run again with both --confirm and --production.');
    process.exit(1);
  }
  return { ...t, confirm };
}

module.exports = { databaseTarget, guardDestructive };
