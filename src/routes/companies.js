const { Router } = require('express');
const prisma = require('../prisma/client');

const router = Router();

router.post('/', async (req, res, next) => {
  try {
    const { name, address, email, phone } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Company name is required' });
    }

    const company = await prisma.company.create({
      data: { name, address, email, phone },
    });

    res.status(201).json(company);
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const companies = await prisma.company.findMany();
    res.json(companies);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company id' });
    }

    const company = await prisma.company.findUnique({
      where: { id },
    });

    if (!company) {
      return res.status(404).json({ error: 'Company not found' });
    }

    res.json(company);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company id' });
    }

    const { name, address, email, phone } = req.body;
    const company = await prisma.company.update({
      where: { id },
      data: { name, address, email, phone },
    });

    res.json(company);
  } catch (error) {
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'Invalid company id' });
    }

    await prisma.company.delete({
      where: { id },
    });

    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
