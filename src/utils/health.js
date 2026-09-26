const { getApps } = require('firebase-admin/app');
require('../config/firebase'); // initialises firebase-admin when credentials are set
const prisma = require('../prisma/client');
const cloudinary = require('../config/cloudinary');
const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = require('../config');

const TIMEOUT_MS = 2000;
const SLOW_MS = 1000;
const CACHE_MS = 30000;

const timeout = (ms) => new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), ms));

// Runs one check with a timeout; never throws. ok / slow (took > SLOW_MS) / down.
async function probe(fn) {
  const started = Date.now();
  try {
    await Promise.race([fn(), timeout(TIMEOUT_MS)]);
    const latency_ms = Date.now() - started;
    return { status: latency_ms > SLOW_MS ? 'slow' : 'ok', latency_ms };
  } catch (err) {
    // Short, safe message only -- this is also served on the public /api/health.
    return { status: 'down', error: err.message === 'timeout' ? 'timeout' : String(err.message).split('\n')[0].slice(0, 120) };
  }
}

const checks = {
  database: () => probe(() => prisma.$queryRaw`SELECT 1`),
  // firebase-admin initialises (config/firebase.js) only when the credentials
  // are present and load; no push is sent.
  fcm: async () => (getApps().length ? { status: 'ok' } : { status: 'down', error: 'not configured' }),
  storage: () =>
    CLOUDINARY_CLOUD_NAME && CLOUDINARY_API_KEY && CLOUDINARY_API_SECRET
      ? probe(() => cloudinary.api.ping())
      : { status: 'down', error: 'not configured' },
};

// ponytail: in-memory, per server instance. Served from cache and refreshed
// in the background once older than CACHE_MS (stale-while-revalidate), so no
// request waits on the probes and SELECT 1 never queues behind the
// dashboard's own queries. No timer: that would keep Neon from ever sleeping.
let cached = null;
let refreshing = null;

function refresh() {
  refreshing ??= Promise.all([checks.database(), checks.fcm(), checks.storage()])
    .then(([database, fcm, storage]) => {
      cached = { at: Date.now(), value: { database, fcm, storage } };
      return cached.value;
    })
    .finally(() => {
      refreshing = null;
    });
  return refreshing;
}

// { database, fcm, storage } -- each probe runs in parallel, capped at TIMEOUT_MS.
async function dependencyHealth() {
  if (!cached) return refresh();
  if (Date.now() - cached.at > CACHE_MS) refresh().catch(() => {});
  return cached.value;
}

// Full health block; `startedAt` is when the request began, for the api latency.
async function healthReport(startedAt) {
  const deps = await dependencyHealth();
  return { api: { status: 'ok', latency_ms: Date.now() - startedAt }, ...deps };
}

// Opens the DB connection first, so its one-off setup isn't counted as latency.
const warmHealth = () => prisma.$connect().then(refresh).catch(() => {});

module.exports = { healthReport, warmHealth };
