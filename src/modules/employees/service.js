const bcrypt = require('bcryptjs');
const prisma = require('../../prisma/client');
const employeeRepository = require('./repository');
const { exact, choice, dateRange, dayRangeIST, bool, compact } = require('../../utils/listFilters');
const companyRepository = require('../companies/repository');
const { resolveSalary, SALARY_TYPES } = require('./salary');
const { generateSecurePassword } = require('../../utils/securePassword');
const { sendEmployeeSetupEmail } = require('../../utils/mailer');

const EMPLOYMENT_FIELDS = [
  'department',
  'department_id',
  'designation',
  'joining_date',
  'manager_id',
  'employment_type',
  'salary_type',
  'salary_period',
  'salary',
  'status',
];
const EMPLOYMENT_MARKER = ['department', 'designation'];

const BANKING_FIELDS = ['bank_name', 'account_number', 'ifsc_code', 'pan_number', 'aadhaar_number'];
const BANKING_MARKER = ['bank_name', 'account_number', 'ifsc_code'];

class EmployeeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isStepComplete(employee, fields) {
  return fields.every((field) => employee[field] !== null && employee[field] !== undefined && employee[field] !== '');
}

function computeOnboardingStatus(employee) {
  const employmentDone = isStepComplete(employee, EMPLOYMENT_MARKER);
  const bankingDone = isStepComplete(employee, BANKING_MARKER);
  return employmentDone && bankingDone ? 'completed' : 'pending';
}

async function recomputeOnboardingStatus(id) {
  const employee = await employeeRepository.findById(id);
  const onboarding_status = computeOnboardingStatus(employee);

  if (employee.onboarding_status === onboarding_status) {
    return employee;
  }

  return employeeRepository.update(id, { onboarding_status });
}

async function assertValidCompany(company_id) {
  const company = await companyRepository.findById(company_id);
  if (!company) {
    throw new EmployeeError('company_id does not reference an existing company');
  }
}

async function assertValidManager(managerId, company_id, selfId) {
  if (managerId === undefined || managerId === null) {
    return;
  }

  if (selfId !== undefined && managerId === selfId) {
    throw new EmployeeError('An employee cannot be their own manager');
  }

  const manager = await employeeRepository.findByIdAndCompany(managerId, company_id);
  if (!manager) {
    throw new EmployeeError('manager_id does not reference an existing employee for this company');
  }
}

// department_id must be one of the company's departments. Its name also goes
// in the older free-text `department`, so filters and search on that keep
// working. An inactive department may stay on an employee who already has it.
async function resolveDepartment(data, company_id, currentId) {
  if (data.department_id === undefined) return {};
  if (data.department_id === null || data.department_id === '') return { department_id: null, department: null };
  const dept = await prisma.departments.findFirst({ where: { id: String(data.department_id), company_id } });
  if (!dept) throw new EmployeeError('Pick a department from the Department master');
  if (dept.status !== 'ACTIVE' && dept.id !== currentId) {
    throw new EmployeeError(`Department "${dept.name}" is inactive. Pick an active one`);
  }
  return { department_id: dept.id, department: dept.name };
}

// Checked salary and department columns for a change to [current] (the
// saved employee, or {} when creating).
async function employmentChanges(current, company_id, data) {
  const { data: salary, errors } = resolveSalary(current, data);
  if (errors.length) throw new EmployeeError(errors.join('. '));
  return { ...salary, ...(await resolveDepartment(data, company_id, current.department_id)) };
}

async function createEmployee(company_id, data) {
  const { employee_code, id, onboarding_status, user_type, company_id: _companyId, ...rest } = data;
  await assertValidCompany(company_id);
  await assertValidManager(rest.manager_id, company_id);

  const employee = await employeeRepository.create({
    ...rest,
    ...(await employmentChanges({}, company_id, rest)),
    company_id,
    employee_code: null,
    onboarding_status: 'pending',
  });
  const generatedCode = `EMP${String(employee.id).padStart(4, '0')}`;
  return employeeRepository.update(employee.id, { employee_code: generatedCode });
}

const EMPLOYEE_STATUSES = ['Active', 'Inactive', 'On Leave'];
const EMPLOYMENT_TYPES = ['Full-time', 'Part-time', 'Contract', 'Intern'];

// filters: status, department, employment_type (query params; missing = any).
async function getEmployees(company_id, { page = 1, deleted = false, limit = 20, search = '', filters = {} }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    ...(company_id ? { company_id } : {}),
    // deleted=true lists the soft-deleted rows instead (to restore them).
    ...(deleted ? { deleted_at: { not: null } } : {}),
    ...compact({
      status: choice('status', filters.status, EMPLOYEE_STATUSES),
      department: exact(filters.department),
      employment_type: choice('employment_type', filters.employment_type, EMPLOYMENT_TYPES),
      salary_type: choice('salary_type', filters.salary_type, SALARY_TYPES),
      // ?from=&to= (YYYY-MM-DD): joined in that range.
      joining_date: dateRange(filters.from, filters.to),
    }),
    ...(search
      ? {
          OR: [
            { first_name: { contains: search, mode: 'insensitive' } },
            { last_name: { contains: search, mode: 'insensitive' } },
            { employee_code: { contains: search, mode: 'insensitive' } },
            { email: { contains: search, mode: 'insensitive' } },
            { department: { contains: search, mode: 'insensitive' } },
            { designation: { contains: search, mode: 'insensitive' } },
          ],
        }
      : {}),
  };

  const [data, total] = await Promise.all([
    employeeRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    employeeRepository.count(where),
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

async function getEmployeeById(id, company_id) {
  return employeeRepository.findByIdAndCompany(id, company_id);
}

async function updateEmployee(id, company_id, data) {
  const { employee_code, id: _id, onboarding_status, user_type, company_id: _companyId, ...rest } = data;

  if (rest.manager_id !== undefined) {
    await assertValidManager(rest.manager_id, company_id, id);
  }

  const current = await employeeRepository.findByIdAndCompany(id, company_id);
  await employeeRepository.update(id, { ...rest, ...(await employmentChanges(current, company_id, rest)) });
  if (rest.status !== undefined && rest.status !== 'Active') await revokeSessions(id);
  return recomputeOnboardingStatus(id);
}

async function updateEmployeeStep2(id, company_id, data) {
  if (data.manager_id !== undefined) {
    await assertValidManager(data.manager_id, company_id, id);
  }

  const payload = EMPLOYMENT_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  const current = await employeeRepository.findByIdAndCompany(id, company_id);
  await employeeRepository.update(id, { ...payload, ...(await employmentChanges(current, company_id, payload)) });
  if (payload.status !== undefined && payload.status !== 'Active') await revokeSessions(id);
  return recomputeOnboardingStatus(id);
}

// ── Employee login ──────────────────────────────────────────────────────────
// An employee signs in with their own users row (user_type "employee",
// linked by employee_id), on their saved email. Activating makes a temporary
// password and emails it; they must choose their own at first sign-in.
// Removing access soft-deletes the row, and activating again brings the same
// row back.

const ANY_ROW = { deleted_at: undefined }; // see utils/productCode.js

async function revokeSessions(employee_id) {
  const user = await prisma.users.findFirst({ where: { employee_id, ...ANY_ROW }, select: { id: true } });
  if (user) {
    await prisma.refresh_tokens.updateMany({ where: { user_id: user.id, revoked_at: null }, data: { revoked_at: new Date() } });
  }
}

// Frees a removed login's email for someone else: the row keeps a
// placeholder address that can't receive mail or be signed in with.
async function releaseEmail(user_id) {
  await prisma.users.updateMany({
    where: { id: user_id, ...ANY_ROW },
    data: { email: `removed-${user_id}-${Date.now()}@removed.invalid`, updated_at: new Date() },
  });
}

// Activates (or re-sends) the employee's login: a new temporary password,
// only its hash saved, emailed in plain text to their saved email. Each send
// replaces the last password, so an older email stops working. If the email
// can't be sent the login stays set up but the error is kept and returned,
// so the admin can resend.
async function activateLogin(employee_id, company_id) {
  const employee = await employeeRepository.findByIdAndCompany(employee_id, company_id);
  if (!employee) throw new EmployeeError('Employee not found', 404);
  if (employee.status !== 'Active') throw new EmployeeError('Only an Active employee can be given a login');

  const email = String(employee.email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 150) {
    throw new EmployeeError("Add a valid email to this employee's details first: the setup email goes there");
  }
  const existing = await prisma.users.findFirst({ where: { employee_id, ...ANY_ROW } });
  const taken = await prisma.users.findFirst({
    where: { email: { equals: email, mode: 'insensitive' }, ...ANY_ROW, ...(existing ? { id: { not: existing.id } } : {}) },
    select: { id: true, deleted_at: true, user_type: true },
  });
  // A removed employee login (or a deleted employee's) still holds its
  // address, since emails are unique across all rows: let it go.
  if (taken && taken.deleted_at && taken.user_type === 'employee') await releaseEmail(taken.id);
  else if (taken) throw new EmployeeError(`${email} is already used by another login`, 409);

  // A duplicate request -- the same login and address within a few seconds
  // (a double tap, a request sent twice) -- gets the login as it is, not a
  // second email with a different password. Claimed in one write, so two
  // at once can't both pass. A changed address, or a Resend later on,
  // always sends.
  const sameAddress = existing && String(existing.email ?? '').toLowerCase() === email.toLowerCase();
  if (existing && !existing.deleted_at && sameAddress) {
    const claimed = await prisma.users.updateMany({
      where: {
        id: existing.id,
        deleted_at: null,
        OR: [{ setup_email_sent_at: null }, { setup_email_sent_at: { lt: new Date(Date.now() - 15 * 1000) } }],
      },
      data: { setup_email_sent_at: new Date() },
    });
    if (!claimed.count) return loginOf(employee_id);
  }

  const tempPassword = generateSecurePassword();
  const data = {
    email,
    role: 'employee',
    user_type: 'employee',
    company_id,
    password_hash: await bcrypt.hash(tempPassword, 10),
    must_change_password: true,
    // Kept as the claim above until the send settles (cleared if it fails).
    setup_email_sent_at: new Date(),
    setup_email_error: null,
  };
  if (existing) {
    // Naming deleted_at lets this reach a removed login and bring it back.
    await prisma.users.updateMany({ where: { id: existing.id, ...ANY_ROW }, data: { ...data, deleted_at: null, updated_at: new Date() } });
    await revokeSessions(employee_id);
  } else {
    await prisma.users.create({ data: { ...data, employee_id } });
  }

  const company = await prisma.companies.findFirst({ where: { id: company_id }, select: { company_name: true } });
  try {
    await sendEmployeeSetupEmail(email, {
      name: [employee.first_name, employee.last_name].filter(Boolean).join(' '),
      companyName: company?.company_name,
      tempPassword,
    });
  } catch (err) {
    const reason = String(err?.message ?? err).slice(0, 300);
    // Not sent: an immediate Resend is allowed.
    await prisma.users.updateMany({ where: { employee_id }, data: { setup_email_error: reason, setup_email_sent_at: null } });
    throw new EmployeeError(`Couldn't send the setup email to ${email} (${reason}). Check the address and tap Resend.`, 502);
  }
  await prisma.users.updateMany({ where: { employee_id }, data: { setup_email_sent_at: new Date(), setup_email_error: null } });
  return loginOf(employee_id);
}

async function removeLogin(employee_id, company_id) {
  const employee = await employeeRepository.findByIdAndCompany(employee_id, company_id);
  if (!employee) throw new EmployeeError('Employee not found', 404);
  await revokeSessions(employee_id);
  await prisma.users.updateMany({ where: { employee_id, deleted_at: null }, data: { deleted_at: new Date() } });
}

// The employee's login, or null if they never had one: email, active, whether
// they still have to set their own password, and the setup email's state.
async function loginOf(employee_id) {
  const user = await prisma.users.findFirst({
    where: { employee_id, ...ANY_ROW },
    select: { email: true, deleted_at: true, must_change_password: true, setup_email_sent_at: true, setup_email_error: true },
  });
  return user
    ? {
        email: user.email,
        active: !user.deleted_at,
        must_change_password: user.must_change_password,
        setup_email_sent_at: user.setup_email_sent_at,
        setup_email_error: user.setup_email_error,
      }
    : null;
}

async function updateEmployeeStep3(id, data) {
  const payload = BANKING_FIELDS.reduce((acc, field) => {
    if (data[field] !== undefined) acc[field] = data[field];
    return acc;
  }, {});

  await employeeRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
}

async function deleteEmployee(id) {
  // A deleted employee can't sign in.
  await revokeSessions(id);
  await prisma.users.updateMany({ where: { employee_id: id, deleted_at: null }, data: { deleted_at: new Date() } });
  // Their address can be given to a new employee.
  const user = await prisma.users.findFirst({ where: { employee_id: id, ...ANY_ROW }, select: { id: true } });
  if (user) await releaseEmail(user.id);
  return employeeRepository.delete(id);
}

module.exports = {
  EmployeeError,
  createEmployee,
  getEmployees,
  getEmployeeById,
  updateEmployee,
  updateEmployeeStep2,
  updateEmployeeStep3,
  deleteEmployee,
  activateLogin,
  removeLogin,
  loginOf,
};
