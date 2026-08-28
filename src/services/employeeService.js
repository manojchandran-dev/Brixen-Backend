const employeeRepository = require('../repositories/employeeRepository');
const companyRepository = require('../repositories/companyRepository');

const EMPLOYMENT_FIELDS = ['department', 'designation', 'joining_date', 'manager_id', 'employment_type', 'salary', 'status'];
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

async function createEmployee(company_id, data) {
  const { employee_code, id, onboarding_status, company_id: _companyId, ...rest } = data;
  await assertValidCompany(company_id);
  await assertValidManager(rest.manager_id, company_id);

  const employee = await employeeRepository.create({
    ...rest,
    company_id,
    employee_code: null,
    onboarding_status: 'pending',
  });
  const generatedCode = `EMP${String(employee.id).padStart(4, '0')}`;
  return employeeRepository.update(employee.id, { employee_code: generatedCode });
}

async function getEmployees(company_id, { page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = {
    company_id,
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
  const { employee_code, id: _id, onboarding_status, company_id: _companyId, ...rest } = data;

  if (rest.manager_id !== undefined) {
    await assertValidManager(rest.manager_id, company_id, id);
  }

  await employeeRepository.update(id, rest);
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

  await employeeRepository.update(id, payload);
  return recomputeOnboardingStatus(id);
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
};
