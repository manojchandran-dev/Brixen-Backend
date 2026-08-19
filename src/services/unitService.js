const { Prisma } = require('@prisma/client');
const unitRepository = require('../repositories/unitRepository');
const { generateUnitId } = require('../utils/unitId');

const MAX_ID_ATTEMPTS = 5;

class UnitError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function isDuplicateField(err, field) {
  return (
    err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002' && err.meta?.target?.includes(field)
  );
}

async function createUnit(data) {
  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    try {
      return await unitRepository.create({
        id: generateUnitId(),
        unit: data.unit,
        full_form: data.full_form,
        description: data.description,
      });
    } catch (err) {
      if (isDuplicateField(err, 'unit')) {
        throw new UnitError('A unit with this name already exists', 409);
      }
      if (!isDuplicateField(err, 'id')) {
        throw err;
      }
    }
  }

  throw new Error('Failed to generate a unique unit id, please retry');
}

async function getUnits({ page = 1, limit = 20, search = '' }) {
  const take = Math.min(Math.max(limit, 1), 100);
  const skip = (Math.max(page, 1) - 1) * take;

  const where = search
    ? {
        OR: [
          { unit: { contains: search, mode: 'insensitive' } },
          { full_form: { contains: search, mode: 'insensitive' } },
          { description: { contains: search, mode: 'insensitive' } },
        ],
      }
    : {};

  const [data, total] = await Promise.all([
    unitRepository.findMany({ where, skip, take, orderBy: { created_at: 'desc' } }),
    unitRepository.count(where),
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

async function getUnitById(id) {
  return unitRepository.findById(id);
}

async function updateUnit(id, data) {
  try {
    return await unitRepository.update(id, data);
  } catch (err) {
    if (isDuplicateField(err, 'unit')) {
      throw new UnitError('A unit with this name already exists', 409);
    }
    throw err;
  }
}

async function deleteUnit(id) {
  return unitRepository.delete(id);
}

module.exports = {
  UnitError,
  createUnit,
  getUnits,
  getUnitById,
  updateUnit,
  deleteUnit,
};
