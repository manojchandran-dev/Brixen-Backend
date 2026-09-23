const messaging = require('../../../config/firebase');

const BATCH_SIZE = 500; // FCM's per-call limit for sendEachForMulticast

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// Sends to every token and returns one result per token, in the same order,
// as { token, success, error? } -- lets the caller update per-recipient state.
async function sendToTokens(tokens, { title, body }) {
  const results = [];

  for (const batch of chunk(tokens, BATCH_SIZE)) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
    });

    response.responses.forEach((r, i) => {
      results.push({
        token: batch[i],
        success: r.success,
        error: r.success ? null : r.error?.code || r.error?.message || 'unknown error',
      });
    });
  }

  return results;
}

module.exports = { sendToTokens };
