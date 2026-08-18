-- AlterTable
ALTER TABLE "SeoSettings" ADD COLUMN     "googleMapsUrl" TEXT,
ADD COLUMN     "googleRating" DOUBLE PRECISION,
ADD COLUMN     "googleReviews" INTEGER,
ADD COLUMN     "yandexMapsUrl" TEXT,
ADD COLUMN     "yandexRating" DOUBLE PRECISION,
ADD COLUMN     "yandexReviews" INTEGER;

