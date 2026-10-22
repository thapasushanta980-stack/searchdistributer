ALTER TABLE "distributors" ADD COLUMN "coverImageUrl" TEXT;
ALTER TABLE "distributors" ADD COLUMN "galleryImageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
ALTER TABLE "products" ADD COLUMN "imageUrls" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];
