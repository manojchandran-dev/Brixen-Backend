const messaging = require('../../../config/firebase');

const BATCH_SIZE = 500; // FCM's per-call limit for sendEachForMulticast

function chunk(items, size) {
  const chunks = [];
  for (let i = 0; i < items.length; i += size) {
    chunks.push(items.slice(i, i + size));
  }
  return chunks;
}

// App priority -> delivery settings. Channel ids must match the channels the
// Flutter app creates (push_token_service.dart): the high one is heads-up.
function deliveryOptions(priority) {
  const high = priority !== 'normal'; // important, urgent (and legacy "high")
  return {
    android: {
      priority: high ? 'high' : 'normal',
      notification: { channelId: high ? 'brixen_push' : 'brixen_push_normal' },
    },
    apns: { headers: { 'apns-priority': high ? '10' : '5' } },
  };
}

// Sends to every token and returns one result per token, in the same order,
// as { token, success, error? } -- lets the caller update per-recipient state.
// `data` values must all be strings (FCM rejects anything else).
async function sendToTokens(tokens, { title, body, priority, data }) {
  const results = [];

  for (const batch of chunk(tokens, BATCH_SIZE)) {
    const response = await messaging.sendEachForMulticast({
      tokens: batch,
      notification: { title, body },
      data,
      ...deliveryOptions(priority),
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
