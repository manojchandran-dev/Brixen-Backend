const prisma = require('../../../prisma/client');

const TYPES = ['text', 'image', 'voice'];
const MAX_LIMIT = 100;

class ChatError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const toMessage = (m) => ({
  id: String(m.id),
  sender_name: m.sender_name,
  is_support: m.is_support,
  type: m.type,
  text: m.text,
  attachment_url: m.attachment_url,
  duration_ms: m.duration_ms,
  sent_at: m.sent_at,
});

async function listConversations() {
  const rows = await prisma.chat_conversations.findMany({
    include: {
      companies: { select: { company_name: true } },
      messages: { orderBy: { id: 'desc' }, take: 1 },
    },
  });

  return rows
    .map((c) => {
      const m = c.messages[0];
      return {
        company_id: c.company_id,
        company_name: c.companies.company_name,
        last_message: m ? { type: m.type, text: m.text, sent_at: m.sent_at } : null,
      };
    })
    .sort((a, b) => new Date(b.last_message?.sent_at ?? 0) - new Date(a.last_message?.sent_at ?? 0));
}

// Oldest-to-newest within the page; `before` is a message id, so the client
// pages backwards through history by passing the first id it already has.
async function getMessages(company_id, { before, limit }) {
  const take = Math.min(Math.max(limit, 1), MAX_LIMIT);
  const conversation = await prisma.chat_conversations.findUnique({ where: { company_id } });
  if (!conversation) return { items: [], meta: { limit: take, has_more: false } };

  const rows = await prisma.chat_messages.findMany({
    where: { conversation_id: conversation.id, ...(before ? { id: { lt: before } } : {}) },
    orderBy: { id: 'desc' },
    take: take + 1,
  });

  return {
    items: rows.slice(0, take).reverse().map(toMessage),
    meta: { limit: take, has_more: rows.length > take },
  };
}

async function sendMessage(company_id, { isSupport, type = 'text', text, attachment_url, duration_ms }) {
  if (!TYPES.includes(type)) throw new ChatError(`type must be one of: ${TYPES.join(', ')}`);

  if (type === 'text') {
    if (typeof text !== 'string' || !text.trim()) throw new ChatError('text is required for text messages');
  } else if (typeof attachment_url !== 'string' || !attachment_url.trim()) {
    throw new ChatError(`attachment_url is required for ${type} messages`);
  }

  if (duration_ms != null && (!Number.isInteger(duration_ms) || duration_ms < 0)) {
    throw new ChatError('duration_ms must be a non-negative integer');
  }

  const company = await prisma.companies.findUnique({ where: { id: company_id } });
  if (!company) throw new ChatError('Company not found', 404);

  // A new message brings a soft-deleted conversation back (history included):
  // company_id is unique, so there can't be a second, fresh one.
  const conversation = await prisma.chat_conversations.upsert({
    where: { company_id },
    update: { deleted_at: null },
    create: { company_id },
  });

  const message = await prisma.chat_messages.create({
    data: {
      conversation_id: conversation.id,
      sender_name: isSupport ? 'Support' : company.company_name,
      is_support: isSupport,
      type,
      text: type === 'text' ? text : (text ?? null),
      attachment_url: type === 'text' ? null : attachment_url,
      duration_ms: type === 'voice' ? (duration_ms ?? null) : null,
    },
  });

  return toMessage(message);
}

// Soft delete / restore, keyed by company like the rest of chat.
async function deleteConversation(company_id) {
  const { count } = await prisma.chat_conversations.updateMany({
    where: { company_id },
    data: { deleted_at: new Date() },
  });
  if (!count) throw new ChatError('Conversation not found', 404);
}

async function restoreConversation(company_id) {
  const { count } = await prisma.chat_conversations.updateMany({
    where: { company_id, deleted_at: { not: null } },
    data: { deleted_at: null },
  });
  if (!count) throw new ChatError('Deleted conversation not found', 404);
}

module.exports = { ChatError, listConversations, getMessages, sendMessage, deleteConversation, restoreConversation };
