const { Prisma } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const companyRepository = require('../repositories/companyRepository');
const userRepository = require('../repositories/userRepository');
const { generateCompanyCode } = require('../utils/companyCode');
const { generateTempPassword } = require('../utils/tempPassword');
const { sendWelcomeEmail } = require('../utils/mailer');

const STEP2_FIELDS = ['owner_name', 'email', 'phone', 'secondary_email', 'website'];
const STEP3_FIELDS = ['address', 'city', 'state', 'pincode'];

const MAX_CODE_ATTEMPTS = 5;

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

async function createCompany(data) {
  const { company_code, onboarding_status, ...rest } = data;

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

async function getCompanies({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
    ? {
        OR: [
          { company_name: { contains: search, mode: 'insensitive' } },
          { company_code: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    companyRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    companyRepository.count(where),
  ]);

  return {
    items: data,
    meta: {
      page,
      limit: take,
      total,
      pages: Math.ceil(total / take),
    },
  };
}

async function getCompanyById(id) {
  return companyRepository.findById(id);
}

async function updateCompany(id, data) {
  const { company_code, onboarding_status, ...rest } = data;
  await companyRepository.update(id, rest);
  return recomputeOnboardingStatus(id);
}

async function updateCompanyStep2(id, data) {
  const payload = STEP2_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await companyRepository.update(id, payload);
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

async function activateCompanyUser(company) {
  const existingUser = await userRepository.findByCompanyId(company.id);
  if (existingUser) {
    return;
  }

  if (!company.email) {
    throw new CompanyError('Company must have an email set before it can be activated for the first time');
  }

  const tempPassword = generateTempPassword();
  const password_hash = await bcrypt.hash(tempPassword, 10);

  try {
    await userRepository.create({
      company_id: company.id,
      email: company.email,
      password_hash,
      role: 'company_admin',
    });
  } catch (err) {
    const isDuplicateEmail = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
    if (isDuplicateEmail) {
      throw new CompanyError('A user account with this email already exists', 409);
    }
    throw err;
  }

  await sendWelcomeEmail(company.email, company.email, tempPassword);
}

async function updateCompanyStatus(id, status) {
  const company = await companyRepository.findById(id);
  if (!company) {
    throw new CompanyError('Company not found', 404);
  }

  if (company.onboarding_status !== 'completed') {
    throw new CompanyError('Company must complete all 3 onboarding steps before its status can be changed');
  }

  if (status === 'ACTIVE' && company.status !== 'ACTIVE') {
    await activateCompanyUser(company);
  }

  return companyRepository.update(id, { status });
}

async function deleteCompany(id) {
  return companyRepository.delete(id);
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
};
