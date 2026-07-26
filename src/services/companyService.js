const companyRepository = require('../repositories/companyRepository');

async function createCompany(data) {
  return companyRepository.create(data);
}

async function getCompanies({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
    ? {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { address: { contains: search, mode: 'insensitive' } },
          { email: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    companyRepository.findMany({ where, skip, take, orderBy: { createdAt: 'desc' } }),
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
  return companyRepository.update(id, data);
}

async function deleteCompany(id) {
  return companyRepository.delete(id);
}

module.exports = {
  createCompany,
  getCompanies,
  getCompanyById,
  updateCompany,
  deleteCompany,
};
