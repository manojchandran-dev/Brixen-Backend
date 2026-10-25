// Deletes one company's business data, for a fresh start. KEEPS the
// company itself, its units, its logins (users, refresh tokens, device
// tokens) and its permissions. Other companies are not touched.
//
//   node scripts/reset-business-data.js --company "MJP Tex"            # counts only
//   node scripts/reset-business-data.js --company "MJP Tex" --confirm  # deletes (test DB)
//
// Reads DATABASE_URL from the environment or .env. On the production
// database it also needs --production (see scripts/lib/dbGuard.js).
//
// --company takes the company name (any case) or its company code. Uses the
// plain Prisma client (not src/prisma/client.js, whose deletes are soft),
// and runs every delete in one transaction: all or nothing.

const { guardDestructive } = require('./lib/dbGuard');
const { PrismaClient } = require('@prisma/client');

// Children before parents, so no foreign key blocks a delete. Child rows
// whose own company_id may be blank are also matched through their parent.
const scoped = (id) => [
  ['announcement_views', { company_id: id }],
  ['push_notification_recipients', { company_id: id }],
  ['notifications', { company_id: id }],
  ['chat_messages', { OR: [{ company_id: id }, { chat_conversations: { company_id: id } }] }],
  ['chat_conversations', { company_id: id }],
  ['support_ticket_messages', { OR: [{ company_id: id }, { support_tickets: { company_id: id } }] }],
  ['support_tickets', { company_id: id }],
  ['activity_logs', { company_id: id }],
  ['stock_movements', { company_id: id }],
  ['purchase_items', { OR: [{ company_id: id }, { purchases: { company_id: id } }] }],
  ['purchases', { company_id: id }],
  ['sale_items', { OR: [{ company_id: id }, { sales: { company_id: id } }] }],
  ['sales', { company_id: id }],
  ['expenses', { company_id: id }],
  ['product_variants', { company_id: id }],
  ['expense_categories', { company_id: id }],
  ['products', { company_id: id }],
  ['product_categories', { company_id: id }],
  ['purchase_categories', { company_id: id }],
  ['customers', { company_id: id }],
  ['employees', { company_id: id }],
  ['company_categories', { company_id: id }],
];

const KEPT = ['units', 'users', 'permissions', 'device_tokens'];

function arg(name) {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
  const wanted = arg('--company')?.trim();
  if (!wanted) throw new Error('Pass --company "<company name or code>"');
  // Before connecting: names the database and stops a production delete.
  const { confirm } = guardDestructive();

  const prisma = new PrismaClient();
  try {
    const matches = await prisma.companies.findMany({
      where: {
        OR: [
          { company_name: { equals: wanted, mode: 'insensitive' } },
          { company_code: { equals: wanted, mode: 'insensitive' } },
        ],
      },
      select: { id: true, company_name: true, company_code: true },
    });
    if (matches.length !== 1) {
      const similar = await prisma.companies.findMany({
        where: { company_name: { contains: wanted.split(/\s+/)[0], mode: 'insensitive' } },
        select: { company_name: true, company_code: true },
      });
      console.log(
        matches.length
          ? `\n"${wanted}" matches ${matches.length} companies — use the company code instead:`
          : `\nNo company named or coded "${wanted}". Similar names:`
      );
      for (const c of matches.length ? matches : similar) console.log(`  ${c.company_name}  (${c.company_code})`);
      process.exitCode = 1;
      return;
    }
    const company = matches[0];
    console.log(`Company:  ${company.company_name} (${company.company_code}, id ${company.id})\n`);

    const tables = scoped(company.id);
    console.log('Will delete:');
    for (const [t, where] of tables) console.log(`  ${t.padEnd(30)} ${await prisma[t].count({ where })}`);
    console.log('\nKept:');
    for (const t of KEPT) console.log(`  ${t.padEnd(30)} ${await prisma[t].count({ where: { company_id: company.id } })}`);

    if (!confirm) {
      console.log('\nNothing deleted. Run again with --confirm to delete the rows above.');
      return;
    }
    const results = await prisma.$transaction(
      tables.map(([t, where]) => prisma[t].deleteMany({ where })),
      { timeout: 120000 }
    );
    console.log('\nDeleted:');
    tables.forEach(([t], i) => console.log(`  ${t.padEnd(30)} ${results[i].count}`));
    console.log(`\nDone. ${company.company_name}, its units, logins and permissions are untouched.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
