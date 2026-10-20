-- Business registrations may be sent without an email address.
ALTER TABLE "leads" ALTER COLUMN "email" DROP NOT NULL;
