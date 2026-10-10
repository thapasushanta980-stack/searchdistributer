-- AlterTable
ALTER TABLE "enquiries" ADD COLUMN     "verificationSends" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "organisations" ADD COLUMN     "notificationEmail" TEXT;
