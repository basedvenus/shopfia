INSERT INTO "Category" ("id", "name", "iconName", "audience", "createdAt", "updatedAt")
SELECT concat('c', substr(md5(random()::text || clock_timestamp()::text), 1, 24)), 'Catering & Beverages', 'utensils-crossed', 'VENDOR', now(), now()
WHERE NOT EXISTS (
  SELECT 1 FROM "Category" WHERE "name" = 'Catering & Beverages'
);

UPDATE "Category"
SET "iconName" = 'utensils-crossed',
    "audience" = 'VENDOR',
    "updatedAt" = now()
WHERE "name" = 'Catering & Beverages';

WITH target AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering & Beverages'
),
old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
INSERT INTO "VendorCategory" ("id", "vendorId", "categoryId")
SELECT concat('c', substr(md5(random()::text || clock_timestamp()::text), 1, 24)), vc."vendorId", target."id"
FROM "VendorCategory" vc
CROSS JOIN target
WHERE vc."categoryId" IN (SELECT "id" FROM old)
ON CONFLICT ("vendorId", "categoryId") DO NOTHING;

WITH target AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering & Beverages'
),
old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
INSERT INTO "OfferingCategory" ("offeringId", "categoryId", "createdAt")
SELECT oc."offeringId", target."id", now()
FROM "OfferingCategory" oc
CROSS JOIN target
WHERE oc."categoryId" IN (SELECT "id" FROM old)
ON CONFLICT ("offeringId", "categoryId") DO NOTHING;

WITH target AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering & Beverages'
),
old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
UPDATE "Offering"
SET "categoryId" = target."id",
    "updatedAt" = now()
FROM target
WHERE "Offering"."categoryId" IN (SELECT "id" FROM old);

UPDATE "Listing"
SET "category" = 'Catering & Beverages',
    "updatedAt" = now()
WHERE "category" = 'Catering';

WITH old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
DELETE FROM "VendorCategory"
WHERE "categoryId" IN (SELECT "id" FROM old);

WITH old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
DELETE FROM "OfferingCategory"
WHERE "categoryId" IN (SELECT "id" FROM old);

WITH old AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering'
)
DELETE FROM "Category"
WHERE "id" IN (SELECT "id" FROM old);

WITH target AS (
  SELECT "id" FROM "Category" WHERE "name" = 'Catering & Beverages'
),
e2e AS (
  SELECT "id" FROM "Category" WHERE "name" = 'E2E Storefront Styling'
)
UPDATE "Offering"
SET "categoryId" = target."id",
    "updatedAt" = now()
FROM target
WHERE "Offering"."categoryId" IN (SELECT "id" FROM e2e);

UPDATE "Listing"
SET "category" = 'Catering & Beverages',
    "updatedAt" = now()
WHERE "category" = 'E2E Storefront Styling';

WITH e2e AS (
  SELECT "id" FROM "Category" WHERE "name" = 'E2E Storefront Styling'
)
DELETE FROM "VendorCategory"
WHERE "categoryId" IN (SELECT "id" FROM e2e);

WITH e2e AS (
  SELECT "id" FROM "Category" WHERE "name" = 'E2E Storefront Styling'
)
DELETE FROM "OfferingCategory"
WHERE "categoryId" IN (SELECT "id" FROM e2e);

WITH e2e AS (
  SELECT "id" FROM "Category" WHERE "name" = 'E2E Storefront Styling'
)
DELETE FROM "OfferingEventCategory"
WHERE "categoryId" IN (SELECT "id" FROM e2e);

DELETE FROM "Category"
WHERE "name" = 'E2E Storefront Styling';
