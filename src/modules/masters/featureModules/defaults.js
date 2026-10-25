const prisma = require('../../../prisma/client');
const { generateModuleId } = require('../../../utils/moduleId');

// The app's modules (menu entries / permission rows). Synced on every server
// start and by the seed: missing ones are created, flags kept up to date, so
// a new module (e.g. Purchase Category) appears in Permissions after deploy.
const DEFAULT_MODULES = [
  { name: 'Companies', description: 'All companies', grantable: false },
  { name: 'Notifications', description: 'System & ticket alerts' },
  { name: 'Support Ticket', description: 'Company support requests', always_visible: true },
  { name: 'Chatbot', description: 'Live support chat', always_visible: true },
  { name: 'Permissions', description: 'Access control', grantable: false },
  { name: 'Employees', description: 'Manage staff', visible_to_superadmin: false },
  { name: 'Sales', description: 'Invoices', visible_to_superadmin: false },
  { name: 'Customers', description: 'Customer records', visible_to_superadmin: false },
  { name: 'Expenses', description: 'Track spending', visible_to_superadmin: false },
  { name: 'Products', description: 'Garments catalog', visible_to_superadmin: false },
  { name: 'Purchases', description: 'Supplier bills & stock in', visible_to_superadmin: false },
  {
    name: 'Masters',
    description: 'Categories & units',
    children: [
      { name: 'Company Category', description: 'Company types', grantable: false },
      { name: 'Expense Category', description: 'Spending types', visible_to_superadmin: false },
      { name: 'Units', description: 'Measurement units', visible_to_superadmin: false },
      { name: 'Product Category', description: 'Garments categories', visible_to_superadmin: false },
      { name: 'Purchase Category', description: 'Raw materials bought', visible_to_superadmin: false },
    ],
  },
];

const flagsOf = (m) => ({
  visible_to_superadmin: m.visible_to_superadmin ?? true,
  always_visible: m.always_visible ?? false,
  grantable: m.grantable ?? true,
});

async function syncFlags(existing, def) {
  const flags = flagsOf(def);
  const stale = Object.keys(flags).some((k) => existing[k] !== flags[k]);
  if (stale) await prisma.modules.update({ where: { id: existing.id }, data: flags });
  return stale;
}

async function seedModules() {
  let created = 0;
  let updated = 0;

  for (const mod of DEFAULT_MODULES) {
    const { children, ...moduleData } = mod;

    let existing = await prisma.modules.findFirst({ where: { name: moduleData.name, parent_id: null } });
    if (!existing) {
      existing = await prisma.modules.create({ data: { ...moduleData, id: generateModuleId() } });
      created += 1;
    } else if (await syncFlags(existing, moduleData)) {
      updated += 1;
    }

    for (const child of children || []) {
      const existingChild = await prisma.modules.findFirst({ where: { name: child.name, parent_id: existing.id } });
      if (!existingChild) {
        await prisma.modules.create({ data: { ...child, id: generateModuleId(), parent_id: existing.id } });
        created += 1;
      } else if (await syncFlags(existingChild, child)) {
        updated += 1;
      }
    }
  }

  console.log(`Modules seeded: ${created} created, ${updated} updated`);
}

module.exports = { DEFAULT_MODULES, syncDefaultModules: seedModules };
