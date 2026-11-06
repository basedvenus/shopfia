import { normalizePartyPhotoCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";

type VendorImages = {
  status: string;
  offerings: {photos?: string[]}[];
  coverPhoto: string | null;
  photos: string[];
  taggedPartyPhotos?: {id: string; updatedAt: Date | string; crop: unknown}[];
};

export function getVendorCardImage(vendor: VendorImages) {
  const ownImage = vendor.offerings.flatMap(offering => offering.photos ?? []).find(Boolean)
    || vendor.coverPhoto || vendor.photos.find(Boolean);
  if (ownImage) return {src: ownImage, partyCrop: null};
  const taggedPhoto = vendor.status === "UNCLAIMED" ? vendor.taggedPartyPhotos?.[0] : null;
  return taggedPhoto ? {
    src: partyPhotoUrl(taggedPhoto.id, taggedPhoto.updatedAt, {width: 900}),
    partyCrop: normalizePartyPhotoCrop(taggedPhoto.crop)
  } : null;
}
