/**
 * Default category tree. This is configuration, not listing data: operators can rename,
 * reorder and hide categories. It is idempotent and safe to run in every environment.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const TREE: Array<{ slug: string; name: string; description: string; children: Array<{ slug: string; name: string }> }> = [
  {
    slug: "food-beverage",
    name: "Food & Beverage",
    description: "Packaged foods, drinks, staples and ingredients for retail and food-service distribution.",
    children: [
      { slug: "packaged-foods", name: "Packaged Foods" },
      { slug: "beverages", name: "Beverages" },
      { slug: "dairy-frozen", name: "Dairy & Frozen" },
      { slug: "snacks-confectionery", name: "Snacks & Confectionery" },
    ],
  },
  {
    slug: "health-beauty",
    name: "Health & Beauty",
    description: "Personal care, cosmetics and wellness products.",
    children: [
      { slug: "skincare-cosmetics", name: "Skincare & Cosmetics" },
      { slug: "personal-care", name: "Personal Care" },
      { slug: "wellness-supplements", name: "Wellness & Supplements" },
    ],
  },
  {
    slug: "pharmaceuticals",
    name: "Pharmaceuticals",
    description: "Medicines, healthcare supplies and medical consumables.",
    children: [
      { slug: "generic-medicines", name: "Generic Medicines" },
      { slug: "medical-supplies", name: "Medical Supplies" },
    ],
  },
  {
    slug: "electronics",
    name: "Electronics",
    description: "Consumer and industrial electronics, appliances and accessories.",
    children: [
      { slug: "consumer-electronics", name: "Consumer Electronics" },
      { slug: "home-appliances", name: "Home Appliances" },
      { slug: "mobile-accessories", name: "Mobile Accessories" },
    ],
  },
  {
    slug: "agriculture",
    name: "Agriculture",
    description: "Seeds, inputs, equipment and agricultural produce.",
    children: [
      { slug: "agri-inputs", name: "Seeds & Inputs" },
      { slug: "farm-equipment", name: "Farm Equipment" },
    ],
  },
  {
    slug: "automobile",
    name: "Automobile",
    description: "Vehicles, spare parts, lubricants and accessories.",
    children: [
      { slug: "auto-parts", name: "Spare Parts" },
      { slug: "lubricants", name: "Lubricants & Fluids" },
    ],
  },
  {
    slug: "apparel-fashion",
    name: "Apparel & Fashion",
    description: "Clothing, footwear, accessories and textiles.",
    children: [
      { slug: "mens-womens-wear", name: "Men's & Women's Wear" },
      { slug: "footwear", name: "Footwear" },
    ],
  },
  {
    slug: "home-care-cleaning",
    name: "Home Care & Cleaning",
    description: "Household cleaning products and home-care supplies.",
    children: [{ slug: "detergents", name: "Detergents & Cleaners" }],
  },
  { slug: "chemicals", name: "Chemicals", description: "Industrial and specialty chemicals.", children: [] },
  {
    slug: "machinery",
    name: "Machinery",
    description: "Industrial machinery, tools and spare parts.",
    children: [{ slug: "industrial-tools", name: "Industrial Tools" }],
  },
  {
    slug: "building-construction",
    name: "Building & Construction",
    description: "Construction materials, fittings and equipment.",
    children: [{ slug: "building-materials", name: "Building Materials" }],
  },
  { slug: "packaging", name: "Packaging", description: "Packaging materials and solutions.", children: [] },
  { slug: "furniture", name: "Furniture", description: "Home, office and commercial furniture.", children: [{ slug: "kitchen-furniture", name: "Kitchen" }] },
  { slug: "sports-entertainment", name: "Sports & Entertainment", description: "Sports goods and entertainment products.", children: [] },
  { slug: "toys", name: "Toys", description: "Toys and games for children.", children: [] },
  { slug: "business-services", name: "Business Services", description: "Services for businesses and distributors.", children: [] },
];

async function main() {
  let order = 0;
  for (const root of TREE) {
    const parent = await prisma.category.upsert({
      where: { slug: root.slug },
      update: {},
      create: { slug: root.slug, name: root.name, description: root.description, sortOrder: order++ * 10 },
    });
    let childOrder = 0;
    for (const child of root.children) {
      await prisma.category.upsert({
        where: { slug: child.slug },
        update: {},
        create: { slug: child.slug, name: child.name, parentId: parent.id, sortOrder: childOrder++ * 10 },
      });
    }
  }
  console.log(`Seeded ${TREE.length} categories (+ subcategories). Existing rows were left untouched.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
