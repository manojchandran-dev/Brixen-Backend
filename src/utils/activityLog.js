const prisma = require('../prisma/client');

// Records an event for the superadmin dashboard's "Recent activity".
// Best-effort: a failed log write is reported, never thrown, so it can't
// break the action being recorded.
//
// types: company_created, company_suspended, employee_created, admin_login,
//        ticket_created, notification_sent
async function logActivity({ type, title, detail = null, ref_id = null, actor_user_id = null, company_id = null }) {
  try {
    await prisma.activity_logs.create({
      data: {
        type,
        title,
        detail: detail ? String(detail).slice(0, 300) : null,
        ref_id: ref_id == null ? null : String(ref_id),
        actor_user_id,
        company_id,
      },
    });
  } catch (err) {
    console.error(`activity log (${type}) failed:`, err.message);
  }
}

module.exports = { logActivity };
