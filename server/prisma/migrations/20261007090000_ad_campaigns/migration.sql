-- CreateEnum
CREATE TYPE "AdPlacementCode" AS ENUM ('HOME_HERO_BANNER', 'HOME_SPOTLIGHT', 'HOME_FOOTER_BANNER', 'SEARCH_TOP_BANNER');

-- CreateEnum
CREATE TYPE "AdStatus" AS ENUM ('DRAFT', 'PENDING_REVIEW', 'APPROVED', 'PAUSED', 'REJECTED', 'COMPLETED');

-- CreateTable
CREATE TABLE "ad_campaigns" (
    "id" TEXT NOT NULL,
    "placement" "AdPlacementCode" NOT NULL,
    "organisationId" TEXT,
    "advertiserName" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "description" TEXT,
    "ctaLabel" TEXT NOT NULL DEFAULT 'Learn more',
    "destinationUrl" TEXT NOT NULL,
    "imageUrl" TEXT,
    "imageAlt" TEXT,
    "status" "AdStatus" NOT NULL DEFAULT 'DRAFT',
    "paymentVerified" BOOLEAN NOT NULL DEFAULT false,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "weight" INTEGER NOT NULL DEFAULT 1,
    "impressions" INTEGER NOT NULL DEFAULT 0,
    "clicks" INTEGER NOT NULL DEFAULT 0,
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ad_campaigns_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ad_campaigns_placement_status_startsAt_endsAt_idx" ON "ad_campaigns"("placement", "status", "startsAt", "endsAt");

-- AddForeignKey
ALTER TABLE "ad_campaigns" ADD CONSTRAINT "ad_campaigns_organisationId_fkey" FOREIGN KEY ("organisationId") REFERENCES "organisations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
