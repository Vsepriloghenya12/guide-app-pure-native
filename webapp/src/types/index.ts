export type GuideCategoryId = string;

export type GuideFilterSchema = {
  quickFilters?: string[];
  fields?: string[];
};

export type GuideCategory = {
  id: GuideCategoryId;
  title: string;
  path: string;
  badge?: string;
  description?: string;
  visible: boolean;
  showOnHome: boolean;
  slug: string;
  shortTitle: string;
  accent: string;
  imageSrc?: string;
  filterSchema: GuideFilterSchema;
  sortOrder?: number;
};

export type GuidePlace = {
  hotelStars?: number | null;
  hotelPool?: boolean;
  hotelSpa?: boolean;
  id: string;
  categoryId: GuideCategoryId;
  title: string;
  description: string;
  address: string;
  phone: string;
  website: string;
  hours: string;
  avgCheck?: number | null;
  kind: string;
  cuisine: string;
  services: string[];
  tags: string[];
  breakfast: boolean;
  vegan: boolean;
  pets: boolean;
  childPrograms: boolean;
  top: boolean;
  imageLabel: string;
  imageSrc: string;
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
  createdByUserId?: string;
  moderationNote?: string;
  qualityBadge?: boolean;
  qualityBadgeText?: string;
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
  linkPath: string;
  active: boolean;
};

export type GuideCollection = {
  id: string;
  title: string;
  description: string;
  linkPath: string;
  imageSrc: string;
  itemIds: string[];
  active: boolean;
};

export type HomeLogoMedia = {
  type: 'image' | 'video';
  src: string;
  posterSrc?: string;
  alt?: string;
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
  logoMedia?: HomeLogoMedia;
  featuredCategoryIds: GuideCategoryId[];
  tipIds: string[];
  collectionIds: string[];
  sectionTitles: HomeSectionTitles;
};

export type PublicAuthProviderId = 'google' | 'apple' | 'telegram';

export type PublicAuthUser = {
  id?: string;
  provider: PublicAuthProviderId;
  sub: string;
  displayName: string;
  givenName?: string;
  familyName?: string;
  email?: string;
  emailVerified?: boolean;
  avatarUrl?: string;
  username?: string;
};

export type PublicAuthProviders = {
  google: boolean;
  apple: boolean;
  telegram: boolean;
  telegramBotUsername?: string;
};

export type PublicAuthSession = {
  authenticated: boolean;
  user: PublicAuthUser | null;
  providers: PublicAuthProviders;
};

export type ContentReportReason = 'spam' | 'illegal' | 'offensive' | 'misleading' | 'other';
export type ContentReportStatus = 'new' | 'reviewed' | 'dismissed' | 'action_taken';
export type ContentReportAction = 'hidden' | 'author_blocked' | 'dismissed' | '';

export type ContentReport = {
  id: string;
  targetType: 'bulletin';
  targetId: string;
  reporterUserId?: string;
  reason: ContentReportReason;
  comment: string;
  status: ContentReportStatus;
  createdAt: string;
  updatedAt: string;
  reviewedAt?: string;
  reviewerId?: string;
  action?: ContentReportAction;
  listing?: {
    id: string;
    slug?: string;
    title: string;
    description: string;
    status: GuidePlace['status'];
    authorUserId?: string;
    authorName?: string;
  } | null;
  reporter?: {
    id: string;
    displayName?: string;
    email?: string;
    username?: string;
  } | null;
};

export type PromotionStatus = 'draft' | 'published' | 'archived';

export type Promotion = {
  id: string;
  listingId: string;
  title: string;
  description: string;
  startsAt: string;
  endsAt: string;
  status: PromotionStatus;
  createdAt: string;
  updatedAt: string;
  pushSentAt?: string;
  pushTitle?: string;
  pushBody?: string;
  listing?: {
    id: string;
    slug?: string;
    title: string;
    status?: GuidePlace['status'];
    categoryId?: string;
  } | null;
};

export type PromotionPushStats = {
  attempted: number;
  sent: number;
  failed: number;
  skipped: number;
};

export type GuideAnalyticsKind =
  | 'page-view'
  | 'category-click'
  | 'tip-click'
  | 'collection-click'
  | 'place-click'
  | 'website-click'
  | 'phone-click';

export type GuideAnalyticsEvent = {
  id: string;
  kind: GuideAnalyticsKind;
  label: string;
  path: string;
  entityId?: string;
  categoryId?: GuideCategoryId;
  createdAt: string;
};

export type GuideAnalyticsStore = {
  events: GuideAnalyticsEvent[];
};

export type GuideContentStore = {
  version: 4;
  places: GuidePlace[];
  categories: GuideCategory[];
  tips: GuideTip[];
  collections: GuideCollection[];
  home: HomeContent;
  analytics: GuideAnalyticsStore;
  restaurants?: GuidePlace[];
  wellness?: GuidePlace[];
};

export type Category = GuideCategory;

export type Listing = GuidePlace & {
  slug: string;
  categorySlug: string;
  imageUrls: string[];
  coverImageUrl: string;
  websiteUrl: string;
  phoneNumber: string;
  district: string;
  location: string;
  type: string;
  featured: boolean;
  shortDescription: string;
  priceLabel: string;
  listingType: string;
  childFriendly: boolean;
  petFriendly: boolean;
  mapQuery: string;
  extra: string[];
};

export type Collection = GuideCollection;

export type BootstrapPayload = {
  categories: Category[];
  listings: Listing[];
  collections: Collection[];
  tips: GuideTip[];
  home: HomeContent;
};

