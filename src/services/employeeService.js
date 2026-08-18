const employeeRepository = require('../repositories/employeeRepository');

class EmployeeError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

async function assertValidManager(managerId, selfId) {
  if (managerId === undefined || managerId === null) {
    return;
  }

  if (selfId !== undefined && managerId === selfId) {
    throw new EmployeeError('An employee cannot be their own manager');
  }

  const manager = await employeeRepository.findById(managerId);
  if (!manager) {
    throw new EmployeeError('manager_id does not reference an existing employee');
  }
}

async function createEmployee(data) {
  const { employee_code, id, ...rest } = data;
  await assertValidManager(rest.manager_id);

  const employee = await employeeRepository.create({ ...rest, employee_code: null });
  const generatedCode = `EMP${String(employee.id).padStart(4, '0')}`;
  return employeeRepository.update(employee.id, { employee_code: generatedCode });
}

async function getEmployees({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
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
    : {};

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

async function getEmployeeById(id) {
  return employeeRepository.findById(id);
}

async function updateEmployee(id, data) {
  const { employee_code, id: _id, ...rest } = data;

  if (rest.manager_id !== undefined) {
    await assertValidManager(rest.manager_id, id);
  }

  return employeeRepository.update(id, rest);
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
  deleteEmployee,
};
