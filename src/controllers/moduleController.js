const moduleService = require('../services/moduleService');
const { success } = require('../utils/apiResponse');

async function getModules(req, res) {
  const modules = await moduleService.getModules();
  return success(res, modules);
}

module.exports = { getModules };
