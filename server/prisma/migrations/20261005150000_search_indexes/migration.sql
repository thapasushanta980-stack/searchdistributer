-- Fuzzy / substring search support
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX "distributors_name_trgm_idx" ON "distributors" USING GIN ("name" gin_trgm_ops);
CREATE INDEX "distributors_summary_trgm_idx" ON "distributors" USING GIN ("summary" gin_trgm_ops);
CREATE INDEX "distributors_location_trgm_idx" ON "distributors" USING GIN ("location" gin_trgm_ops);
CREATE INDEX "products_name_trgm_idx" ON "products" USING GIN ("name" gin_trgm_ops);
