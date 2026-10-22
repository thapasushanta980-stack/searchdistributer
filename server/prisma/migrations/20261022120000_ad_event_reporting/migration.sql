CREATE TYPE "AdEventType" AS ENUM ('IMPRESSION', 'CLICK');

CREATE TABLE "ad_events" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "eventType" "AdEventType" NOT NULL,
    "pageViewId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ad_events_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ad_events_campaignId_eventType_pageViewId_key"
    ON "ad_events"("campaignId", "eventType", "pageViewId");
CREATE INDEX "ad_events_campaignId_createdAt_idx"
    ON "ad_events"("campaignId", "createdAt");

ALTER TABLE "ad_events"
    ADD CONSTRAINT "ad_events_campaignId_fkey"
    FOREIGN KEY ("campaignId") REFERENCES "ad_campaigns"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
