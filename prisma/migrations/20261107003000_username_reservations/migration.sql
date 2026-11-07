CREATE TABLE "UsernameReservation" (
  "username" TEXT PRIMARY KEY,
  "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
  "expiresAt" TIMESTAMP(3) NOT NULL
);
CREATE INDEX "UsernameReservation_expiresAt_idx" ON "UsernameReservation"("expiresAt");

-- Enforce reservations for every username assignment, including onboarding.
-- Locks serialize releasing and claiming a handle across different accounts.
CREATE FUNCTION shopfia_reserve_previous_username() RETURNS trigger AS $$
DECLARE
  previous_username TEXT;
  handle TEXT;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW."username" IS NOT DISTINCT FROM OLD."username" THEN RETURN NEW; END IF;
    previous_username := OLD."username";
  END IF;

  FOR handle IN
    SELECT DISTINCT value FROM unnest(ARRAY[previous_username, NEW."username"]) AS handles(value)
    WHERE value IS NOT NULL ORDER BY value
  LOOP
    PERFORM pg_advisory_xact_lock(hashtextextended('shopfia-username:' || handle, 0));
  END LOOP;

  IF NEW."username" IS NOT NULL AND EXISTS (
    SELECT 1 FROM "UsernameReservation"
    WHERE "username" = NEW."username" AND "userId" <> NEW."id"
      AND "expiresAt" > clock_timestamp()
  ) THEN
    RAISE EXCEPTION 'USERNAME_RESERVED: This username is temporarily reserved.' USING ERRCODE = '23505';
  END IF;

  IF previous_username IS NOT NULL THEN
    INSERT INTO "UsernameReservation" ("username", "userId", "expiresAt")
      VALUES (previous_username, NEW."id", clock_timestamp() + interval '30 days')
    ON CONFLICT ("username") DO UPDATE
      SET "userId" = EXCLUDED."userId", "expiresAt" = EXCLUDED."expiresAt";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER shopfia_username_reservation
BEFORE INSERT OR UPDATE OF "username" ON "User"
FOR EACH ROW EXECUTE FUNCTION shopfia_reserve_previous_username();
