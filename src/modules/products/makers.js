const prisma = require('../../prisma/client');
const asyncHandler = require('../../middleware/asyncHandler');
const { success, error } = require('../../core/responses/apiResponse');
const { parseCompanyId } = require('../../utils/companyScope');
const { isDozen } = require('../payroll/sold');

// "Made by": the piece-rate employees who make a product. When it sells,
// each of them is paid the pieces sold x their own rate (salary
// generation). Mounted on /products/:id/makers (the Products permission).

const fullName = (e) => [e.first_name, e.last_name].filter(Boolean).join(' ');

const EMPLOYEE = {
  id: true,
  employee_code: true,
  first_name: true,
  last_name: true,
  salary: true,
  salary_period: true,
};

const shapeEmployee = (e) => ({
  id: e.id,
  employee_code: e.employee_code,
  name: fullName(e),
  rate: e.salary === null ? null : Number(e.salary),
  per: e.salary_period === 'PER_DOZEN' ? 'DOZEN' : 'PIECE',
});

async function findProduct(req, res) {
  const company_id = parseCompanyId(req.query.company_id ?? req.body?.company_id);
  if (!company_id) {
    error(res, 'company_id is required and must be a positive integer', 400);
    return null;
  }
  const product = await prisma.products.findFirst({
    where: { id: req.params.id, company_id },
    select: { id: true, company_id: true, units: { select: { unit: true, full_form: true } } },
  });
  if (!product) error(res, 'Product not found', 404);
  return product;
}

// The product's makers, whether it sells by the dozen (x 12 pieces), and
// the active piece-rate employees to choose from.
async function respond(res, product) {
  const [makers, choices] = await Promise.all([
    prisma.product_makers.findMany({
      where: { product_id: product.id },
      include: { employees: { select: EMPLOYEE } },
    }),
    prisma.employees.findMany({
      where: { company_id: product.company_id, salary_type: 'PIECE_RATE', status: 'Active' },
      select: EMPLOYEE,
      orderBy: { first_name: 'asc' },
    }),
  ]);
  return success(res, {
    sold_by_dozen: isDozen(product.units),
    makers: makers.map((m) => shapeEmployee(m.employees)),
    choices: choices.map(shapeEmployee),
  });
}

const get = asyncHandler(async (req, res) => {
  const product = await findProduct(req, res);
  return product ? respond(res, product) : undefined;
});

// body: { employee_ids: [..] } -- replaces the list. Each must be one of the
// company's piece-rate employees.
const put = asyncHandler(async (req, res) => {
  const product = await findProduct(req, res);
  if (!product) return undefined;
  const raw = req.body?.employee_ids;
  if (!Array.isArray(raw)) return error(res, 'employee_ids must be a list', 400);
  const ids = [...new Set(raw.map(Number))];
  if (ids.some((id) => !Number.isInteger(id) || id <= 0)) return error(res, 'employee_ids must be employee ids', 400);
  const found = await prisma.employees.findMany({
    where: { id: { in: ids }, company_id: product.company_id, salary_type: 'PIECE_RATE' },
    select: { id: true },
  });
  if (found.length !== ids.length) {
    return error(res, 'Only your piece-rate employees can be set as makers', 400);
  }
  await prisma.$transaction([
    prisma.product_makers.deleteMany({ where: { product_id: product.id } }),
    prisma.product_makers.createMany({ data: ids.map((employee_id) => ({ product_id: product.id, employee_id })) }),
  ]);
  return respond(res, product);
});

module.exports = { get, put };
