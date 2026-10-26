// Gives existing products their code ("C53-BILLASHORTS") and every size/
// colour without one its sku ("C53-BILLASHORTS-S-BLUE"), the same way new
// ones get them (src/utils/productCode.js). Codes already set are kept.
//
//   node scripts/backfill-product-codes.js            # shows what it would set
//   node scripts/backfill-product-codes.js --confirm  # writes (test DB)
//
// Reads DATABASE_URL from the environment or .env. On the production
// database it also needs --production (see scripts/lib/dbGuard.js). Run it
// after `npm run db:push` has added products.product_code.

const { guardDestructive } = require('./lib/dbGuard');
const prisma = require('../src/prisma/client');
const { newProductCode, newVariantSku } = require('../src/utils/productCode');

async function main() {
  const { confirm } = guardDestructive();
  const products = await prisma.products.findMany({
    orderBy: [{ company_id: 'asc' }, { created_at: 'asc' }],
    select: { id: true, company_id: true, product_name: true, product_code: true },
  });
  // Codes handed out in a dry run aren't saved, so track them here too.
  const usedProducts = new Set(products.map((p) => `${p.company_id}|${p.product_code}`));
  const usedSkus = new Set();
  let productsSet = 0;
  let skusSet = 0;

  for (const p of products) {
    let code = p.product_code;
    if (!code) {
      const taken = {
        products: {
          findFirst: async (args) =>
            usedProducts.has(`${p.company_id}|${args.where.product_code}`) ||
            (await prisma.products.findFirst(args)),
        },
      };
      code = await newProductCode(taken, p.company_id, p.product_name);
      usedProducts.add(`${p.company_id}|${code}`);
      productsSet += 1;
      console.log(`${p.product_name}  ->  ${code}`);
      if (confirm) await prisma.products.update({ where: { id: p.id }, data: { product_code: code } });
    }

    const variants = await prisma.product_variants.findMany({
      where: { product_id: p.id, sku: null },
      orderBy: { created_at: 'asc' },
    });
    for (const v of variants) {
      const sku = await newVariantSku(prisma, p.company_id, code, v, usedSkus, v.id);
      usedSkus.add(sku);
      skusSet += 1;
      console.log(`  ${[v.size, v.color].filter(Boolean).join(' / ')}  ->  ${sku}`);
      if (confirm) await prisma.product_variants.update({ where: { id: v.id }, data: { sku } });
    }
  }

  console.log('');
  console.log(`${productsSet} product code(s), ${skusSet} size code(s) ${confirm ? 'saved' : 'to set (run with --confirm to save)'}.`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
