import { Prisma } from "@prisma/client";
import { config } from "../../config.js";

/**
 * The single definition of "publicly discoverable" (PRD: publication eligibility).
 * Evaluated against the current timestamp on every request, so a delayed expiry job
 * can never keep expired content live.
 *
 * Requires aliases: d = distributors, o = organisations.
 */
export function eligibleDistributorSql(now: Date = new Date()): Prisma.Sql {
  return Prisma.sql`
    d."status" = 'APPROVED'
    AND d."publicationEnabled" = true
    AND o."status" = 'ACTIVE'
    AND o."profileReviewStatus" = 'APPROVED'
    AND EXISTS (
      SELECT 1 FROM "subscription_periods" sp
      WHERE sp."organisationId" = o."id" AND sp."startsAt" <= ${now} AND sp."endsAt" > ${now}
    )
    ${config.SHOW_DEMO_DATA ? Prisma.empty : Prisma.sql`AND d."isDemo" = false`}
  `;
}

/** Same rule for products: the product itself and its parent listing must both be public. */
export function eligibleProductSql(): Prisma.Sql {
  return Prisma.sql`pr."status" = 'APPROVED' AND pr."publicationEnabled" = true`;
}
