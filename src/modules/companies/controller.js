const companyService = require('./service');
const { success, error } = require('../../core/responses/apiResponse');

// companies.password holds the plaintext temporary login password (it's
// emailed on activation) -- never send it back out over the API.
const hidePassword = ({ password, ...company }) => company;

async function createCompany(req, res) {
  try {
    const company = await companyService.createCompany(req.body);
    return success(res, hidePassword(company), 201);
  } catch (err) {
    if (err instanceof companyService.CompanyError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function getCompanies(req, res) {
  const page = parseInt(req.query.page, 10) || 1;
  const limit = parseInt(req.query.limit, 10) || 20;
  const search = req.query.search || '';

  const result = await companyService.getCompanies({ page, limit, search });
  return success(res, { ...result, items: result.items.map(hidePassword) });
}

async function getCompanyById(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  const company = await companyService.getCompanyById(id);
  if (!company) {
    return error(res, 'Company not found', 404);
  }

  return success(res, hidePassword(company));
}

async function updateCompany(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  const existing = await companyService.getCompanyById(id);
  if (!existing) {
    return error(res, 'Company not found', 404);
  }

  try {
    const company = await companyService.updateCompany(id, req.body);
    return success(res, hidePassword(company));
  } catch (err) {
    if (err instanceof companyService.CompanyError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function updateCompanyStep2(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  const existing = await companyService.getCompanyById(id);
  if (!existing) {
    return error(res, 'Company not found', 404);
  }

  const company = await companyService.updateCompanyStep2(id, req.body);
  return success(res, hidePassword(company));
}

async function updateCompanyStep3(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  const existing = await companyService.getCompanyById(id);
  if (!existing) {
    return error(res, 'Company not found', 404);
  }

  const company = await companyService.updateCompanyStep3(id, req.body);
  return success(res, hidePassword(company));
}

async function updateCompanyStatus(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  try {
    const company = await companyService.updateCompanyStatus(id, req.body.status);
    return success(res, hidePassword(company));
  } catch (err) {
    if (err instanceof companyService.CompanyError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

async function deleteCompany(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  try {
    await companyService.deleteCompany(id);
  } catch (err) {
    if (err instanceof companyService.CompanyError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
  return res.status(204).send();
}

async function restoreCompany(req, res) {
  const id = parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return error(res, 'Invalid company id', 400);
  }

  try {
    return success(res, hidePassword(await companyService.restoreCompany(id)));
  } catch (err) {
    if (err instanceof companyService.CompanyError) {
      return error(res, err.message, err.status);
    }
    throw err;
  }
}

module.exports = {
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
