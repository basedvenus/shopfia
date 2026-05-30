DO $$
DECLARE
  target_id TEXT;
  source_id TEXT;
BEGIN
  SELECT "id" INTO target_id
  FROM "Category"
  WHERE "name" = 'Children''s Entertainment'
  LIMIT 1;

  IF target_id IS NULL THEN
    SELECT "id" INTO target_id
    FROM "Category"
    WHERE "name" IN ('Kids Activities', 'Soft Play')
    ORDER BY "createdAt"
    LIMIT 1;

    IF target_id IS NOT NULL THEN
      UPDATE "Category"
      SET "name" = 'Children''s Entertainment'
      WHERE "id" = target_id;
    END IF;
  END IF;

  IF target_id IS NOT NULL THEN
    FOR source_id IN
      SELECT "id"
      FROM "Category"
      WHERE "name" IN ('Kids Activities', 'Soft Play')
        AND "id" <> target_id
    LOOP
      DELETE FROM "VendorCategory" vc
      USING "VendorCategory" existing
      WHERE vc."categoryId" = source_id
        AND existing."categoryId" = target_id
        AND existing."vendorId" = vc."vendorId";

      UPDATE "VendorCategory"
      SET "categoryId" = target_id
      WHERE "categoryId" = source_id;

      UPDATE "Offering"
      SET "categoryId" = target_id
      WHERE "categoryId" = source_id;

      DELETE FROM "OfferingCategory" oc
      USING "OfferingCategory" existing
      WHERE oc."categoryId" = source_id
        AND existing."categoryId" = target_id
        AND existing."offeringId" = oc."offeringId";

      UPDATE "OfferingCategory"
      SET "categoryId" = target_id
      WHERE "categoryId" = source_id;

      DELETE FROM "OfferingEventCategory" oec
      USING "OfferingEventCategory" existing
      WHERE oec."categoryId" = source_id
        AND existing."categoryId" = target_id
        AND existing."offeringId" = oec."offeringId";

      UPDATE "OfferingEventCategory"
      SET "categoryId" = target_id
      WHERE "categoryId" = source_id;

      DELETE FROM "Category"
      WHERE "id" = source_id;
    END LOOP;
  END IF;
END $$;
