DO $$
DECLARE
  target_id TEXT;
  source_id TEXT;
  category_map JSONB := '{
    "Backdrops": ["Backdrops"],
    "Balloons": ["Balloons"],
    "Cakes & Desserts": ["Cakes & Desserts"],
    "Catering": ["Catering", "Food & Beverage"],
    "Children''s Entertainment": ["Children''s Entertainment", "Kids Activities", "Soft Play"],
    "Entertainment": ["Entertainment", "Photography"],
    "Florals": ["Florals"],
    "Party Rentals": ["Party Rentals", "Event Rentals", "Venue"],
    "Styling & Decor": ["Styling & Decor", "Decor", "Decor & Installation", "Event Planning", "Party Favors and Gifts", "Party Favors & Gifts", "Styled Setups", "Other"]
  }'::jsonb;
  target_name TEXT;
  source_name TEXT;
BEGIN
  FOR target_name IN SELECT jsonb_object_keys(category_map)
  LOOP
    SELECT "id" INTO target_id
    FROM "Category"
    WHERE "name" = target_name
    LIMIT 1;

    IF target_id IS NULL THEN
      target_id := 'standard-vendor-' || lower(regexp_replace(target_name, '[^a-zA-Z0-9]+', '-', 'g'));

      INSERT INTO "Category" ("id", "name", "iconName", "audience", "createdAt", "updatedAt")
      VALUES (
        target_id,
        target_name,
        CASE target_name
          WHEN 'Backdrops' THEN 'image'
          WHEN 'Balloons' THEN 'party-popper'
          WHEN 'Cakes & Desserts' THEN 'cake'
          WHEN 'Catering' THEN 'utensils-crossed'
          WHEN 'Children''s Entertainment' THEN 'baby'
          WHEN 'Entertainment' THEN 'music'
          WHEN 'Florals' THEN 'flower-2'
          WHEN 'Party Rentals' THEN 'sofa'
          ELSE 'sparkles'
        END,
        'VENDOR',
        NOW(),
        NOW()
      )
      ON CONFLICT ("id") DO NOTHING;

      SELECT "id" INTO target_id
      FROM "Category"
      WHERE "name" = target_name
      LIMIT 1;
    ELSE
      UPDATE "Category"
      SET "audience" = 'VENDOR',
          "iconName" = CASE target_name
            WHEN 'Backdrops' THEN 'image'
            WHEN 'Balloons' THEN 'party-popper'
            WHEN 'Cakes & Desserts' THEN 'cake'
            WHEN 'Catering' THEN 'utensils-crossed'
            WHEN 'Children''s Entertainment' THEN 'baby'
            WHEN 'Entertainment' THEN 'music'
            WHEN 'Florals' THEN 'flower-2'
            WHEN 'Party Rentals' THEN 'sofa'
            ELSE 'sparkles'
          END
      WHERE "id" = target_id;
    END IF;

    FOR source_name IN SELECT jsonb_array_elements_text(category_map -> target_name)
    LOOP
      FOR source_id IN
        SELECT "id"
        FROM "Category"
        WHERE "name" = source_name
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
    END LOOP;
  END LOOP;

  DELETE FROM "Category"
  WHERE "audience" = 'VENDOR'
    AND "name" NOT IN (
      'Backdrops',
      'Balloons',
      'Cakes & Desserts',
      'Catering',
      'Children''s Entertainment',
      'Entertainment',
      'Florals',
      'Party Rentals',
      'Styling & Decor'
    )
    AND "id" NOT IN (SELECT "categoryId" FROM "VendorCategory")
    AND "id" NOT IN (SELECT "categoryId" FROM "Offering")
    AND "id" NOT IN (SELECT "categoryId" FROM "OfferingCategory")
    AND "id" NOT IN (SELECT "categoryId" FROM "OfferingEventCategory");
END $$;
