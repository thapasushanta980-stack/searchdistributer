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
export const LEAD_TYPES = ["BUSINESS_REGISTRATION", "REQUIREMENT", "CONTACT"] as const;
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

export const leadInputSchema = z.object({
  type: z.enum(LEAD_TYPES),
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
}).superRefine((v, ctx) => {
  if (v.type === "BUSINESS_REGISTRATION" && !v.phone) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["phone"], message: "Enter your phone number" });
  if (v.type !== "BUSINESS_REGISTRATION" && !v.email) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["email"], message: "Enter a valid email address" });
  if (v.type !== "BUSINESS_REGISTRATION" && v.message.length < 10) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["message"], message: "Please write at least 10 characters" });
});
export type LeadInput = z.input<typeof leadInputSchema>;

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
  createdAt: string;
}

export interface ProductDTO {
  id: string;
  slug: string;
  publicSlug: string;
  name: string;
  description: string | null;
  category: { slug: string; name: string } | null;
  packaging: string | null;
  priceLabel: string | null;
}

export interface DistributorDetailDTO extends DistributorCardDTO {
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

export const AD_PLACEMENTS = ["HOME_HERO_BANNER", "HOME_SPOTLIGHT", "HOME_FOOTER_BANNER", "SEARCH_TOP_BANNER"] as const;
export type AdPlacement = (typeof AD_PLACEMENTS)[number];

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
  createdAt: string;
}

export interface AdminAuditDTO {
  id: string;
  action: string;
  entityType: string | null;
  entityId: string | null;
  meta: unknown;
  admin: { name: string; email: string } | null;
  createdAt: string;
}
