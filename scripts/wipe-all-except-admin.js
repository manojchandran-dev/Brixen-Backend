// Wipes the whole database for a fresh start, KEEPING ONLY the superadmin
// login(s) (and their sessions) plus the module list the app's menus are
// built from. Every company goes, with its units, logins, permissions and
// all business data.
//
//   node scripts/wipe-all-except-admin.js            # counts only
//   node scripts/wipe-all-except-admin.js --confirm  # deletes (test DB)
//
// Reads DATABASE_URL from the environment or .env. On the production
// database it also needs --production (see scripts/lib/dbGuard.js).
//
// Uses the plain Prisma client (not src/prisma/client.js, whose deletes are
// soft), and runs every delete in one transaction: all or nothing.

const { guardDestructive } = require('./lib/dbGuard');
const { PrismaClient } = require('@prisma/client');

const ADMIN = { OR: [{ user_type: 'superadmin' }, { role: 'super_admin' }] };
const NOT_ADMIN = { NOT: ADMIN };

// Children before parents, so no foreign key blocks a delete.
const STEPS = [
  ['announcement_views', {}],
  ['announcements', {}],
  ['push_notification_recipients', {}],
  ['push_notifications', {}],
  ['notifications', {}],
  ['chat_messages', {}],
  ['chat_conversations', {}],
  ['support_ticket_messages', {}],
  ['support_tickets', {}],
  ['activity_logs', {}],
  ['stock_movements', {}],
  ['purchase_items', {}],
  ['purchases', {}],
  ['sale_items', {}],
  ['sales', {}],
  ['expenses', {}],
  ['product_variants', {}],
  ['expense_categories', {}],
  ['products', {}],
  ['product_categories', {}],
  ['purchase_categories', {}],
  ['customers', {}],
  ['employees', {}],
  ['company_categories', {}],
  ['units', {}],
  ['permissions', {}],
  ['device_tokens', {}],
  ['refresh_tokens', { users: NOT_ADMIN }],
  ['password_resets', { users: NOT_ADMIN }],
  ['users', NOT_ADMIN],
  ['companies', {}],
];

async function main() {
  // Before connecting: names the database and stops a production delete.
  const { confirm } = guardDestructive();

  const prisma = new PrismaClient();
  try {
    const admins = await prisma.users.findMany({ where: ADMIN, select: { email: true } });
    if (!admins.length) {
      console.log('No superadmin login found. Stopping, so you are not locked out.');
      process.exitCode = 1;
      return;
    }
    console.log(`Keeping superadmin login: ${admins.map((a) => a.email).join(', ')}`);
    console.log(`Keeping modules:          ${await prisma.modules.count()}\n`);

    console.log('Will delete:');
    for (const [t, where] of STEPS) console.log(`  ${t.padEnd(30)} ${await prisma[t].count({ where })}`);

    if (!confirm) {
      console.log('\nNothing deleted. Run again with --confirm to delete the rows above.');
      return;
    }
    const [, ...results] = await prisma.$transaction(
      [
        // users.company_id cascades: unlink the admin first, or deleting
        // companies would take the admin login with it.
        prisma.users.updateMany({ where: ADMIN, data: { company_id: null } }),
        ...STEPS.map(([t, where]) => prisma[t].deleteMany({ where })),
      ],
      { timeout: 180000 }
    );
    console.log('\nDeleted:');
    STEPS.forEach(([t], i) => console.log(`  ${t.padEnd(30)} ${results[i].count}`));
    console.log('\nDone. Only the superadmin login and the module list remain.');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
