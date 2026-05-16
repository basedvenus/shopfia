import { z } from "zod";

const optionalText = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().trim().optional()
);

const optionalNumber = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.coerce.number().min(0).optional()
);

const optionalCoordinate = (min: number, max: number) =>
  z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().min(min).max(max).optional()
  );

export const publicInquirySchema = z.object({
  vendorProfileId: z.string().cuid(),
  listingId: z.string().cuid().optional().or(z.literal("")),
  offeringId: z.string().cuid().optional().or(z.literal("")),
  name: z.string().trim().min(2, "Name is required.").max(120, "Name is a little too long."),
  email: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.string().trim().email("Enter a valid email address.").max(200, "Email is a little too long.").optional()
  ),
  phone: optionalText.pipe(z.string().max(40, "Phone number is a little too long.").optional()),
  eventDate: z
    .string()
    .trim()
    .min(1, "Event date is required.")
    .refine((value) => !Number.isNaN(new Date(`${value}T00:00:00`).getTime()), {
      message: "Enter a valid event date."
    }),
  eventLocation: z.string().trim().min(2, "Event location is required.").max(240, "Event location is a little too long."),
  formattedAddress: z.string().trim().max(240, "Event location is a little too long.").optional().or(z.literal("")),
  locationCity: z.string().trim().max(80, "City is a little too long.").optional().or(z.literal("")),
  locationState: z.string().trim().max(40, "State is a little too long.").optional().or(z.literal("")),
  locationZipCode: z.string().trim().max(12, "Zip code is a little too long.").optional().or(z.literal("")),
  locationLat: optionalCoordinate(-90, 90),
  locationLng: optionalCoordinate(-180, 180),
  googlePlaceId: z.string().trim().max(180, "Location details are a little too long.").optional().or(z.literal("")),
  budgetDollars: optionalNumber,
  guestCount: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(100000).optional()
  ),
  inspirationUrls: z.array(z.string().max(5_000_000, "That inspiration photo is too large.")).max(5, "Add up to 5 inspiration photos.").default([]),
  message: z.string().trim().min(8, "Inquiry details are required.").max(2000, "Message is a little too long.")
});
