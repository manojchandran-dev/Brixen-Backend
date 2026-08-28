const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma/client');
const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('../src/config');
const { generateCompanyCode } = require('../src/utils/companyCode');
const { generateUnitId } = require('../src/utils/unitId');

const DEFAULT_UNITS = [
  { unit: 'pcs', full_form: 'Pieces', description: 'Used to measure individual items or products.' },
  { unit: 'nos', full_form: 'Numbers', description: 'Used to count individual units, animals, or general items.' },
  { unit: 'dozen', full_form: '12 Pieces', description: 'Used when products are sold or purchased in quantities of 12.' },
  { unit: 'set', full_form: 'Set', description: 'Used when multiple related items are sold together as one set.' },
  { unit: 'pair', full_form: 'Pair', description: 'Used for items that naturally come as two pieces.' },
  { unit: 'pack', full_form: 'Pack', description: 'Used when multiple items are grouped and sold together.' },
  { unit: 'box', full_form: 'Box', description: 'Used for products sold or stored in boxes.' },
  { unit: 'kg', full_form: 'Kilogram', description: 'Used to measure weight of products, food, feed, materials, etc.' },
  { unit: 'g', full_form: 'Gram', description: 'Used for smaller quantities measured by weight.' },
  { unit: 'mg', full_form: 'Milligram', description: 'Used for very small quantities, medicines, supplements, etc.' },
  { unit: 'ton', full_form: 'Tonne', description: 'Used for large quantities of heavy materials or bulk goods.' },
  { unit: 'ml', full_form: 'Millilitre', description: 'Used to measure small quantities of liquids.' },
  { unit: 'L', full_form: 'Litre', description: 'Used to measure larger quantities of liquids such as milk, oil, and beverages.' },
  { unit: 'm', full_form: 'Metre', description: 'Used to measure length, fabric, cables, and other materials.' },
  { unit: 'cm', full_form: 'Centimetre', description: 'Used for smaller length or product dimensions.' },
  { unit: 'inch', full_form: 'Inch', description: 'Used for product dimensions, garments, screens, pipes, etc.' },
  { unit: 'bag', full_form: 'Bag', description: 'Used for products packaged or sold in bags, such as rice or cattle feed.' },
  { unit: 'bottle', full_form: 'Bottle', description: 'Used for liquids or products sold in bottles.' },
  { unit: 'can', full_form: 'Can', description: 'Used for liquids or products sold in cans/containers.' },
  { unit: 'bundle', full_form: 'Bundle', description: 'Used for multiple items grouped and sold together as a bundle.' },
];

const SUPER_ADMIN_COMPANY = {
  company_name: 'Manoj',
  owner_name: 'Manoj',
  phone: '8190098951',
  email: 'manojchandran11299@gmail.com',
  gst_number: 'Update Later',
  address: 'Update Later',
  city: 'Update Later',
  state: 'Update Later',
  pincode: '000000',
  industry_type: 'Update Later',
  entity_type: 'Update Later',
  pan_card: 'TBD',
  employee_count: 'Update Later',
  founded_year: new Date().getFullYear(),
  secondary_email: 'Update Later',
  website: 'Update Later',
};

async function seedSuperAdminUser() {
  if (!ADMIN_EMAIL || !ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be set in .env before seeding');
  }

  const existing = await prisma.users.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`Super admin already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const password_hash = await bcrypt.hash(ADMIN_PASSWORD, 10);
  const user = await prisma.users.create({
    data: {
      email: ADMIN_EMAIL,
      password_hash,
      role: 'super_admin',
    },
  });

  console.log(`Super admin created: ${user.email} (id: ${user.id})`);
}

async function seedSuperAdminCompany() {
  const existing = await prisma.companies.findFirst({
    where: { email: SUPER_ADMIN_COMPANY.email },
  });

  if (existing) {
    console.log(`Super admin company already exists: ${existing.company_code}`);
    return existing.id;
  }

  const company = await prisma.companies.create({
    data: {
      ...SUPER_ADMIN_COMPANY,
      company_code: generateCompanyCode(),
      onboarding_status: 'completed',
    },
  });

  console.log(`Super admin company created: ${company.company_code} (id: ${company.id})`);
  return company.id;
}

async function seedUnits(company_id) {
  let created = 0;
  let skipped = 0;

  for (const unit of DEFAULT_UNITS) {
    const existing = await prisma.units.findFirst({ where: { unit: unit.unit, company_id } });
    if (existing) {
      skipped += 1;
      continue;
    }

    await prisma.units.create({ data: { ...unit, id: generateUnitId(), company_id } });
    created += 1;
  }

  console.log(`Units seeded: ${created} created, ${skipped} already existed`);
}

async function main() {
  await seedSuperAdminUser();
  const company_id = await seedSuperAdminCompany();
  await seedUnits(company_id);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
