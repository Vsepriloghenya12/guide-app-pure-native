export type GuideCategoryId = string;

export type GuideFilterSchema = {
  quickFilters?: string[];
  fields?: string[];
};

export type GuideCategory = {
  id: GuideCategoryId;
  title: string;
  path?: string;
  badge?: string;
  description?: string;
  visible: boolean;
  showOnHome: boolean;
  slug: string;
  shortTitle: string;
  accent?: string;
  imageSrc?: string;
  filterSchema?: GuideFilterSchema;
  sortOrder?: number;
};

export type GuidePlace = {
  id: string;
  categoryId: GuideCategoryId;
  title: string;
  description: string;
  address: string;
  phone?: string;
  website?: string;
  hours?: string;
  avgCheck?: number | null;
  kind?: string;
  cuisine?: string;
  services?: string[];
  tags?: string[];
  breakfast?: boolean;
  vegan?: boolean;
  pets?: boolean;
  childPrograms?: boolean;
  top?: boolean;
  imageLabel?: string;
  imageSrc?: string;
  imageGallery?: string[];
  slug?: string;
  categorySlug?: string;
  featured?: boolean;
  shortDescription?: string;
  priceLabel?: string;
  listingType?: string;
  childFriendly?: boolean;
  petFriendly?: boolean;
  mapQuery?: string;
  extra?: string[];
  imageUrls?: string[];
  coverImageUrl?: string;
  websiteUrl?: string;
  phoneNumber?: string;
  district?: string;
  location?: string;
  type?: string;
  contactName?: string;
  status?: 'draft' | 'hidden' | 'published';
  sortOrder?: number;
  lat?: number | null;
  lng?: number | null;
  visible?: boolean;
};

export type GuideTip = {
  id: string;
  title: string;
  text: string;
  linkPath?: string;
  active: boolean;
};

export type GuideCollection = {
  id: string;
  title: string;
  description: string;
  linkPath?: string;
  imageSrc?: string;
  itemIds: string[];
  active: boolean;
};

export type HomeSectionTitles = {
  popular: string;
  categories: string;
  tips: string;
  collections: string;
  allCategories: string;
};

export type HomeContent = {
  popularPlaceIds: string[];
  featuredCategoryIds: GuideCategoryId[];
  tipIds: string[];
  collectionIds: string[];
  sectionTitles: HomeSectionTitles;
};

export type GuideContentStore = {
  version: 4;
  places: GuidePlace[];
  categories: GuideCategory[];
  tips: GuideTip[];
  collections: GuideCollection[];
  home: HomeContent;
};

export type BootstrapPayload = {
  categories: GuideCategory[];
  listings: GuidePlace[];
  collections: GuideCollection[];
  tips: GuideTip[];
  home: HomeContent;
  content?: GuideContentStore;
};

export type SupportContactChannel = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  href: string;
  kind: 'telegram' | 'whatsapp' | 'phone' | 'email' | 'instagram';
};

export type EmergencyContact = {
  id: string;
  title: string;
  description: string;
  value: string;
  href: string;
};

export type SupportContentStore = {
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  helpButtonLabel: string;
  emergencyTitle: string;
  emergencySubtitle: string;
  contactChannels: SupportContactChannel[];
  emergencyContacts: EmergencyContact[];
};
