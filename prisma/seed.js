const bcrypt = require('bcryptjs');
const prisma = require('../src/prisma/client');
const { ADMIN_EMAIL, ADMIN_PASSWORD } = require('../src/config');
const { generateCompanyCode } = require('../src/utils/companyCode');

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
    return;
  }

  const company = await prisma.companies.create({
    data: {
      ...SUPER_ADMIN_COMPANY,
      company_code: generateCompanyCode(),
      onboarding_status: 'completed',
    },
  });

  console.log(`Super admin company created: ${company.company_code} (id: ${company.id})`);
}

async function main() {
  await seedSuperAdminUser();
  await seedSuperAdminCompany();
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
