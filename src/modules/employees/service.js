const bcrypt = require('bcryptjs');
const prisma = require('../../prisma/client');
const employeeRepository = require('./repository');
const { exact, choice, dateRange, dayRangeIST, bool, compact } = require('../../utils/listFilters');
const companyRepository = require('../companies/repository');
const { resolveSalary, SALARY_TYPES } = require('./salary');

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
// linked by employee_id). The company admin sets the email and password;
// removing access soft-deletes the row, and setting it again brings the same
// row back.

const ANY_ROW = { deleted_at: undefined }; // see utils/productCode.js

async function revokeSessions(employee_id) {
  const user = await prisma.users.findFirst({ where: { employee_id, ...ANY_ROW }, select: { id: true } });
  if (user) {
    await prisma.refresh_tokens.updateMany({ where: { user_id: user.id, revoked_at: null }, data: { revoked_at: new Date() } });
  }
}

async function setLogin(employee_id, company_id, { email, password }) {
  const employee = await employeeRepository.findByIdAndCompany(employee_id, company_id);
  if (!employee) throw new EmployeeError('Employee not found', 404);

  const existing = await prisma.users.findFirst({ where: { employee_id, ...ANY_ROW } });
  const cleanEmail = String(email ?? '').trim();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail) || cleanEmail.length > 150) {
    throw new EmployeeError('Enter a valid email address for the login');
  }
  const taken = await prisma.users.findFirst({
    where: { email: { equals: cleanEmail, mode: 'insensitive' }, ...ANY_ROW, ...(existing ? { id: { not: existing.id } } : {}) },
    select: { id: true },
  });
  if (taken) throw new EmployeeError('This email is already used by another login', 409);

  const needsPassword = !existing || existing.deleted_at;
  if (password !== undefined && password !== null && password !== '') {
    if (typeof password !== 'string' || password.length < 8) {
      throw new EmployeeError('Password must be at least 8 characters');
    }
  } else if (needsPassword) {
    throw new EmployeeError('Set a password (at least 8 characters) for the new login');
  }
  const password_hash = password ? await bcrypt.hash(password, 10) : undefined;

  const data = {
    email: cleanEmail,
    role: 'employee',
    user_type: 'employee',
    company_id,
    ...(password_hash ? { password_hash } : {}),
  };
  if (existing) {
    // Naming deleted_at lets this reach a removed login and bring it back.
    await prisma.users.updateMany({ where: { id: existing.id, ...ANY_ROW }, data: { ...data, deleted_at: null, updated_at: new Date() } });
    // A new password signs the employee out everywhere.
    if (password_hash) await revokeSessions(employee_id);
  } else {
    await prisma.users.create({ data: { ...data, employee_id, password_hash } });
  }
  return loginOf(employee_id);
}

async function removeLogin(employee_id, company_id) {
  const employee = await employeeRepository.findByIdAndCompany(employee_id, company_id);
  if (!employee) throw new EmployeeError('Employee not found', 404);
  await revokeSessions(employee_id);
  await prisma.users.updateMany({ where: { employee_id, deleted_at: null }, data: { deleted_at: new Date() } });
}

// { email, active } for the employee's login, or null if they never had one.
async function loginOf(employee_id) {
  const user = await prisma.users.findFirst({
    where: { employee_id, ...ANY_ROW },
    select: { email: true, deleted_at: true },
  });
  return user ? { email: user.email, active: !user.deleted_at } : null;
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
  setLogin,
  removeLogin,
  loginOf,
};
