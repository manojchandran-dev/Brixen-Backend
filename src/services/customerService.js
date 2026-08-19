const { Prisma } = require('@prisma/client');
const customerRepository = require('../repositories/customerRepository');
const { generateCustomerId } = require('../utils/customerId');

const MAX_ID_ATTEMPTS = 5;

async function createCustomer(data) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await customerRepository.create({
        id: generateCustomerId(),
        name: data.name,
        shop_name: data.shop_name,
        phone: data.phone,
        email: data.email,
        gst_number: data.gst_number,
        address: data.address,
      });
    } catch (err) {
      const isDuplicateId = err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002';
      if (!isDuplicateId) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique customer id, please retry');
}

async function getCustomers({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { shop_name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    customerRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    customerRepository.count(where),
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

async function getCustomerById(id) {
  return customerRepository.findById(id);
}

async function updateCustomer(id, data) {
  const { id: _id, ...rest } = data;
  return customerRepository.update(id, rest);
}

async function deleteCustomer(id) {
  return customerRepository.delete(id);
}

module.exports = {
  createCustomer,
  getCustomers,
  getCustomerById,
  updateCustomer,
  deleteCustomer,
};
