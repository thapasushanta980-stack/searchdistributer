-- CreateEnum
CREATE TYPE "RequirementKind" AS ENUM ('DISTRIBUTOR', 'PRODUCT', 'SUPPLIER', 'BRAND');

-- CreateEnum
CREATE TYPE "RequirementStatus" AS ENUM ('PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CLOSED');

-- AlterTable: public product slug, backfilled for existing rows before it becomes required
ALTER TABLE "products" ADD COLUMN "publicSlug" TEXT;
UPDATE "products" p SET "publicSlug" = d."slug" || '-' || p."slug" FROM "distributors" d WHERE d."id" = p."distributorId";
ALTER TABLE "products" ALTER COLUMN "publicSlug" SET NOT NULL;
CREATE UNIQUE INDEX "products_publicSlug_key" ON "products"("publicSlug");

-- CreateTable
CREATE TABLE "requirements" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "kind" "RequirementKind" NOT NULL,
    "categoryId" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "budgetMin" INTEGER,
    "budgetMax" INTEGER,
    "budgetCurrency" VARCHAR(3),
    "preferredLocation" TEXT NOT NULL,
    "experience" TEXT,
    "warehouse" TEXT,
    "distributionArea" TEXT,
    "additional" TEXT,
    "contactName" TEXT NOT NULL,
    "contactEmail" TEXT NOT NULL,
    "contactPhone" TEXT NOT NULL,
    "companyName" TEXT,
    "contactLocation" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "status" "RequirementStatus" NOT NULL DEFAULT 'PENDING_REVIEW',
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "requirement_responses" (
    "id" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requirementId" TEXT NOT NULL,
    "senderName" TEXT NOT NULL,
    "senderEmail" TEXT NOT NULL,
    "senderPhone" TEXT,
    "senderLocation" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "consentAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "requirement_responses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "requirements_reference_key" ON "requirements"("reference");
CREATE UNIQUE INDEX "requirements_slug_key" ON "requirements"("slug");
CREATE UNIQUE INDEX "requirements_idempotencyKey_key" ON "requirements"("idempotencyKey");
CREATE INDEX "requirements_status_createdAt_idx" ON "requirements"("status", "createdAt");
CREATE INDEX "requirements_categoryId_idx" ON "requirements"("categoryId");
CREATE UNIQUE INDEX "requirement_responses_reference_key" ON "requirement_responses"("reference");
CREATE UNIQUE INDEX "requirement_responses_idempotencyKey_key" ON "requirement_responses"("idempotencyKey");
CREATE INDEX "requirement_responses_requirementId_idx" ON "requirement_responses"("requirementId");

-- AddForeignKey
ALTER TABLE "requirements" ADD CONSTRAINT "requirements_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "requirement_responses" ADD CONSTRAINT "requirement_responses_requirementId_fkey" FOREIGN KEY ("requirementId") REFERENCES "requirements"("id") ON DELETE CASCADE ON UPDATE CASCADE;
