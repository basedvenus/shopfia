import { z } from "zod";

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
  name: z.string().trim().min(2, "Name is required.").max(120),
  email: z.string().trim().email().max(200).optional().or(z.literal("")),
  phone: z.string().trim().max(40).optional().or(z.literal("")),
  eventDate: z.string().trim().min(1, "Event date is required."),
  eventLocation: z.string().trim().max(240).optional().or(z.literal("")),
  formattedAddress: z.string().trim().max(240).optional().or(z.literal("")),
  locationCity: z.string().trim().max(80).optional().or(z.literal("")),
  locationState: z.string().trim().max(40).optional().or(z.literal("")),
  locationZipCode: z.string().trim().max(12).optional().or(z.literal("")),
  locationLat: optionalCoordinate(-90, 90),
  locationLng: optionalCoordinate(-180, 180),
  googlePlaceId: z.string().trim().max(180).optional().or(z.literal("")),
  budgetDollars: optionalNumber,
  guestCount: z.preprocess(
    (value) => (value === "" || value == null ? undefined : value),
    z.coerce.number().int().min(1).max(100000).optional()
  ),
  inspirationUrls: z.array(z.string().max(5_000_000)).max(5).default([]),
  message: z.string().trim().min(8, "Inquiry details are required.").max(2000)
}).refine((data) => Boolean(data.email || data.phone), {
  message: "Add an email or phone number.",
  path: ["email"]
});
