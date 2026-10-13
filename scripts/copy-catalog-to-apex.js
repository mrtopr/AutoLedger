const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Copying product catalog to Apex Trade & Supplies (0476b16f-cabc-44c7-8213-a348c78bc70c)...');
  const count = await prisma.$executeRawUnsafe(`
    INSERT INTO products (id, tenant_id, name, part_number, brand, category, hsn_code, gst_rate_bp, unit, purchase_price, sale_price, mrp, reorder_level, is_active, created_at, updated_at)
    SELECT gen_random_uuid(), '0476b16f-cabc-44c7-8213-a348c78bc70c'::uuid, name, part_number, brand, category, hsn_code, gst_rate_bp, unit, purchase_price, sale_price, mrp, reorder_level, is_active, now(), now()
    FROM products
    WHERE tenant_id = '57f129ea-5cee-4a6c-859e-0ed0869b8350'::uuid
    ON CONFLICT DO NOTHING;
  `);
  console.log(`✅ Copied ${count} products to Apex Trade & Supplies!`);

  const apexProdCount = await prisma.product.count({
    where: { tenantId: '0476b16f-cabc-44c7-8213-a348c78bc70c' }
  });
  console.log(`Apex now has ${apexProdCount} products in PostgreSQL!`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
