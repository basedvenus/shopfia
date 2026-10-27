-- Copy every category membership before removing the legacy duplicate.
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-backdrops','Backdrops','image','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-balloons','Balloons','party-popper','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-cakes-desserts','Cakes & Desserts','cake','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-catering-beverages','Catering & Beverages','utensils-crossed','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-entertainment','Entertainment','music','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-florals','Florals','flower-2','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-party-rentals','Party Rentals','sofa','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-styling-decor','Styling & Decor','sparkles','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-photography-video','Photography & Video','camera','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-music-djs','Music & DJs','music','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-event-planning','Event Planning','calendar','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
  INSERT INTO "Category" (id,name,"iconName",audience,"createdAt","updatedAt") VALUES ('standard-vendor-other-event-services','Other Event Services','sparkles','VENDOR',now(),now()) ON CONFLICT (name) DO NOTHING;
INSERT INTO "VendorCategory" (id,"vendorId","categoryId")
 SELECT 'merged-' || md5(v."vendorId" || c.id),v."vendorId",c.id FROM "VendorCategory" v CROSS JOIN "Category" c
 WHERE c.name='Entertainment' AND v."categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR')
 ON CONFLICT ("vendorId","categoryId") DO NOTHING;
UPDATE "Offering" SET "categoryId"=(SELECT id FROM "Category" WHERE name='Entertainment') WHERE "categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR');
INSERT INTO "OfferingCategory" ("offeringId","categoryId","createdAt")
 SELECT o."offeringId",c.id,o."createdAt" FROM "OfferingCategory" o CROSS JOIN "Category" c
 WHERE c.name='Entertainment' AND o."categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR')
 ON CONFLICT ("offeringId","categoryId") DO NOTHING;
INSERT INTO "OfferingEventCategory" (id,"offeringId","categoryId","createdAt")
 SELECT 'merged-' || md5(o."offeringId" || c.id),o."offeringId",c.id,o."createdAt" FROM "OfferingEventCategory" o CROSS JOIN "Category" c
 WHERE c.name='Entertainment' AND o."categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR')
 ON CONFLICT ("offeringId","categoryId") DO NOTHING;
DELETE FROM "VendorCategory" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR');
DELETE FROM "OfferingCategory" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR');
DELETE FROM "OfferingEventCategory" WHERE "categoryId" IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR');
DELETE FROM "Category" WHERE id IN (SELECT id FROM "Category" WHERE name IN ('Children''s Entertainment','Children’s Entertainment','Kids Entertainment') AND audience='VENDOR');
