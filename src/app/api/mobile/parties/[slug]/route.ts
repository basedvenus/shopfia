import { NextResponse } from "next/server";
import { normalizeImageCrop } from "@/lib/image-crop";
import { partyPhotoUrl } from "@/lib/party-photo-url";
import { getVisiblePartyCollaborators } from "@/lib/party-public-view";
import { getSafeProfileImage } from "@/lib/profile-image";

export const dynamic = "force-dynamic";

export async function GET(_request: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { db } = await import("@/lib/db");
  const normalizedSlug = decodeURIComponent(slug).trim();

  const party = await db.partyEvent.findFirst({
    where: {
      OR: [{ slug: normalizedSlug }, { id: normalizedSlug }]
    },
    include: {
      collaborators: {
        where: { status: "ACCEPTED" },
        orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        include: {
          user: { select: { id: true, image: true, name: true, username: true } }
        }
      },
      photos: {
        orderBy: { sortOrder: "asc" },
        include: {
          taggedVendors: {
            include: { categories: { include: { category: true } } }
          },
          vendorRatings: true
        }
      },
      taggedVendors: {
        include: { categories: { include: { category: true } } }
      },
      user: { select: { id: true, image: true, name: true, username: true } }
    }
  });

  if (!party) {
    return NextResponse.json({ error: "Party not found." }, { status: 404 });
  }

  const photos = party.photos.length
    ? party.photos.map((photo) => ({
        crop: normalizeImageCrop(photo.crop),
        id: photo.id,
        taggedVendorIds: photo.taggedVendors.map((vendor) => vendor.id),
        url: partyPhotoUrl(photo.id, photo.updatedAt, { width: 1400 }),
        vendorContributions: Object.fromEntries(
          photo.vendorRatings
            .filter((credit) => credit.contributionNote)
            .map((credit) => [credit.vendorId, credit.contributionNote ?? ""])
        )
      }))
    : party.imageUrls.map((url, index) => ({
        crop: normalizeImageCrop(null),
        id: `${party.id}-legacy-${index}`,
        taggedVendorIds: party.taggedVendors.map((vendor) => vendor.id),
        url,
        vendorContributions: {}
      }));

  const vendorMap = new Map(
    [...party.taggedVendors, ...party.photos.flatMap((photo) => photo.taggedVendors)].map((vendor) => [
      vendor.id,
      vendor
    ])
  );

  const vendors = Array.from(vendorMap.values()).map((vendor) => ({
    categories: vendor.categories.map((item) => item.category.name),
    city: vendor.city,
    coverPhoto: vendor.coverPhoto,
    id: vendor.id,
    logoUrl: vendor.logoUrl,
    name: vendor.name,
    slug: vendor.slug,
    state: vendor.state,
    taggedPhotoCount: photos.filter((photo) => photo.taggedVendorIds.includes(vendor.id)).length
  }));

  const collaborators = getVisiblePartyCollaborators(party.collaborators, party.user).map((collaborator) => ({
    id: collaborator.id,
    role: collaborator.role,
    user: {
      ...collaborator.user,
      image: getSafeProfileImage(collaborator.user.image)
    }
  }));

  return NextResponse.json({
    party: {
      city: party.city,
      collaborators,
      coverImageUrl: party.coverImageUrl,
      description: party.description,
      eventDate: party.eventDate,
      host: party.user
        ? { ...party.user, image: getSafeProfileImage(party.user.image) }
        : null,
      id: party.id,
      location: party.location,
      partyfulUrl: party.partyfulUrl,
      photos,
      slug: party.slug,
      state: party.state,
      tags: party.tags,
      theme: party.theme,
      title: party.title,
      vendors
    }
  });
}
