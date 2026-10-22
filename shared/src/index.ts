import { z } from "zod";

/* ------------------------------------------------------------------ */
/* Enumerations (mirrored by the Prisma schema)                        */
/* ------------------------------------------------------------------ */

export const BUSINESS_TYPES = ["DISTRIBUTOR", "WHOLESALER", "IMPORTER", "SUPPLIER", "MANUFACTURER"] as const;
export type BusinessType = (typeof BUSINESS_TYPES)[number];

export const BUSINESS_TYPE_LABELS: Record<BusinessType, string> = {
  DISTRIBUTOR: "Distributor",
  WHOLESALER: "Wholesaler",
  IMPORTER: "Importer",
  SUPPLIER: "Supplier",
  MANUFACTURER: "Manufacturer",
};

export const COVERAGE_SCOPES = ["LOCAL", "NATIONAL", "INTERNATIONAL"] as const;
export type CoverageScope = (typeof COVERAGE_SCOPES)[number];

export const COVERAGE_LABELS: Record<CoverageScope, string> = {
  LOCAL: "Local",
  NATIONAL: "National",
  INTERNATIONAL: "International",
};

/** Verification is a scoped claim: only labels backed by a completed check are shown. */
export const VERIFICATION_STATUSES = ["NONE", "PROFILE_REVIEWED", "VERIFIED"] as const;
export type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

export const VERIFICATION_LABELS: Record<VerificationStatus, string> = {
  NONE: "Unverified",
  PROFILE_REVIEWED: "Profile reviewed",
  VERIFIED: "Verified business",
};

export const SORT_OPTIONS = ["relevance", "newest", "name"] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export const SORT_LABELS: Record<SortOption, string> = {
  relevance: "Most relevant",
  newest: "Newest",
  name: "Company name",
};

export const ENQUIRY_STATUSES = ["PENDING_VERIFICATION", "NEW", "CONTACTED", "CLOSED"] as const;
export const AD_PLACEMENTS = ["HOME_HERO_BANNER", "HOME_SPOTLIGHT", "HOME_FOOTER_BANNER", "SEARCH_TOP_BANNER"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];
export const LEAD_TYPES = ["BUSINESS_REGISTRATION", "REQUIREMENT", "CONTACT", "FIND_DISTRIBUTORS", "BECOME_DISTRIBUTOR", "ADVERTISING"] as const;
/** Lead types where the team must be able to call back, so a phone number is required. */
export const PHONE_REQUIRED_LEAD_TYPES: readonly LeadType[] = ["BUSINESS_REGISTRATION", "FIND_DISTRIBUTORS", "BECOME_DISTRIBUTOR", "ADVERTISING"];
export type LeadType = (typeof LEAD_TYPES)[number];

export const DEFAULT_PAGE_SIZE = 12;
export const MAX_PAGE_SIZE = 48;

/* ------------------------------------------------------------------ */
/* Search query                                                        */
/* ------------------------------------------------------------------ */

const csv = <T extends z.ZodTypeAny>(item: T) =>
  z
    .union([z.string(), z.array(z.string())])
    .optional()
    .transform((v) => (v === undefined ? [] : (Array.isArray(v) ? v : v.split(",")).map((s) => s.trim()).filter(Boolean)))
    .pipe(z.array(item).max(25));

const boolish = z
  .union([z.boolean(), z.enum(["true", "false", "1", "0"])])
  .optional()
  .transform((v) => v === true || v === "true" || v === "1");

const optionalInt = (max: number) =>
  z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
    .pipe(z.number().int().min(0).max(max).optional());

/** Parsed + validated search parameters. The same schema is used for the URL and the API. */
export const distributorSearchSchema = z.object({
  keyword: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  category: csv(z.string().regex(/^[a-z0-9-]+$/).max(80)),
  subcategory: csv(z.string().regex(/^[a-z0-9-]+$/).max(80)),
  location: z
    .string()
    .trim()
    .max(120)
    .optional()
    .transform((v) => v || undefined),
  coverage: csv(z.enum(COVERAGE_SCOPES)),
  businessType: csv(z.enum(BUSINESS_TYPES)),
  verified: boolish,
  reviewed: boolish,
  investmentMin: optionalInt(1_000_000_000),
  investmentMax: optionalInt(1_000_000_000),
  sort: z.enum(SORT_OPTIONS).catch("relevance").default("relevance"),
  page: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => Math.max(1, Math.min(1000, Math.floor(Number(v) || 1)))),
  limit: z
    .union([z.string(), z.number()])
    .optional()
    .transform((v) => Math.max(1, Math.min(MAX_PAGE_SIZE, Math.floor(Number(v) || DEFAULT_PAGE_SIZE)))),
});
export type DistributorSearchParams = z.output<typeof distributorSearchSchema>;

/** Canonical, stable string form of a search (used for query keys and URLs). */
export function searchToQueryString(p: Partial<DistributorSearchParams>): string {
  const sp = new URLSearchParams();
  if (p.keyword) sp.set("keyword", p.keyword);
  if (p.category?.length) sp.set("category", p.category.join(","));
  if (p.subcategory?.length) sp.set("subcategory", p.subcategory.join(","));
  if (p.location) sp.set("location", p.location);
  if (p.coverage?.length) sp.set("coverage", p.coverage.join(","));
  if (p.businessType?.length) sp.set("businessType", p.businessType.join(","));
  if (p.verified) sp.set("verified", "true");
  if (p.reviewed) sp.set("reviewed", "true");
  if (p.investmentMin !== undefined) sp.set("investmentMin", String(p.investmentMin));
  if (p.investmentMax !== undefined) sp.set("investmentMax", String(p.investmentMax));
  if (p.sort && p.sort !== "relevance") sp.set("sort", p.sort);
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  if (p.limit && p.limit !== DEFAULT_PAGE_SIZE) sp.set("limit", String(p.limit));
  return sp.toString();
}

export function parseSearch(input: URLSearchParams | Record<string, unknown>): DistributorSearchParams {
  const obj: Record<string, unknown> = {};
  if (input instanceof URLSearchParams) {
    input.forEach((value, key) => {
      obj[key] = value;
    });
  } else {
    Object.assign(obj, input);
  }
  const parsed = distributorSearchSchema.safeParse(obj);
  if (parsed.success) return parsed.data;
  return distributorSearchSchema.parse({});
}

/* ------------------------------------------------------------------ */
/* Enquiry + lead forms                                                */
/* ------------------------------------------------------------------ */

const phoneRegex = /^[+()\d\s.-]{6,24}$/;

export const enquiryInputSchema = z.object({
  distributorSlug: z.string().regex(/^[a-z0-9-]+$/).max(120),
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .max(24)
    .refine((v) => v === "" || phoneRegex.test(v), "Enter a valid phone number")
    .optional()
    .transform((v) => v || undefined),
  location: z.string().trim().min(2, "Enter your city or country").max(120),
  message: z.string().trim().min(20, "Please write at least 20 characters").max(2000),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required to send this enquiry" }) }),
  idempotencyKey: z.string().uuid(),
});
export type EnquiryInput = z.input<typeof enquiryInputSchema>;

/** Cities offered in location pickers, most active markets first; "Other" lets people type any place. */
export const NEPAL_CITIES = [
  "Kathmandu", "Lalitpur", "Bhaktapur", "Pokhara", "Biratnagar", "Birgunj", "Bharatpur", "Butwal", "Dharan", "Itahari",
  "Hetauda", "Janakpur", "Nepalgunj", "Dhangadhi", "Bhairahawa", "Birtamod", "Damak", "Tulsipur", "Ghorahi", "Birendranagar",
  "Mahendranagar", "Kirtipur", "Banepa", "Dhulikhel", "Tansen", "Baglung", "Gorkha", "Ilam", "Rajbiraj", "Lahan", "Kalaiya", "Gaur",
] as const;
export const OTHER_CITY = "Other";

/** Registration intent is captured separately from the listing's detailed business type. */
export const REGISTRATION_SIDES = ["BRAND", "DISTRIBUTOR"] as const;
export type RegistrationSide = (typeof REGISTRATION_SIDES)[number];
export const REGISTRATION_SIDE_LABELS: Record<RegistrationSide, string> = {
  BRAND: "Brand / Manufacturer",
  DISTRIBUTOR: "Distributor / Wholesaler / Dealer",
};

/** Email and message are optional on business registration and required on every other lead type. */
function leadContactRules(v: { type: LeadType; email?: string; message: string; location?: string }, ctx: z.RefinementCtx) {
  if (v.type !== "BUSINESS_REGISTRATION" && !v.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Enter a valid email address" });
  if (v.type !== "BUSINESS_REGISTRATION" && v.message.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["message"], message: "Please write at least 10 characters" });
  if (v.type === "BUSINESS_REGISTRATION" && !v.location) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["location"], message: "Choose your city" });
}

export const leadInputSchema = z
  .object({
    type: z.enum(LEAD_TYPES),
    registrationSide: z.enum(REGISTRATION_SIDES).optional(),
    adPlacement: z.enum(AD_PLACEMENTS).optional(),
    name: z.string().trim().min(2, "Enter your name").max(100),
    companyName: z
      .string()
      .trim()
      .max(160)
      .optional()
      .transform((v) => v || undefined),
    /** Required except on business registration, where it is optional. */
    email: z
      .string()
      .trim()
      .toLowerCase()
      .max(200)
      .refine((v) => v === "" || z.string().email().safeParse(v).success, "Enter a valid email address")
      .optional()
      .transform((v) => v || undefined),
    phone: z
      .string()
      .trim()
      .max(24)
      .refine((v) => v === "" || phoneRegex.test(v), "Enter a valid phone number")
      .optional()
      .transform((v) => v || undefined),
    categorySlug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    location: z
      .string()
      .trim()
      .max(120)
      .optional()
      .transform((v) => v || undefined),
    /** Required (10+ characters) except on business registration, where it is optional. */
    message: z.string().trim().max(3000),
    consent: z.literal(true, { errorMap: () => ({ message: "Consent is required" }) }),
    idempotencyKey: z.string().uuid(),
    /** Honeypot: real users never fill this in. */
    website: z.string().max(0).optional(),
  })
  .superRefine((v, ctx) => {
    if (PHONE_REQUIRED_LEAD_TYPES.includes(v.type) && !v.phone) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Enter a phone number so we can reach you" });
    }
    leadContactRules(v, ctx);
  });
export type LeadInput = z.input<typeof leadInputSchema>;

/**
 * Same rules for forms where a phone is always required, but with phone as a plain required field.
 * (Cross-field checks only run once every other field is valid, so a form using leadInputSchema would
 * reveal "phone required" only on a second attempt.)
 */
const requiredPhone = z.string().trim().min(1, "Enter a phone number so we can reach you").max(24).regex(phoneRegex, "Enter a valid phone number");

/** Quick requirement forms (find distributors / become a distributor): phone, email and message required. */
export const phoneRequiredLeadSchema = leadInputSchema.innerType().extend({
  phone: requiredPhone,
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  message: z.string().trim().min(10, "Please write at least 10 characters").max(3000),
});

/** Business registration: phone and city required; email and description optional. */
export const registrationLeadSchema = leadInputSchema.innerType().extend({
  companyName: z.string().trim().min(2, "Enter your business name").max(160),
  phone: requiredPhone,
  location: z.string().trim().min(1, "Choose your city").max(120),
  registrationSide: z.enum(REGISTRATION_SIDES),
});

/** Advertising requests are short: business contact, callback number, placement, and optional note. */
export const advertisingLeadSchema = leadInputSchema.innerType().extend({
  companyName: z.string().trim().min(2, "Enter your business name").max(160),
  phone: requiredPhone,
  adPlacement: z.enum(AD_PLACEMENTS),
  message: z.string().trim().max(3000),
});

/* ------------------------------------------------------------------ */
/* API payload types                                                   */
/* ------------------------------------------------------------------ */

export interface CategoryDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  parentId: string | null;
  /** Count of publicly eligible distributors in this category (incl. children for parents). */
  distributorCount: number;
  children: CategoryDTO[];
}

export interface DistributorCardDTO {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  summary: string;
  category: { slug: string; name: string } | null;
  location: string;
  country: string | null;
  businessType: BusinessType;
  coverage: CoverageScope;
  verificationStatus: VerificationStatus;
  specialties: string[];
  isFeatured: boolean;
  isDemo: boolean;
  investmentMin: number | null;
  investmentMax: number | null;
  investmentCurrency: string | null;
  productCount: number;
  /** Up to three published product names, for card previews. */
  productPreview: string[];
  /** A WhatsApp chat is available through /go/whatsapp/:slug. */
  hasWhatsapp: boolean;
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  category: { slug: string; name: string } | null;
  packaging: string | null;
  priceLabel: string | null;
}

export interface DistributorDetailDTO extends DistributorCardDTO {
  coverImageUrl: string | null;
  galleryImageUrls: string[];
  description: string;
  website: string | null;
  contactPerson: string | null;
  territories: string[];
  distributorshipInfo: string | null;
  minimumOrder: string | null;
  supportOffered: string | null;
  foundedYear: number | null;
  products: ProductDTO[];
  related: DistributorCardDTO[];
  updatedAt: string;
}

export interface PaginationDTO {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface DistributorListResponse {
  data: DistributorCardDTO[];
  pagination: PaginationDTO;
}

export interface FacetsResponse {
  investment: { min: number; max: number; currency: string } | null;
  total: number;
}

export interface FeaturedResponse {
  data: DistributorCardDTO[];
}

export interface SuggestResponse {
  data: Array<{ type: "distributor" | "category" | "location"; label: string; value: string; href?: string }>;
}

export interface EnquiryResponse {
  reference: string;
  status: "NEW" | "PENDING_VERIFICATION";
  /** True when the sender must confirm their email before the brand receives the enquiry. */
  requiresEmailVerification: boolean;
}

export interface LeadResponse {
  reference: string;
}

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    fields?: Record<string, string>;
  };
}

/* ------------------------------------------------------------------ */
/* Products list                                                       */
/* ------------------------------------------------------------------ */

export interface ProductListItemDTO {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  packaging: string | null;
  priceLabel: string | null;
  category: { slug: string; name: string } | null;
  distributor: { slug: string; name: string; location: string };
}

export interface ProductListResponse {
  data: ProductListItemDTO[];
  pagination: PaginationDTO;
}

/* ------------------------------------------------------------------ */
/* Data access contract. The browser implements it with fetch(), the   */
/* SSR renderer with direct service calls, so pages are written once.  */
/* ------------------------------------------------------------------ */

export interface ApiClient {
  listDistributors(params: DistributorSearchParams, signal?: AbortSignal): Promise<DistributorListResponse>;
  getDistributor(slug: string, signal?: AbortSignal): Promise<DistributorDetailDTO | null>;
  getCategories(signal?: AbortSignal): Promise<CategoryDTO[]>;
  getFeatured(signal?: AbortSignal): Promise<DistributorCardDTO[]>;
  getFacets(signal?: AbortSignal): Promise<FacetsResponse>;
  suggest(q: string, signal?: AbortSignal): Promise<SuggestResponse>;
  listProducts(params: ProductSearchParams, signal?: AbortSignal): Promise<ProductListResponse>;
  getProduct(slug: string, signal?: AbortSignal): Promise<ProductDetailDTO | null>;
  listRequirements(params: RequirementSearchParams, signal?: AbortSignal): Promise<RequirementListResponse>;
  getRequirement(slug: string, signal?: AbortSignal): Promise<RequirementDetailDTO | null>;
  listAds(placement: AdPlacement, signal?: AbortSignal): Promise<AdDTO[]>;
}

/* ------------------------------------------------------------------ */
/* Per-page document head                                              */
/* ------------------------------------------------------------------ */

export interface HeadSpec {
  title: string;
  description: string;
  /** Absolute canonical URL. */
  canonical: string;
  /** e.g. "index,follow" or "noindex,follow". */
  robots: string;
  ogType?: "website" | "article" | "profile";
  ogImage?: string;
  /** HTTP status the server should respond with (404 for unavailable records). */
  status?: number;
  jsonLd?: Array<Record<string, unknown>>;
}

export interface SiteConfigDTO {
  siteUrl: string;
  siteName: string;
  supportEmail: string | null;
  /** The team's phone, shown on the site. */
  supportPhone: string | null;
  /** A "Chat with us" WhatsApp button is available through /go/support. */
  supportWhatsapp: boolean;
  twitter: string | null;
  editor: { name: string; role: string | null; bio: string } | null;
  showDemoData: boolean;
  defaultCurrency: string;
  emailVerificationRequired: boolean;
}

/* ------------------------------------------------------------------ */
/* Products: search + detail                                           */
/* ------------------------------------------------------------------ */

export interface ProductSearchParams {
  page: number;
  keyword?: string;
  category?: string;
}

export function parseProductSearch(input: URLSearchParams): ProductSearchParams {
  const slug = input.get("category") ?? "";
  return {
    page: Math.max(1, Math.min(1000, Math.floor(Number(input.get("page"))) || 1)),
    keyword: (input.get("keyword") ?? "").trim().slice(0, 120) || undefined,
    category: /^[a-z0-9-]{1,80}$/.test(slug) ? slug : undefined,
  };
}

export interface ProductDetailDTO {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  description: string | null;
  imageUrls: string[];
  packaging: string | null;
  priceLabel: string | null;
  category: { slug: string; name: string } | null;
  distributor: DistributorCardDTO;
  related: ProductListItemDTO[];
  updatedAt: string;
}

/* ------------------------------------------------------------------ */
/* Requirements (distributor leads)                                    */
/* ------------------------------------------------------------------ */

export const REQUIREMENT_KINDS = ["DISTRIBUTOR", "PRODUCT", "SUPPLIER", "BRAND"] as const;
export type RequirementKind = (typeof REQUIREMENT_KINDS)[number];
export const REQUIREMENT_KIND_LABELS: Record<RequirementKind, string> = {
  DISTRIBUTOR: "Distributor",
  PRODUCT: "Product",
  SUPPLIER: "Supplier",
  BRAND: "Brand",
};

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || undefined);

const optionalMoney = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v) => (v === undefined || v === "" ? undefined : Number(v)))
  .pipe(z.number().int("Enter a whole number").min(0, "Must be 0 or more").max(1_000_000_000).optional());

/** Full post-requirement form. The wizard validates it step by step with `trigger(fields)`. */
export const requirementInputSchema = z
  .object({
    // Step 1: your information
    contactName: z.string().trim().min(2, "Enter your full name").max(100),
    contactPhone: z.string().trim().regex(phoneRegex, "Enter a valid phone number"),
    contactEmail: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
    companyName: optionalText(160),
    contactLocation: z.string().trim().min(2, "Enter your city or country").max(120),
    // Step 2: requirement
    kind: z.enum(REQUIREMENT_KINDS, { errorMap: () => ({ message: "Choose what you are looking for" }) }),
    categorySlug: z
      .string()
      .regex(/^[a-z0-9-]+$/)
      .max(80)
      .optional()
      .or(z.literal("").transform(() => undefined)),
    title: z.string().trim().min(5, "Add a short title (at least 5 characters)").max(120),
    description: z.string().trim().min(20, "Please write at least 20 characters").max(2000),
    budgetMin: optionalMoney,
    budgetMax: optionalMoney,
    preferredLocation: z.string().trim().min(2, "Enter the preferred location").max(160),
    // Step 3: distribution details
    experience: optionalText(300),
    warehouse: optionalText(300),
    distributionArea: optionalText(300),
    additional: optionalText(1000),
    // Step 4: review
    consent: z.literal(true, { errorMap: () => ({ message: "You must agree to the Terms and Privacy Policy" }) }),
    idempotencyKey: z.string().uuid(),
    /** Honeypot. */
    website: z.string().max(0).optional(),
  })
  .refine((v) => v.budgetMin === undefined || v.budgetMax === undefined || v.budgetMax >= v.budgetMin, {
    path: ["budgetMax"],
    message: "Maximum budget must be at least the minimum",
  });
export type RequirementInput = z.input<typeof requirementInputSchema>;

export const REQUIREMENT_STEP_FIELDS = [
  ["contactName", "contactPhone", "contactEmail", "companyName", "contactLocation"],
  ["kind", "categorySlug", "title", "description", "budgetMin", "budgetMax", "preferredLocation"],
  ["experience", "warehouse", "distributionArea", "additional"],
  ["consent"],
] as const;

export const requirementResponseSchema = z.object({
  name: z.string().trim().min(2, "Enter your name").max(100),
  email: z.string().trim().toLowerCase().email("Enter a valid email address").max(200),
  phone: z
    .string()
    .trim()
    .max(24)
    .refine((v) => v === "" || phoneRegex.test(v), "Enter a valid phone number")
    .optional()
    .transform((v) => v || undefined),
  location: z.string().trim().min(2, "Enter your city or country").max(120),
  message: z.string().trim().min(20, "Please write at least 20 characters").max(2000),
  consent: z.literal(true, { errorMap: () => ({ message: "Consent is required to send this enquiry" }) }),
  idempotencyKey: z.string().uuid(),
});
export type RequirementResponseInput = z.input<typeof requirementResponseSchema>;

export interface RequirementSearchParams {
  keyword?: string;
  category?: string;
  location?: string;
  kind?: RequirementKind;
  /** Only leads whose budget range reaches at least this amount. */
  budgetMin?: number;
  page: number;
}

export function parseRequirementSearch(input: URLSearchParams): RequirementSearchParams {
  const kind = input.get("kind") ?? "";
  const cat = input.get("category") ?? "";
  const budget = Number(input.get("budgetMin"));
  return {
    keyword: (input.get("keyword") ?? "").trim().slice(0, 120) || undefined,
    category: /^[a-z0-9-]{1,80}$/.test(cat) ? cat : undefined,
    location: (input.get("location") ?? "").trim().slice(0, 120) || undefined,
    kind: (REQUIREMENT_KINDS as readonly string[]).includes(kind) ? (kind as RequirementKind) : undefined,
    budgetMin: Number.isFinite(budget) && budget > 0 ? Math.floor(Math.min(budget, 1_000_000_000)) : undefined,
    page: Math.max(1, Math.min(1000, Math.floor(Number(input.get("page"))) || 1)),
  };
}

export function requirementQueryString(p: Partial<RequirementSearchParams>): string {
  const sp = new URLSearchParams();
  if (p.keyword) sp.set("keyword", p.keyword);
  if (p.category) sp.set("category", p.category);
  if (p.location) sp.set("location", p.location);
  if (p.kind) sp.set("kind", p.kind);
  if (p.budgetMin) sp.set("budgetMin", String(p.budgetMin));
  if (p.page && p.page > 1) sp.set("page", String(p.page));
  return sp.toString();
}

export interface RequirementCardDTO {
  id: string;
  slug: string;
  kind: RequirementKind;
  title: string;
  summary: string;
  category: { slug: string; name: string } | null;
  /** Company name if the poster gave one; contact details are never exposed. */
  poster: string | null;
  preferredLocation: string;
  budgetMin: number | null;
  budgetMax: number | null;
  budgetCurrency: string | null;
  experience: string | null;
  distributionArea: string | null;
  isNew: boolean;
  isDemo: boolean;
  createdAt: string;
}

export interface RequirementDetailDTO extends RequirementCardDTO {
  description: string;
  warehouse: string | null;
  additional: string | null;
  related: RequirementCardDTO[];
}

export interface RequirementListResponse {
  data: RequirementCardDTO[];
  pagination: PaginationDTO;
}

export interface RequirementSubmitResponse {
  reference: string;
}

/* ------------------------------------------------------------------ */
/* Advertising                                                         */
/* ------------------------------------------------------------------ */

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  HOME_HERO_BANNER: "Hero promotional banner",
  HOME_SPOTLIGHT: "Spotlight (paired cards)",
  HOME_FOOTER_BANNER: "Footer promotional banner",
  SEARCH_TOP_BANNER: "Search results banner",
};

/** What a visitor sees. Contains no pricing, notes or private advertiser data. */
export interface AdDTO {
  id: string;
  placement: AdPlacement;
  advertiser: string;
  headline: string;
  description: string | null;
  ctaLabel: string;
  imageUrl: string | null;
  imageAlt: string | null;
  /** Counted redirect to the advertiser's destination. */
  href: string;
  isDemo: boolean;
}

/* ------------------------------------------------------------------ */
/* Admin (back office)                                                 */
/* ------------------------------------------------------------------ */

export const ADMIN_ROLES = ["SUPER_ADMIN", "MODERATOR"] as const;
export type AdminRole = (typeof ADMIN_ROLES)[number];

export const adminLoginSchema = z.object({
  email: z.string().trim().email().max(200),
  password: z.string().min(1).max(200),
});

/** Approve or reject something in a moderation queue. A reason is required to reject. */
export const moderationDecisionSchema = z
  .object({
    decision: z.enum(["APPROVE", "REJECT"]),
    reason: z.string().trim().max(500).optional(),
  })
  .refine((v) => v.decision === "APPROVE" || !!v.reason, { path: ["reason"], message: "Give a reason when rejecting." });
export type ModerationDecision = z.output<typeof moderationDecisionSchema>;

export interface AdminMeDTO {
  id: string;
  email: string;
  name: string;
  role: AdminRole;
}

export interface AdminStatsDTO {
  leadsNew: number;
  enquiriesNew: number;
  adsLive: number;
  listingsLive: number;
  requirementsPending: number;
  listingsPending: number;
  productsPending: number;
  adsPending: number;
  enquiriesAwaitingVerification: number;
  outboxFailed: number;
  leadsLast7Days: number;
}

/** Full record for moderators: includes the private contact snapshot that is never public. */
export interface AdminRequirementDTO {
  id: string;
  reference: string;
  slug: string;
  kind: RequirementKind;
  title: string;
  description: string;
  status: "PENDING_REVIEW" | "APPROVED" | "REJECTED" | "CLOSED";
  category: { slug: string; name: string } | null;
  contactName: string;
  contactEmail: string;
  contactPhone: string;
  companyName: string | null;
  responseCount: number;
  createdAt: string;
}

export interface AdminAuditDTO {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  admin: { name: string; email: string } | null;
  ip: string | null;
  createdAt: string;
}

/* ------------------------------------------------------------------ */
/* Admin modules: inbox, enquiries, listings, products, advertising    */
/* ------------------------------------------------------------------ */

export const ADMIN_PAGE_SIZE = 20;

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

const httpsUrl = z
  .string()
  .trim()
  .max(500)
  .url("Enter a full link starting with https://")
  .refine((v) => /^https:\/\//i.test(v), "Use a secure https:// link");

const optHttpsUrl = z
  .union([httpsUrl, z.literal(""), z.null()])
  .optional()
  .transform((v) => (v ? v : null));

const httpsUrlList = z.array(httpsUrl).max(12).default([]);

const isoDate = z.string().datetime({ offset: true, message: "Enter a valid date" });

/** Leads: the contact and registration form inbox. */
export const LEAD_STATUSES = ["NEW", "CONTACTED", "CONVERTED", "CLOSED"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  NEW: "New",
  CONTACTED: "Contacted",
  CONVERTED: "Converted",
  CLOSED: "Closed",
};

export const LEAD_TYPE_LABELS: Record<LeadType, string> = {
  BUSINESS_REGISTRATION: "Business registration",
  ADVERTISING: "Advertising request",
  REQUIREMENT: "Requirement",
  CONTACT: "Contact message",
  FIND_DISTRIBUTORS: "Brand seeking distributors",
  BECOME_DISTRIBUTOR: "Wants a distributorship",
};

export interface AdminLeadDTO {
  id: string;
  reference: string;
  type: LeadType;
  registrationSide?: RegistrationSide | null;
  adPlacement?: AdPlacement | null;
  status: LeadStatus;
  name: string;
  companyName: string | null;
  email: string | null;
  phone: string | null;
  categorySlug: string | null;
  location: string | null;
  message: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export const adminLeadUpdateSchema = z
  .object({ status: z.enum(LEAD_STATUSES).optional(), notes: optText(2000) })
  .refine((v) => v.status !== undefined || v.notes !== undefined, { message: "Nothing to update." });
export type AdminLeadUpdate = z.output<typeof adminLeadUpdateSchema>;
/** What the client sends: either field may be left out. */
export type AdminLeadUpdateRequest = z.input<typeof adminLeadUpdateSchema>;

/** Enquiries: visitor messages sent to a listing. */
export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number];

export const ENQUIRY_STATUS_LABELS: Record<EnquiryStatus, string> = {
  PENDING_VERIFICATION: "Awaiting email confirmation",
  NEW: "New",
  CONTACTED: "Contacted",
  CLOSED: "Closed",
};

export interface AdminEnquiryDTO {
  id: string;
  reference: string;
  status: EnquiryStatus;
  spamFlag: boolean;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  senderLocation: string;
  message: string;
  distributor: { id: string; name: string; slug: string };
  createdAt: string;
  verifiedAt: string | null;
}

/** Only the sender can confirm an enquiry, so admins move it between the worked states. */
export const adminEnquiryUpdateSchema = z
  .object({ status: z.enum(["NEW", "CONTACTED", "CLOSED"]).optional(), spamFlag: z.boolean().optional() })
  .refine((v) => v.status !== undefined || v.spamFlag !== undefined, { message: "Nothing to update." });
export type AdminEnquiryUpdate = z.output<typeof adminEnquiryUpdateSchema>;

/** Requirements: close or reopen after moderation, and the responses businesses sent. */
export const adminRequirementStatusSchema = z.object({ status: z.enum(["APPROVED", "CLOSED"]) });

export interface AdminRequirementResponseDTO {
  id: string;
  reference: string;
  senderName: string;
  senderEmail: string;
  senderPhone: string | null;
  senderLocation: string;
  message: string;
  createdAt: string;
}

/** Listings (distributors and brands) managed from the back office. */
export const LISTING_STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "PAUSED", "ARCHIVED"] as const;
export type ListingStatus = (typeof LISTING_STATUSES)[number];

export const LISTING_STATUS_LABELS: Record<ListingStatus, string> = {
  DRAFT: "Draft",
  SUBMITTED: "Awaiting review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  PAUSED: "Paused",
  ARCHIVED: "Archived",
};

/** Each condition a listing must meet to be visible on the public site. */
export interface ListingVisibilityDTO {
  approved: boolean;
  published: boolean;
  organisationActive: boolean;
  profileApproved: boolean;
  subscriptionActive: boolean;
  isPublic: boolean;
}

export interface AdminListingSummaryDTO {
  id: string;
  name: string;
  slug: string;
  businessType: BusinessType;
  status: ListingStatus;
  verificationStatus: VerificationStatus;
  isFeatured: boolean;
  category: { id: string; name: string } | null;
  location: string;
  listedUntil: string | null;
  isPublic: boolean;
  productCount: number;
  enquiryCount: number;
  updatedAt: string;
}

export interface AdminProductDTO {
  id: string;
  name: string;
  publicSlug: string;
  description: string | null;
  imageUrls: string[];
  categoryId: string | null;
  packaging: string | null;
  priceLabel: string | null;
  published: boolean;
  updatedAt: string;
}

export const adminListingInputSchema = z
  .object({
    name: z.string().trim().min(2, "Enter the company name").max(120),
    businessType: z.enum(BUSINESS_TYPES),
    summary: z.string().trim().min(10, "Write at least a short sentence").max(300),
    description: z.string().trim().min(20, "Describe the business in a few sentences").max(5000),
    categoryId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
    location: z.string().trim().min(2, "Enter where the business is based").max(120),
    city: z.string().trim().min(1, "Choose a city").max(80),
    country: optText(80),
    coverage: z.enum(COVERAGE_SCOPES),
    territories: z.array(z.string().trim().min(1).max(80)).max(50).default([]),
    specialties: z.array(z.string().trim().min(1).max(80)).max(30).default([]),
    website: optHttpsUrl,
    logoUrl: optHttpsUrl,
    coverImageUrl: optHttpsUrl,
    galleryImageUrls: httpsUrlList,
    contactPerson: optText(120),
    whatsappNumber: z
      .union([z.string().trim().regex(phoneRegex, "Enter a valid WhatsApp number, e.g. +977 98XXXXXXXX"), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v : null)),
    notificationEmail: z
      .union([z.string().trim().email("Enter a valid email").max(200), z.literal(""), z.null()])
      .optional()
      .transform((v) => (v ? v.toLowerCase() : null)),
    foundedYear: z.number().int().min(1800).max(new Date().getFullYear()).nullable().optional().transform((v) => v ?? null),
    distributorshipInfo: optText(2000),
    minimumOrder: optText(300),
    supportOffered: optText(1000),
    investmentMin: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
    investmentMax: z.number().int().min(0).nullable().optional().transform((v) => v ?? null),
    investmentCurrency: z.string().trim().length(3).toUpperCase().nullable().optional().transform((v) => v ?? null),
    verificationStatus: z.enum(VERIFICATION_STATUSES),
    isFeatured: z.boolean().default(false),
    featuredUntil: isoDate.nullable().optional().transform((v) => v ?? null),
    /** End of the paid listing period. Required to go live. */
    listedUntil: isoDate.nullable().optional().transform((v) => v ?? null),
    /** Lead this listing was created from; marked CONVERTED on save. */
    fromLeadId: z.string().uuid().optional(),
  })
  .refine((v) => v.investmentMin === null || v.investmentMax === null || v.investmentMin <= v.investmentMax, {
    path: ["investmentMax"],
    message: "Maximum must be at least the minimum",
  });
export type AdminListingInput = z.output<typeof adminListingInputSchema>;

export interface AdminListingDTO extends Omit<AdminListingInput, "fromLeadId"> {
  id: string;
  slug: string;
  status: ListingStatus;
  visibility: ListingVisibilityDTO;
  products: AdminProductDTO[];
  enquiryCount: number;
  createdAt: string;
  updatedAt: string;
}

/** PUBLISH makes a listing live (needs a future listedUntil); the others take it off the site. */
export const adminListingActionSchema = z
  .object({ action: z.enum(["PUBLISH", "PAUSE", "ARCHIVE", "REJECT"]), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.action !== "REJECT" || !!v.reason, { path: ["reason"], message: "Give a reason when rejecting." });
export type AdminListingAction = z.output<typeof adminListingActionSchema>;

export const adminProductInputSchema = z.object({
  name: z.string().trim().min(2, "Enter the product name").max(120),
  description: optText(2000),
  imageUrls: z.array(httpsUrl).max(8).default([]),
  categoryId: z.string().uuid().nullable().optional().transform((v) => v ?? null),
  packaging: optText(200),
  priceLabel: optText(80),
  published: z.boolean().default(true),
});
export type AdminProductInput = z.output<typeof adminProductInputSchema>;

/** Advertising campaigns. */
export const AD_STATUSES = ["DRAFT", "PENDING_REVIEW", "APPROVED", "PAUSED", "REJECTED", "COMPLETED"] as const;
export type AdStatus = (typeof AD_STATUSES)[number];

export const AD_STATUS_LABELS: Record<AdStatus, string> = {
  DRAFT: "Draft",
  PENDING_REVIEW: "Awaiting review",
  APPROVED: "Approved",
  PAUSED: "Paused",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const adminAdInputSchema = z
  .object({
    placement: z.enum(AD_PLACEMENTS),
    advertiserName: z.string().trim().min(2, "Enter the advertiser").max(120),
    headline: z.string().trim().min(3, "Enter a headline").max(120),
    description: optText(300),
    ctaLabel: z.string().trim().min(2).max(40).default("Learn more"),
    destinationUrl: httpsUrl,
    imageUrl: optHttpsUrl,
    imageAlt: optText(200),
    startsAt: isoDate,
    endsAt: isoDate,
    weight: z.number().int().min(1).max(10).default(1),
    paymentVerified: z.boolean().default(false),
    internalNotes: optText(2000),
    fromLeadId: z.string().uuid().optional(),
  })
  .refine((v) => new Date(v.endsAt) > new Date(v.startsAt), { path: ["endsAt"], message: "End must be after the start" })
  .refine((v) => !v.imageUrl || !!v.imageAlt, { path: ["imageAlt"], message: "Describe the image for screen readers" });
export type AdminAdInput = z.output<typeof adminAdInputSchema>;

export interface AdminAdDTO extends Omit<AdminAdInput, "fromLeadId"> {
  id: string;
  status: AdStatus;
  impressions: number;
  clicks: number;
  /** Showing on the site right now: approved, paid and inside its dates. */
  isLive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const adminAdActionSchema = z
  .object({ action: z.enum(["APPROVE", "REJECT", "PAUSE", "RESUME"]), reason: z.string().trim().max(500).optional() })
  .refine((v) => v.action !== "REJECT" || !!v.reason, { path: ["reason"], message: "Give a reason when rejecting." });
export type AdminAdAction = z.output<typeof adminAdActionSchema>;

export interface AdminPage<T> {
  data: T[];
  pagination: PaginationDTO;
}

/* ------------------------------------------------------------------ */
/* Analytics                                                           */
/* ------------------------------------------------------------------ */

export const SEARCH_SCOPES = ["distributors", "brands", "products", "leads"] as const;
export type SearchScope = (typeof SEARCH_SCOPES)[number];

/** Events the browser may report. Contacts (WhatsApp, enquiries, forms) are recorded by the server itself. */
export const trackEventSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("SEARCH"),
    scope: z.enum(SEARCH_SCOPES),
    query: z.string().trim().max(200).optional(),
    location: z.string().trim().max(200).optional(),
    categorySlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional(),
    resultCount: z.number().int().min(0).max(1_000_000),
  }),
  z.object({ type: z.literal("CATEGORY_VIEW"), categorySlug: z.string().regex(/^[a-z0-9-]+$/).max(80) }),
  z.object({ type: z.literal("LISTING_VIEW"), distributorId: z.string().uuid(), categorySlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional() }),
  z.object({ type: z.literal("PRODUCT_VIEW"), productId: z.string().uuid(), distributorId: z.string().uuid(), categorySlug: z.string().regex(/^[a-z0-9-]+$/).max(80).optional() }),
]);
export type TrackEvent = z.input<typeof trackEventSchema>;

export const ANALYTICS_RANGES = [7, 30, 90] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export interface AnalyticsKpi {
  current: number;
  previous: number;
}

export interface AnalyticsDTO {
  range: AnalyticsRange;
  timezone: string;
  kpis: {
    visitors: AnalyticsKpi;
    searches: AnalyticsKpi;
    /** Searches that returned nothing, as a share of all searches (0..1). */
    zeroResultRate: AnalyticsKpi;
    listingViews: AnalyticsKpi;
    whatsappClicks: AnalyticsKpi;
    enquiries: AnalyticsKpi;
    /** (WhatsApp clicks + enquiries) / listing views (0..1). */
    contactRate: AnalyticsKpi;
    newLeads: AnalyticsKpi;
  };
  /** One row per day in the site's timezone, oldest first, including empty days. */
  daily: Array<{ date: string; visitors: number; searches: number; listingViews: number; contacts: number }>;
  /** Activity by weekday (0 = Sunday) and hour, in the site's timezone. */
  heatmap: Array<{ dow: number; hour: number; count: number }>;
  topSearches: Array<{ query: string; count: number; avgResults: number; zeroResults: number }>;
  /** Searched for, never found: who to recruit next. */
  unmetSearches: Array<{ query: string; location: string | null; count: number; lastAt: string }>;
  topLocations: Array<{ location: string; count: number }>;
  /** Demand (searches + category views + listing views) against supply (listings on the site). */
  categories: Array<{ slug: string; name: string; parentName: string | null; searches: number; views: number; contacts: number; liveListings: number }>;
  topListings: Array<{ id: string; name: string; slug: string | null; views: number; whatsapp: number; enquiries: number }>;
  devices: Array<{ device: string; count: number }>;
  countries: Array<{ country: string; count: number }>;
}
