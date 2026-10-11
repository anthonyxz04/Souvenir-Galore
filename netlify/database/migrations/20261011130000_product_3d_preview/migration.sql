-- Souvenir Galore: 3D candle preview settings per product (see src/lib/candle3d/config.ts).
-- Empty for existing products, so nothing changes until the owner turns it on.

ALTER TABLE "Product" ADD COLUMN "preview3d" JSONB;
