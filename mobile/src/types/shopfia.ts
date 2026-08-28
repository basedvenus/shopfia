export type ShopFiaUser = {
  id: string;
  email: string | null;
  image?: string | null;
  name: string | null;
  role?: string;
  username?: string | null;
};

export type ShopFiaSession = {
  user?: ShopFiaUser;
  expires?: string;
};

export type Category = {
  id: string;
  name: string;
};

export type Vendor = {
  id: string;
  averageRating: number;
  availabilityNotes?: string | null;
  bio?: string | null;
  categories: { category: Category }[];
  city: string;
  coverPhoto: string | null;
  depositEnabled?: boolean;
  depositPercent?: number;
  formattedAddress?: string | null;
  instagramUrl?: string | null;
  logoUrl?: string | null;
  name: string;
  offerings: OfferingSummary[];
  photos: string[];
  reviewCount: number;
  reviews?: Review[];
  serviceAreaNotes?: string | null;
  serviceRadiusMiles: number;
  slug: string;
  startingPriceCents: number | null;
  state: string | null;
  status: string;
  storefrontAboutHeading?: string | null;
  storefrontTagline?: string | null;
  taggedPartyEvents?: Party[];
  tiktokUrl?: string | null;
  username: string;
  verified: boolean;
  website?: string | null;
  weekendAvailable?: boolean;
  zipCode: string | null;
  rankingScore?: { score: number; tierLabel: string } | null;
};

export type OfferingSummary = {
  id: string;
  basePriceCents: number | null;
  category: Category;
  eventCategories?: { category: Category }[];
  messageForPricing?: boolean;
  photos?: string[];
  title: string;
  type: string;
};

export type Offering = {
  id: string;
  basePriceCents: number | null;
  category: Category;
  categories: { category: Category }[];
  description: string;
  durationMinutes: number | null;
  eventCategories?: { category: Category }[];
  messageForPricing: boolean;
  photos: string[];
  tags?: string[];
  title: string;
  turnaroundDays: number | null;
  type: string;
  vendor: Vendor;
};

export type Party = {
  id: string;
  city: string | null;
  coverImageUrl: string | null;
  description: string | null;
  imageUrls: string[];
  location: string | null;
  photos: { id: string; crop?: unknown; updatedAt: string }[];
  slug: string;
  state?: string | null;
  theme: string | null;
  title: string;
  user?: {
    id: string;
    image: string | null;
    name: string | null;
    username: string | null;
  } | null;
};

export type PartyDetailPhoto = {
  crop: { x: number; y: number; zoom: number };
  id: string;
  taggedVendorIds: string[];
  url: string;
  vendorContributions: Record<string, string>;
};

export type PartyDetailVendor = {
  categories: string[];
  city: string;
  coverPhoto: string | null;
  id: string;
  logoUrl: string | null;
  name: string;
  slug: string;
  state: string | null;
  taggedPhotoCount: number;
};

export type PartyDetail = {
  city: string | null;
  collaborators: {
    id: string;
    role: string;
    user: {
      id: string;
      image: string | null;
      name: string | null;
      username: string | null;
    };
  }[];
  coverImageUrl: string | null;
  description: string | null;
  eventDate: string | null;
  host: {
    id: string;
    image: string | null;
    name: string | null;
    username: string | null;
  } | null;
  id: string;
  location: string | null;
  partyfulUrl: string | null;
  photos: PartyDetailPhoto[];
  slug: string;
  state: string | null;
  tags: string[];
  theme: string | null;
  title: string;
  vendors: PartyDetailVendor[];
};

export type ExplorePayload = {
  categories: Category[];
  eventCategories: Category[];
  filters: Record<string, unknown>;
  offerings: Offering[];
  parties: Party[];
  vendors: Vendor[];
};

export type ConversationSummary = {
  id: string;
  lastMessageAt: string;
  messages?: { id: string; body: string; createdAt: string; senderId: string }[];
  vendorProfile?: { id?: string; name: string; slug: string } | null;
  buyer?: { id: string; name: string | null; email: string | null } | null;
  vendor?: { id: string; name: string | null; email: string | null } | null;
};

export type MessagesPayload = {
  conversations: ConversationSummary[];
  selectedConversation?: ConversationSummary | null;
};

export type Review = {
  id: string;
  rating: number;
  comment: string | null;
  createdAt: string;
  buyer?: {
    id: string;
    image: string | null;
    name: string | null;
    username: string | null;
  } | null;
};

export type VendorDetailPayload = {
  vendor: Vendor;
};

export type OfferingDetailPayload = {
  offering: Offering;
};

export type PartyDetailPayload = {
  party: PartyDetail;
};

export type FavoriteTargetType = "vendor" | "party" | "offering";

export type FavoriteItem = {
  eyebrow: string;
  href: string;
  id: string;
  image: string;
  meta: string;
  targetId: string;
  targetType: FavoriteTargetType;
  title: string;
};

export type FavoritesPayload = {
  collections: { count: number; id: string; name: string }[];
  favorites: FavoriteItem[];
  savedIds: {
    offerings: string[];
    parties: string[];
    vendors: string[];
  };
};
