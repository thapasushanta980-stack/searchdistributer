/**
 * LOCAL DEVELOPMENT FIXTURES — fictional businesses, flagged isDemo.
 *
 * They exist only so the discovery UI can be exercised end to end. They are hidden from every public
 * query unless SHOW_DEMO_DATA=true, and this script refuses to run in production.
 * It also creates deliberately INELIGIBLE records (draft, rejected, suspended, expired) to prove
 * the publication rules keep them out of results.
 */
import "dotenv/config";
import crypto from "node:crypto";
import { PrismaClient, type BusinessType, type CoverageScope, type VerificationStatus } from "@prisma/client";

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to load demo fixtures in production.");
  process.exit(1);
}

const prisma = new PrismaClient();
const DAY = 86_400_000;
const slugify = (v: string) => v.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
const now = Date.now();
const active = { startsAt: new Date(now - 30 * DAY), endsAt: new Date(now + 200 * DAY) };

interface Fixture {
  name: string;
  slug: string;
  category: string;
  location: string;
  city: string;
  country: string;
  coverage: CoverageScope;
  type: BusinessType;
  verification: VerificationStatus;
  summary: string;
  description: string;
  specialties: string[];
  territories: string[];
  investment?: [number, number];
  featured?: boolean;
  products: Array<{ name: string; packaging?: string; description?: string; price?: string }>;
  // Ineligible variants used to prove filtering.
  variant?: "draft" | "rejected" | "suspended" | "expired" | "paused";
  foundedYear?: number;
}

const F: Fixture[] = [
  {
    name: "Himal Fresh Foods Co.",
    slug: "himal-fresh-foods",
    category: "packaged-foods",
    location: "Kathmandu, Nepal",
    city: "Kathmandu",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "DISTRIBUTOR",
    verification: "VERIFIED",
    summary: "Regional distribution of packaged foods and pantry staples to supermarkets and wholesale buyers across Nepal.",
    description:
      "Himal Fresh Foods Co. is a fictional demo distributor used for local development. It represents a mid-sized business moving packaged foods and pantry staples through supermarkets, convenience stores and wholesale buyers.\n\nUse this record to exercise profile layout, specialties, territories and enquiry flows.",
    specialties: ["Consumer Products", "Retail Network", "Wholesale"],
    territories: ["Bagmati Province", "Gandaki Province", "Lumbini Province"],
    investment: [1_500_000, 4_000_000],
    featured: true,
    foundedYear: 2011,
    products: [
      { name: "Instant Noodles (Carton)", packaging: "48 packs per carton" },
      { name: "Basmati Rice 5kg", packaging: "5kg bag, 4 bags per case", price: "Contact for details" },
    ],
  },
  {
    name: "Everest Beverage Traders",
    slug: "everest-beverage-traders",
    category: "beverages",
    location: "Pokhara, Nepal",
    city: "Pokhara",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "WHOLESALER",
    verification: "PROFILE_REVIEWED",
    summary: "Wholesale of bottled water, juices and soft drinks with cold-chain delivery to hotels and retailers.",
    description: "Fictional demo wholesaler for beverages. Delivers to hotels, restaurants and retail counters in the hill regions.",
    specialties: ["Cold Chain", "HoReCa", "Bulk Supply"],
    territories: ["Gandaki Province", "Bagmati Province"],
    investment: [800_000, 2_500_000],
    products: [{ name: "Mineral Water 1L", packaging: "12 bottles per case" }, { name: "Mango Juice 250ml", packaging: "24 cartons per case" }],
  },
  {
    name: "Terai Agro Inputs Ltd.",
    slug: "terai-agro-inputs",
    category: "agri-inputs",
    location: "Biratnagar, Nepal",
    city: "Biratnagar",
    country: "Nepal",
    coverage: "LOCAL",
    type: "SUPPLIER",
    verification: "NONE",
    summary: "Seed, fertiliser and crop-protection supplier for farming cooperatives in eastern Nepal.",
    description: "Fictional demo supplier focused on agricultural inputs and cooperative partnerships.",
    specialties: ["Seeds", "Fertiliser", "Cooperatives"],
    territories: ["Koshi Province"],
    investment: [300_000, 900_000],
    products: [{ name: "Hybrid Maize Seed", packaging: "10kg bag" }],
  },
  {
    name: "Lumbini Auto Parts Hub",
    slug: "lumbini-auto-parts-hub",
    category: "auto-parts",
    location: "Butwal, Nepal",
    city: "Butwal",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "IMPORTER",
    verification: "VERIFIED",
    summary: "Importer of two-wheeler and light-vehicle spare parts with a dealer network across western Nepal.",
    description: "Fictional demo importer. Supplies workshops and dealers with branded and aftermarket spare parts.",
    specialties: ["Two-wheeler Parts", "Dealer Network", "Aftermarket"],
    territories: ["Lumbini Province", "Gandaki Province"],
    investment: [2_000_000, 6_000_000],
    featured: true,
    products: [{ name: "Brake Pad Set (Motorcycle)", packaging: "Box of 10 sets" }],
  },
  {
    name: "Sagarmatha Pharma Distribution",
    slug: "sagarmatha-pharma-distribution",
    category: "generic-medicines",
    location: "Lalitpur, Nepal",
    city: "Lalitpur",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "DISTRIBUTOR",
    verification: "VERIFIED",
    summary: "Licensed distribution of generic medicines to pharmacies and clinics with temperature-controlled storage.",
    description: "Fictional demo pharmaceutical distributor used to test regulated-category presentation.",
    specialties: ["Generic Medicines", "Pharmacy Chains", "Cold Storage"],
    territories: ["Bagmati Province", "Madhesh Province"],
    investment: [3_000_000, 8_000_000],
    products: [{ name: "Paracetamol 500mg Tablets", packaging: "10x10 blister, 100 boxes per case" }],
  },
  {
    name: "Nepal Home Appliance Network",
    slug: "nepal-home-appliance-network",
    category: "home-appliances",
    location: "Kathmandu, Nepal",
    city: "Kathmandu",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "DISTRIBUTOR",
    verification: "PROFILE_REVIEWED",
    summary: "National distributor of kitchen and home appliances with showroom partners and after-sales service.",
    description: "Fictional demo distributor for home appliances.",
    specialties: ["Kitchen Appliances", "Showrooms", "After-sales Service"],
    territories: ["Nepal"],
    investment: [2_500_000, 7_500_000],
    products: [{ name: "Rice Cooker 1.8L", packaging: "6 units per carton" }, { name: "Induction Cooktop", packaging: "4 units per carton" }],
  },
  {
    name: "Gorkha Skin & Care Imports",
    slug: "gorkha-skin-care-imports",
    category: "skincare-cosmetics",
    location: "Kathmandu, Nepal",
    city: "Kathmandu",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "IMPORTER",
    verification: "NONE",
    summary: "Imports skincare and personal-care ranges for pharmacies, salons and online sellers.",
    description: "Fictional demo importer in the health and beauty segment.",
    specialties: ["Skincare", "Salons", "E-commerce Sellers"],
    territories: ["Bagmati Province"],
    investment: [600_000, 1_800_000],
    products: [{ name: "Daily SPF 30 Moisturiser", packaging: "50ml tube, 24 per box" }],
  },
  {
    name: "Bengal Delta Snacks Manufacturing",
    slug: "bengal-delta-snacks",
    category: "snacks-confectionery",
    location: "Dhaka, Bangladesh",
    city: "Dhaka",
    country: "Bangladesh",
    coverage: "INTERNATIONAL",
    type: "MANUFACTURER",
    verification: "PROFILE_REVIEWED",
    summary: "Manufacturer of baked snacks and biscuits seeking importers and distributors in South Asia.",
    description: "Fictional demo manufacturer used to test international coverage and the Manufacturer business type.",
    specialties: ["Biscuits", "Baked Snacks", "Private Label"],
    territories: ["Bangladesh", "Nepal", "Bhutan", "India"],
    investment: [1_000_000, 3_000_000],
    products: [{ name: "Butter Biscuits 200g", packaging: "40 packs per carton" }],
  },
  {
    name: "Mekong Electronics Supply",
    slug: "mekong-electronics-supply",
    category: "mobile-accessories",
    location: "Ho Chi Minh City, Vietnam",
    city: "Ho Chi Minh City",
    country: "Vietnam",
    coverage: "INTERNATIONAL",
    type: "SUPPLIER",
    verification: "VERIFIED",
    summary: "Supplier of chargers, cables and audio accessories for regional retail chains and online marketplaces.",
    description: "Fictional demo supplier of consumer electronics accessories.",
    specialties: ["Chargers", "Audio", "Retail Chains"],
    territories: ["Vietnam", "Thailand", "Cambodia", "Nepal"],
    investment: [500_000, 2_200_000],
    products: [{ name: "USB-C Fast Charger 30W", packaging: "50 units per carton" }],
  },
  {
    name: "Karnali Farm Equipment Dealers",
    slug: "karnali-farm-equipment",
    category: "farm-equipment",
    location: "Surkhet, Nepal",
    city: "Surkhet",
    country: "Nepal",
    coverage: "LOCAL",
    type: "DISTRIBUTOR",
    verification: "NONE",
    summary: "Dealer for hand tools, sprayers and small tillers for hill and mid-hill farms.",
    description: "Fictional demo dealer for farm equipment.",
    specialties: ["Tillers", "Sprayers", "Hand Tools"],
    territories: ["Karnali Province"],
    investment: [400_000, 1_400_000],
    products: [{ name: "Knapsack Sprayer 16L", packaging: "10 units per carton" }],
  },
  {
    name: "Pashupati Lubricants Trading",
    slug: "pashupati-lubricants",
    category: "lubricants",
    location: "Hetauda, Nepal",
    city: "Hetauda",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "WHOLESALER",
    verification: "PROFILE_REVIEWED",
    summary: "Wholesale of engine oils and coolants to fuel stations, garages and fleet operators.",
    description: "Fictional demo wholesaler in the automobile category.",
    specialties: ["Engine Oil", "Fleet Supply", "Garages"],
    territories: ["Bagmati Province", "Madhesh Province"],
    investment: [700_000, 2_000_000],
    products: [{ name: "10W-40 Engine Oil 1L", packaging: "12 bottles per case" }],
  },
  {
    name: "Annapurna Wellness Supplies",
    slug: "annapurna-wellness-supplies",
    category: "wellness-supplements",
    location: "Pokhara, Nepal",
    city: "Pokhara",
    country: "Nepal",
    coverage: "NATIONAL",
    type: "DISTRIBUTOR",
    verification: "NONE",
    summary: "Distributes herbal teas and wellness supplements to health stores and pharmacies.",
    description: "Fictional demo distributor in wellness products.",
    specialties: ["Herbal Teas", "Health Stores"],
    territories: ["Gandaki Province"],
    investment: [250_000, 800_000],
    products: [{ name: "Tulsi Herbal Tea", packaging: "25 bags, 48 boxes per case" }],
  },
  // ---------------- Ineligible records: must NEVER appear publicly ----------------
  { name: "Draft Dairy Co.", slug: "draft-dairy-co", category: "dairy-frozen", location: "Kathmandu, Nepal", city: "Kathmandu", country: "Nepal", coverage: "NATIONAL", type: "DISTRIBUTOR", verification: "NONE", summary: "Draft listing that has not been submitted for review.", description: "Should never be visible.", specialties: ["Dairy"], territories: ["Nepal"], variant: "draft", products: [] },
  { name: "Rejected Rice Mills", slug: "rejected-rice-mills", category: "packaged-foods", location: "Birgunj, Nepal", city: "Birgunj", country: "Nepal", coverage: "NATIONAL", type: "SUPPLIER", verification: "NONE", summary: "Listing rejected by moderation.", description: "Should never be visible.", specialties: ["Rice"], territories: ["Nepal"], variant: "rejected", products: [] },
  { name: "Suspended Spares Ltd.", slug: "suspended-spares", category: "auto-parts", location: "Kathmandu, Nepal", city: "Kathmandu", country: "Nepal", coverage: "NATIONAL", type: "IMPORTER", verification: "VERIFIED", summary: "Business suspended by an administrator.", description: "Should never be visible.", specialties: ["Parts"], territories: ["Nepal"], variant: "suspended", products: [] },
  { name: "Expired Electronics Co.", slug: "expired-electronics", category: "consumer-electronics", location: "Lalitpur, Nepal", city: "Lalitpur", country: "Nepal", coverage: "NATIONAL", type: "DISTRIBUTOR", verification: "VERIFIED", summary: "Subscription expired yesterday.", description: "Should never be visible.", specialties: ["TVs"], territories: ["Nepal"], variant: "expired", products: [] },
  { name: "Paused Pharma Traders", slug: "paused-pharma-traders", category: "medical-supplies", location: "Kathmandu, Nepal", city: "Kathmandu", country: "Nepal", coverage: "NATIONAL", type: "WHOLESALER", verification: "NONE", summary: "Listing paused by its owner.", description: "Should never be visible.", specialties: ["Supplies"], territories: ["Nepal"], variant: "paused", products: [] },
];


interface DemoRequirement {
  ref: string;
  kind: "DISTRIBUTOR" | "PRODUCT" | "SUPPLIER" | "BRAND";
  category: string;
  title: string;
  description: string;
  budget?: [number, number];
  location: string;
  experience?: string;
  warehouse?: string;
  area?: string;
  company?: string;
  status: "APPROVED" | "PENDING_REVIEW" | "REJECTED";
  ageDays: number;
}

const R: DemoRequirement[] = [
  { ref: "DEMO-0001", kind: "DISTRIBUTOR", category: "packaged-foods", title: "Seeking packaged-food brands to distribute in Pokhara", description: "Fictional demo lead. An established grocery wholesaler looking to take on one or two packaged-food brands for the Gandaki region, with weekly delivery to retail stores.", budget: [20000, 60000], location: "Pokhara, Nepal", experience: "8 years in grocery wholesale", warehouse: "4,000 sq ft dry storage", area: "Gandaki Province", company: "Demo Grocery Wholesale", status: "APPROVED", ageDays: 1 },
  { ref: "DEMO-0002", kind: "SUPPLIER", category: "mobile-accessories", title: "Looking for a reliable mobile-accessory supplier", description: "Fictional demo lead. A retail chain with 12 outlets wants a long-term supplier of chargers and cables with consistent quality and quick replenishment.", budget: [10000, 30000], location: "Kathmandu, Nepal", experience: "6 years in electronics retail", area: "Bagmati Province", company: "Demo Electronics Retail", status: "APPROVED", ageDays: 3 },
  { ref: "DEMO-0003", kind: "BRAND", category: "skincare-cosmetics", title: "Skincare brands wanted for a salon and pharmacy network", description: "Fictional demo lead. Looking to represent skincare brands across a network of salons and pharmacies, including staff training and in-store display.", budget: [15000, 45000], location: "Lalitpur, Nepal", experience: "Beauty-retail background", warehouse: "1,200 sq ft with cold storage", area: "Kathmandu Valley", status: "APPROVED", ageDays: 6 },
  { ref: "DEMO-0004", kind: "DISTRIBUTOR", category: "auto-parts", title: "Two-wheeler spare-parts distributorship, eastern Nepal", description: "Fictional demo lead. Experienced parts dealer seeking a distributorship for branded two-wheeler spares, with workshop partners across the eastern region.", budget: [40000, 90000], location: "Biratnagar, Nepal", experience: "12 years in auto parts", warehouse: "3,000 sq ft", area: "Koshi Province", company: "Demo Auto Spares", status: "APPROVED", ageDays: 12 },
  { ref: "DEMO-0005", kind: "PRODUCT", category: "beverages", title: "Pending review: beverage requirement", description: "Fictional demo lead awaiting moderation. It must NOT appear publicly.", location: "Kathmandu, Nepal", status: "PENDING_REVIEW", ageDays: 0 },
  { ref: "DEMO-0006", kind: "SUPPLIER", category: "generic-medicines", title: "Rejected: unverifiable requirement", description: "Fictional demo lead rejected by moderation. It must NOT appear publicly.", location: "Kathmandu, Nepal", status: "REJECTED", ageDays: 2 },
];

async function main() {
  const cats = await prisma.category.findMany();
  if (!cats.length) throw new Error("No categories found. Run `npm run db:seed` first.");
  const bySlug = new Map(cats.map((c) => [c.slug, c.id]));

  // Remove previous fixtures only (never touches real records).
  const demoOrgs = await prisma.distributor.findMany({ where: { isDemo: true }, select: { organisationId: true } });
  await prisma.adCampaign.deleteMany({ where: { isDemo: true } });
  await prisma.requirement.deleteMany({ where: { isDemo: true } });
  await prisma.enquiry.deleteMany({ where: { distributor: { isDemo: true } } });
  await prisma.organisation.deleteMany({ where: { id: { in: demoOrgs.map((d) => d.organisationId) } } });

  for (const f of F) {
    const org = await prisma.organisation.create({
      data: {
        name: f.name,
        status: f.variant === "suspended" ? "SUSPENDED" : "ACTIVE",
        profileReviewStatus: f.variant === "draft" ? "DRAFT" : f.variant === "rejected" ? "REJECTED" : "APPROVED",
        notificationEmail: `inbox+${f.slug}@example.test`,
        subscriptionPeriods: {
          create:
            f.variant === "expired"
              ? [{ startsAt: new Date(now - 400 * DAY), endsAt: new Date(now - 1 * DAY) }]
              : [active],
        },
      },
    });
    const status = f.variant === "draft" ? "DRAFT" : f.variant === "rejected" ? "REJECTED" : f.variant === "paused" ? "PAUSED" : "APPROVED";
    const published = !["draft", "rejected", "paused"].includes(f.variant ?? "");
    const d = await prisma.distributor.create({
      data: {
        organisationId: org.id,
        name: f.name,
        slug: f.slug,
        summary: f.summary,
        description: f.description,
        categoryId: bySlug.get(f.category),
        location: f.location,
        city: f.city,
        country: f.country,
        coverage: f.coverage,
        territories: f.territories,
        businessType: f.type,
        website: `https://${f.slug}.example.test`,
        contactPerson: "Business Development Team",
        foundedYear: f.foundedYear ?? null,
        specialties: f.specialties,
        distributorshipInfo: "Open to appointing regional sub-distributors where the territory is not yet covered.",
        minimumOrder: "Discussed per territory",
        supportOffered: "Product training, marketing material and a dedicated account contact.",
        verificationStatus: f.verification,
        investmentMin: f.investment?.[0],
        investmentMax: f.investment?.[1],
        investmentCurrency: f.investment ? "USD" : null,
        status,
        publicationEnabled: published,
        isFeatured: !!f.featured,
        isDemo: true,
      },
    });
    for (const p of f.products) {
      await prisma.product.create({
        data: {
          organisationId: org.id,
          distributorId: d.id,
          name: p.name,
          slug: slugify(p.name),
          publicSlug: `${f.slug}-${slugify(p.name)}`.slice(0, 160),
          description: p.description,
          packaging: p.packaging,
          priceLabel: p.price,
          categoryId: bySlug.get(f.category),
          status: "APPROVED",
          publicationEnabled: true,
        },
      });
    }
  }

  for (const r of R) {
    await prisma.requirement.create({
      data: {
        reference: r.ref,
        slug: r.ref.toLowerCase(),
        idempotencyKey: crypto.randomUUID(),
        kind: r.kind,
        categoryId: bySlug.get(r.category),
        title: r.title,
        description: r.description,
        budgetMin: r.budget?.[0],
        budgetMax: r.budget?.[1],
        budgetCurrency: r.budget ? "USD" : null,
        preferredLocation: r.location,
        experience: r.experience,
        warehouse: r.warehouse,
        distributionArea: r.area,
        contactName: "Demo Contact",
        contactEmail: "demo-lead@example.test",
        contactPhone: "+977 9800000000",
        companyName: r.company,
        contactLocation: r.location,
        consentAt: new Date(),
        status: r.status,
        isDemo: true,
        createdAt: new Date(now - r.ageDays * DAY),
      },
    });
  }

  // ---- Demo advertising. Text creatives only (no stock imagery); fictional advertisers.
  const orgOf = async (slug: string) => (await prisma.distributor.findUniqueOrThrow({ where: { slug }, select: { organisationId: true } })).organisationId;
  const AD = (over: Record<string, unknown>) => ({
    ctaLabel: "Learn more",
    status: "APPROVED" as const,
    paymentVerified: true,
    startsAt: new Date(now - 5 * DAY),
    endsAt: new Date(now + 25 * DAY),
    weight: 1,
    isDemo: true,
    ...over,
  });
  const himal = await orgOf("himal-fresh-foods");
  const lumbini = await orgOf("lumbini-auto-parts-hub");
  const sagarmatha = await orgOf("sagarmatha-pharma-distribution");
  const everest = await orgOf("everest-beverage-traders");
  const gorkha = await orgOf("gorkha-skin-care-imports");
  const expiredOrg = await orgOf("expired-electronics");
  const campaigns = [
    // Served
    AD({ placement: "HOME_HERO_BANNER", organisationId: himal, advertiserName: "Himal Fresh Foods Co.", headline: "Distributorship opportunity: packaged foods", description: "Appointing regional sub-distributors across Gandaki and Lumbini.", ctaLabel: "Become a distributor", imageUrl: "/ads/demo-hero-1.webp", imageAlt: "Himal Fresh Foods: fresh taste on every shelf. Become a distributor.", destinationUrl: "/distributors/himal-fresh-foods" }),
    AD({ placement: "HOME_HERO_BANNER", organisationId: everest, advertiserName: "Everest Beverage Traders", headline: "Cold-chain beverage supply", description: "Bottled water and juices for hotels, cafes and retail.", ctaLabel: "Become a distributor", imageUrl: "/ads/demo-hero-2.webp", imageAlt: "Everest Beverage Traders: thirst has no limits. Become a distributor.", destinationUrl: "/distributors/everest-beverage-traders" }),
    AD({ placement: "HOME_HERO_BANNER", organisationId: sagarmatha, advertiserName: "Sagarmatha Pharma Distribution", headline: "Licensed pharma distribution", description: "Temperature-controlled storage and pharmacy delivery.", ctaLabel: "View company", imageUrl: "/ads/demo-hero-3.webp", imageAlt: "Sagarmatha Pharma: care that reaches far.", destinationUrl: "/distributors/sagarmatha-pharma-distribution" }),
    AD({ placement: "HOME_SPOTLIGHT", organisationId: lumbini, advertiserName: "Lumbini Auto Parts Hub", headline: "Two-wheeler spares: dealers wanted", description: "Branded and aftermarket parts across western Nepal.", ctaLabel: "View company", imageUrl: "/ads/demo-card-1.webp", imageAlt: "Lumbini Auto Parts Hub: dealers wanted. Become a distributor.", destinationUrl: "/distributors/lumbini-auto-parts-hub" }),
    AD({ placement: "HOME_SPOTLIGHT", organisationId: gorkha, advertiserName: "Gorkha Skin & Care Imports", headline: "Grow with skincare", description: "Salon and pharmacy network.", ctaLabel: "View company", imageUrl: "/ads/demo-card-2.webp", imageAlt: "Gorkha Skin Care: grow with skincare. Become a distributor.", destinationUrl: "/distributors/gorkha-skin-care-imports" }),
    AD({ placement: "HOME_FOOTER_BANNER", advertiserName: "Search Distributor demo advertiser", headline: "Ready to reach distributors across your region?", description: "Advertise on the network with clearly labelled, measurable placements.", ctaLabel: "See advertising options", destinationUrl: "/advertising" }),
    AD({ placement: "SEARCH_TOP_BANNER", organisationId: himal, advertiserName: "Himal Fresh Foods Co.", headline: "Looking for a packaged-food partner?", description: "See current distributorship opportunities.", ctaLabel: "View opportunities", destinationUrl: "/leads" }),
    // Must NEVER be served
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Unpaid advertiser", headline: "UNPAID: must not appear", paymentVerified: false, destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Paused advertiser", headline: "PAUSED: must not appear", status: "PAUSED", destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Rejected advertiser", headline: "REJECTED: must not appear", status: "REJECTED", destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Expired advertiser", headline: "EXPIRED: must not appear", startsAt: new Date(now - 40 * DAY), endsAt: new Date(now - 1 * DAY), destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Future advertiser", headline: "NOT STARTED: must not appear", startsAt: new Date(now + 3 * DAY), endsAt: new Date(now + 30 * DAY), destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", organisationId: expiredOrg, advertiserName: "Lapsed-subscription advertiser", headline: "LAPSED SUBSCRIPTION: must not appear", destinationUrl: "/" }),
    AD({ placement: "HOME_HERO_BANNER", advertiserName: "Unsafe destination", headline: "UNSAFE URL: must not appear", destinationUrl: "javascript:alert(1)" }),
  ];
  for (const c of campaigns) await prisma.adCampaign.create({ data: c as never });
  console.log(`Loaded ${campaigns.length} demo ad campaigns (7 live, 7 deliberately not servable).`);
  console.log(`Loaded ${R.length} demo requirements (${R.filter((r) => r.status === "APPROVED").length} approved).`);
  console.log(`Loaded ${F.length} demo records (${F.filter((f) => !f.variant).length} eligible, ${F.filter((f) => f.variant).length} deliberately ineligible).`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
