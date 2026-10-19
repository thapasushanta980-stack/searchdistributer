-- CreateEnum
CREATE TYPE "AnalyticsEventType" AS ENUM ('SEARCH', 'CATEGORY_VIEW', 'LISTING_VIEW', 'PRODUCT_VIEW', 'WHATSAPP_CLICK', 'ENQUIRY', 'REQUIREMENT', 'LEAD');

-- AlterTable
ALTER TABLE "distributors" ADD COLUMN     "whatsappNumber" VARCHAR(24);

-- CreateTable
CREATE TABLE "analytics_events" (
    "id" TEXT NOT NULL,
    "type" "AnalyticsEventType" NOT NULL,
    "visitor" VARCHAR(16) NOT NULL,
    "scope" VARCHAR(20),
    "query" VARCHAR(80),
    "location" VARCHAR(80),
    "categorySlug" VARCHAR(80),
    "resultCount" INTEGER,
    "distributorId" TEXT,
    "productId" TEXT,
    "country" VARCHAR(2),
    "device" VARCHAR(8),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "analytics_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "analytics_events_type_createdAt_idx" ON "analytics_events"("type", "createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_createdAt_idx" ON "analytics_events"("createdAt");

-- CreateIndex
CREATE INDEX "analytics_events_distributorId_type_idx" ON "analytics_events"("distributorId", "type");

