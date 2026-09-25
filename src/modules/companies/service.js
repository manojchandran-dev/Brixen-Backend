const { Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const companyRepository = require('./repository');
const { users: userRepository, refreshTokens: refreshTokenRepository } = require('../auth/repository');
const { generateCompanyCode } = require('../../utils/companyCode');
const { generateTempPassword } = require('../../utils/tempPassword');
const { sendWelcomeEmail, sendDeactivationEmail } = require('../../utils/mailer');

const STEP2_FIELDS = ['owner_name', 'email', 'phone', 'secondary_email', 'website'];
const STEP3_FIELDS = ['address', 'city', 'state', 'pincode'];

const MAX_CODE_ATTEMPTS = 5;

// Columns create and PUT /:id may set. Anything else in the body (id, codes,
// password, status -- which goes through PUT /:id/status so the login user
// gets created) is ignored instead of reaching Prisma and failing.
const EDITABLE_FIELDS = [
  'company_name', 'owner_name', 'phone', 'email', 'secondary_email', 'website',
  'gst_number', 'pan_card', 'entity_type', 'employee_count', 'founded_year',
  'industry_type', 'subscription_plan', 'address', 'city', 'state', 'pincode', 'country',
  'company_category_id', 'company_category_name', 'logo_url', 'gallery_urls',
];

const pickEditable = (data) =>
  Object.fromEntries(EDITABLE_FIELDS.filter((f) => data[f] !== undefined).map((f) => [f, data[f]]));

class CompanyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isStepComplete(company, fields) {
  return fields.every((field) => company[field] !== null && company[field] !== undefined && company[field] !== '');
}

function computeOnboardingStatus(company) {
  const step2Done = isStepComplete(company, ['owner_name', 'email']);
  const step3Done = isStepComplete(company, STEP3_FIELDS);
  return step2Done && step3Done ? 'completed' : 'pending';
}

async function recomputeOnboardingStatus(id) {
  const company = await companyRepository.findById(id);
  const onboarding_status = computeOnboardingStatus(company);

  if (company.onboarding_status === onboarding_status) {
    return company;
  }

  return companyRepository.update(id, { onboarding_status });
}

// Company name and GST number must be unique across companies, compared
// case-insensitively and ignoring surrounding spaces. On update, pass the
// `current` company: only a value that's actually changing is checked, so
// re-saving a company (even one that predates this check and already shares a
// name) never fails on its own unchanged name.
// ponytail: check-then-write, two simultaneous saves can both pass; add a DB
// unique index on lower(trim(...)) if that ever matters.
async function assertUniqueNameAndGst(data, current) {
  const checks = [
    ['company_name', 'Company name'],
    ['gst_number', 'GST number'],
  ];
  const norm = (v) => (typeof v === 'string' ? v.trim() : '');
  for (const [field, label] of checks) {
    const value = norm(data[field]);
    if (!value) continue;
    if (current && value.toLowerCase() === norm(current[field]).toLowerCase()) continue;
    const clash = await companyRepository.findFirst({
      [field]: { equals: value, mode: 'insensitive' },
      ...(current ? { id: { not: current.id } } : {}),
    });
    if (clash) throw new CompanyError(`${label} "${value}" already exists`, 409);
  }
}

async function createCompany(data) {
  const rest = pickEditable(data);
  await assertUniqueNameAndGst(rest);

  for (let attempt = 0; attempt < MAX_CODE_ATTEMPTS; attempt += 1) {
    try {
      return await companyRepository.create({
        ...rest,
        company_code: generateCompanyCode(),
        onboarding_status: 'pending',
      });
    } catch (err) {
      const isDuplicateCode =
        err instanceof Prisma.PrismaClientKnownRequestError &&
        err.code === 'P2002' &&
        err.meta?.target?.includes('company_code');

      if (!isDuplicateCode) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique company code, please retry');
}

// Counts per value of a column, e.g. { ACTIVE: 1, INACTIVE: 2 }, for the filter chips.
async function countBy(field, where) {
  const rows = await companyRepository.groupBy({ by: [field], where, _count: { _all: true } });
  return Object.fromEntries(rows.filter((r) => r[field]).map((r) => [r[field], r._count._all]));
}

// `deleted: true` lists the soft-deleted companies instead (to restore them).
// `status`, `subscription_plan` and `industry_type` filter exactly (any case).
// `filters` gives the chip counts: every value with its number of companies,
// for the current search, before the status/plan/industry filters.
async function getCompanies({ page = 1, limit = 20, search = '', deleted = false, status, subscription_plan, industry_type }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const base = {
    ...(deleted ? { deleted_at: { not: null } } : {}),
    ...(search
      ? {
          OR: [
            { company_name: { contains: search, mode: 'insensitive' } },
            { company_code: { contains: search, mode: 'insensitive' } },
            { address: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { owner_name: { contains: search, mode: 'insensitive' } },
            { phone: { contains: search, mode: 'insensitive' } },
            { gst_number: { contains: search, mode: 'insensitive' } },
            { city: { contains: search, mode: 'insensitive' } },
            { industry_type: { contains: search, mode: 'insensitive' } },
            { subscription_plan: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const exact = (value) => ({ equals: value, mode: 'insensitive' });
  const where = {
    ...base,
    ...(status ? { status: exact(status) } : {}),
    ...(subscription_plan ? { subscription_plan: exact(subscription_plan) } : {}),
    ...(industry_type ? { industry_type: exact(industry_type) } : {}),
  };

  const [data, total, statusCounts, planCounts, industryCounts] = await Promise.all([
    companyRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    companyRepository.count(where),
    countBy('status', base),
    countBy('subscription_plan', base),
    countBy('industry_type', base),
  ]);

  return {
    items: data,
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
    filters: { status: statusCounts, subscription_plan: planCounts, industry_type: industryCounts },
  };
}

async function getCompanyById(id) {
  return companyRepository.findById(id);
}

async function updateCompany(id, data) {
  const rest = pickEditable(data);
  await assertUniqueNameAndGst(rest, await companyRepository.findById(id));
  await companyRepository.update(id, rest);
  return recomputeOnboardingStatus(id);
}

async function updateCompanyStep2(id, data) {
  const payload = STEP2_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  const before = await companyRepository.findById(id);
  await companyRepository.update(id, payload);
  const after = await companyRepository.findById(id);

  const justCompleted =
    !isStepComplete(before, ['owner_name', 'email']) && isStepComplete(after, ['owner_name', 'email']);

  if (justCompleted) {
    const existingUser = await userRepository.findByCompanyId(id);
    if (!existingUser) {
      await activateCompanyUser(after);
    }
  }

  return recomputeOnboardingStatus(id);
}

async function updateCompanyStep3(id, data) {
  const payload = STEP3_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await companyRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
}

// Creates the company's login user with a temporary password and emails it.
// Does nothing if the company already has a user: the temporary password is
// generated only when the user is actually created, so a password that was
// already emailed is never replaced.
async function activateCompanyUser(company) {
  if (!company.email) {
    throw new CompanyError('Company must have an email set before it can be activated');
  }

  if (await userRepository.findByCompanyId(company.id)) return;

  const tempPassword = generateTempPassword();
  const password_hash = await bcrypt.hash(tempPassword, 10);

  try {
    await userRepository.create({
      company_id: company.id,
      email: company.email,
      password_hash,
      role: 'company',
      user_type: 'company',
    });
  } catch (err) {
    const isDuplicateEmail = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    if (isDuplicateEmail) {
      throw new CompanyError('A user account with this email already exists', 409);
    }
    throw err;
  }

  await companyRepository.update(company.id, { password: tempPassword });

  try {
    await sendWelcomeEmail(company.email, company.email, tempPassword);
  } catch (err) {
    console.error(`Failed to send welcome email to ${company.email}:`, err.message);
  }
}

async function deactivateCompanyUser(company) {
  const existingUser = await userRepository.findByCompanyId(company.id);
  if (existingUser) {
    await refreshTokenRepository.revokeAllForUser(existingUser.id);
  }

  if (company.email) {
    try {
      await sendDeactivationEmail(company.email, company.email);
    } catch (err) {
      console.error(`Failed to send deactivation email to ${company.email}:`, err.message);
    }
  }
}

async function updateCompanyStatus(id, status) {
  const company = await companyRepository.findById(id);
  if (!company) {
    throw new CompanyError('Company not found', 404);
  }

  if (company.onboarding_status !== 'completed') {
    throw new CompanyError('Company must complete all 3 onboarding steps before its status can be changed');
  }

  if (status !== company.status) {
    if (status === 'ACTIVE') {
      // Only create the login if step 2 didn't already: the welcome email's
      // temporary password must keep working.
      const existingUser = await userRepository.findByCompanyId(company.id);
      if (!existingUser) {
        await activateCompanyUser(company);
      }
    } else if (status === 'INACTIVE') {
      await deactivateCompanyUser(company);
    }
  }

  return companyRepository.update(id, { status });
}

async function deleteCompany(id) {
  if (!(await companyRepository.findById(id))) {
    throw new CompanyError('Company not found', 404);
  }
  return companyRepository.delete(id);
}

async function restoreCompany(id) {
  const company = await companyRepository.restore(id);
  if (!company) throw new CompanyError('Deleted company not found', 404);
  return company;
}

module.exports = {
  CompanyError,
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  updateCompanyStep2,
  updateCompanyStep3,
  updateCompanyStatus,
  deleteCompany,
  restoreCompany,
};
