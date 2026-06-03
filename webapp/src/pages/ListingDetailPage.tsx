import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/layout/PageHeader";
import { ListingCard } from "../components/listing/ListingCard";
import { MapLibrePlaceMap } from "../components/map/MapLibrePlaceMap";
import { useFavorites } from "../hooks/useFavorites";
import { useGuideContent } from "../hooks/useGuideContent";
import { usePageMeta } from "../hooks/usePageMeta";
import { recordGuideAnalytics } from "../utils/analytics";
import {
  createOpenStreetMapDirectionsUrl,
  formatDistance,
  formatOpeningHours,
  hasCoordinates,
  haversineDistanceKm,
  sortPlacesByPriority,
} from "../utils/places";
import type { Category, Listing } from "../types";
import { useUserLocation } from "../hooks/useUserLocation";

type DetailActionIconName = "route" | "save" | "phone" | "site" | "share";

function DetailActionIcon({
  name,
  active = false,
}: {
  name: DetailActionIconName;
  active?: boolean;
}) {
  switch (name) {
    case "route":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12.74 3.47 19.9 19.4c.23.5-.25 1.03-.76.84l-5.53-2.07a1 1 0 0 0-.7 0l-5.53 2.07c-.5.19-.99-.34-.76-.84l7.16-15.93a.52.52 0 0 1 .96 0Zm-.18 3.9-3.8 8.46 3.11-1.16a2 2 0 0 1 1.4 0l3.1 1.16-3.8-8.46Z"
          />
        </svg>
      );
    case "save":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          {active ? (
            <path
              fill="currentColor"
              d="M7 4.5A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5v15.13c0 .73-.82 1.16-1.42.74L12 17.74l-3.58 2.63A.9.9 0 0 1 7 19.63V4.5Z"
            />
          ) : (
            <path
              fill="currentColor"
              d="M9.5 3A1.5 1.5 0 0 0 8 4.5v13.15l3.41-2.5a1 1 0 0 1 1.18 0L16 17.65V4.5A1.5 1.5 0 0 0 14.5 3h-5Zm-2.93.24A2.5 2.5 0 0 1 9.5 2h5A2.5 2.5 0 0 1 17 4.5v15.13c0 .73-.82 1.16-1.42.74L12 17.74l-3.58 2.63A.9.9 0 0 1 7 19.63V4.5c0-.47.13-.92.37-1.26h-.8Z"
            />
          )}
        </svg>
      );
    case "phone":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="m7.78 4.5 2.06 3.24c.24.38.27.86.07 1.27l-.9 1.82a.72.72 0 0 0 .08.78 13.78 13.78 0 0 0 3.3 3.3c.24.16.56.2.82.08l1.8-.89a1.35 1.35 0 0 1 1.3.07l3.2 2.03c.5.32.72.93.55 1.5-.48 1.57-1.94 2.68-3.63 2.68A14.43 14.43 0 0 1 3.62 7.63C3.62 5.94 4.73 4.48 6.3 4c.55-.17 1.16.05 1.48.5Z"
          />
        </svg>
      );
    case "site":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M12 3.25a8.75 8.75 0 1 0 0 17.5 8.75 8.75 0 0 0 0-17.5Zm5.95 5.25h-2.42a13.92 13.92 0 0 0-1.36-3.23 6.8 6.8 0 0 1 3.78 3.23ZM12 5.1c.59 0 1.7 1.3 2.33 3.4H9.67C10.3 6.4 11.41 5.1 12 5.1ZM5.95 8.5a6.8 6.8 0 0 1 3.78-3.23A13.92 13.92 0 0 0 8.37 8.5H5.95Zm-.63 2h2.67a15.7 15.7 0 0 0 0 3h-2.67a6.78 6.78 0 0 1 0-3Zm.63 5h2.42c.3 1.16.78 2.25 1.36 3.23a6.8 6.8 0 0 1-3.78-3.23ZM12 18.9c-.59 0-1.7-1.3-2.33-3.4h4.66C13.7 17.6 12.59 18.9 12 18.9Zm2.76-.17c.58-.98 1.06-2.07 1.36-3.23h2.42a6.8 6.8 0 0 1-3.78 3.23Zm1.65-5.23a13.74 13.74 0 0 0 0-3h2.67a6.78 6.78 0 0 1 0 3H16.4Z"
          />
        </svg>
      );
    case "share":
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true">
          <path
            fill="currentColor"
            d="M17.5 15a3.47 3.47 0 0 0-2.25.82l-5.1-2.92a3.6 3.6 0 0 0 0-1.8l5.1-2.92a3.5 3.5 0 1 0-.92-1.61l-5.1 2.92a3.5 3.5 0 1 0 0 5.02l5.1 2.92A3.5 3.5 0 1 0 17.5 15Z"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function ListingDetailPage() {
  const { slug = "" } = useParams();
  const { isFavorite, toggleFavorite } = useFavorites();
  const { places, categories } = useGuideContent();
  const { location: userLocation } = useUserLocation();
  const cachedListing = useMemo(
    () =>
      places.find(
        (item) =>
          item.slug === slug ||
          `${item.categorySlug || item.categoryId}-${item.id}` === slug,
      ) as Listing | undefined,
    [places, slug],
  );
  const cachedCategory = useMemo(
    () =>
      cachedListing
        ? ((categories.find(
            (item) =>
              item.id === cachedListing.categoryId ||
              item.slug === cachedListing.categorySlug,
          ) as Category | undefined) ?? null)
        : null,
    [categories, cachedListing],
  );
  const cachedSimilar = useMemo(
    () =>
      cachedListing
        ? sortPlacesByPriority(
            places
              .filter(
                (item) =>
                  item.categoryId === cachedListing.categoryId &&
                  item.id !== cachedListing.id,
              )
              .map((item) => item as Listing),
          )
        : [],
    [places, cachedListing],
  );
  const [remoteListing, setRemoteListing] = useState<Listing | null>(null);
  const [remoteSimilar, setRemoteSimilar] = useState<Listing[]>([]);
  const [remoteCategory, setRemoteCategory] = useState<Category | null>(null);
  const [loading, setLoading] = useState(() => !cachedListing);
  const [notFound, setNotFound] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [shareState, setShareState] = useState<"idle" | "copied">("idle");

  const listing = remoteListing ?? cachedListing ?? null;
  const similar = remoteListing ? remoteSimilar : cachedSimilar;
  const category = remoteCategory ?? cachedCategory;

  usePageMeta({
    title: listing?.title || "Place details",
    description:
      listing?.shortDescription ||
      listing?.description ||
      "Detailed place card.",
  });

  useEffect(() => {
    let active = true;
    setRemoteListing(null);
    setRemoteSimilar([]);
    setRemoteCategory(null);
    setNotFound(false);
    setLoading(!cachedListing);

    api
      .listing(slug)
      .then((response) => {
        if (!active) return;
        setRemoteListing(response.listing);
        setRemoteCategory(response.category);
        setRemoteSimilar(sortPlacesByPriority(response.similar));
        setActiveImageIndex(0);
      })
      .catch(() => {
        if (active && !cachedListing) {
          setNotFound(true);
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [cachedListing, slug]);

  useEffect(() => {
    if (shareState === "idle") {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => {
      setShareState("idle");
    }, 2200);

    return () => window.clearTimeout(timeoutId);
  }, [shareState]);

  const gallery = useMemo(
    () =>
      listing?.imageUrls?.length
        ? listing.imageUrls
        : listing?.coverImageUrl
          ? [listing.coverImageUrl]
          : [],
    [listing],
  );
  const activeImage =
    gallery[activeImageIndex] || gallery[0] || "/home-hero-background.png";
  const formattedHours = formatOpeningHours(listing?.hours);

  const distanceKm = useMemo(() => {
    if (!listing || !userLocation || !hasCoordinates(listing)) {
      return null;
    }

    return haversineDistanceKm(userLocation, {
      lat: listing.lat!,
      lng: listing.lng!,
    });
  }, [listing, userLocation]);

  if (loading) {
    return <div className="travel-state-card">Загружаю карточку места…</div>;
  }

  if (notFound || !listing || !category) {
    return (
      <div className="page-stack travel-page">
        <PageHeader
          title="Место не найдено"
          subtitle="Карточка могла быть скрыта или удалена."
          showBack
        />
      </div>
    );
  }

  const isBulletinListing = category.id === "bulletin-board";
  const detailPath =
    category.id === "restaurants"
      ? "/restaurants"
      : category.id === "wellness"
        ? "/wellness"
        : category.path;
  const routeUrl = createOpenStreetMapDirectionsUrl(listing, userLocation);
  const listingHasCoordinates = hasCoordinates(listing);
  const websiteLink = listing.websiteUrl || listing.website;
  const phoneLink = listing.phoneNumber || listing.phone;
  const favoriteActive = isFavorite(listing.slug);
  const quickTags = [
    listing.listingType,
    listing.cuisine,
    ...(listing.services || []),
    ...(listing.tags || []),
  ]
    .filter(Boolean)
    .slice(0, 4);
  const summaryText =
    listing.shortDescription && listing.shortDescription !== listing.description
      ? listing.shortDescription
      : "";
  const aboutText = [summaryText, listing.description]
    .filter(Boolean)
    .join(" ");
  const hasExtraInfo = Boolean(
    listing.priceLabel ||
    hasCoordinates(listing) ||
    (isBulletinListing &&
      (listing.kind || listing.cuisine || listing.district)),
  );
  const shareUrl =
    typeof window === "undefined"
      ? `/place/${listing.slug}`
      : window.location.href;
  const currentListing = listing;

  async function handleShare() {
    const sharePayload = {
      title: currentListing.title,
      text: currentListing.shortDescription || currentListing.description,
      url: shareUrl,
    };

    try {
      if (
        typeof navigator !== "undefined" &&
        typeof navigator.share === "function"
      ) {
        await navigator.share(sharePayload);
        return;
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
    }

    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
    }
  }

  return (
    <div className="page-stack travel-page travel-page--detail">
      <section
        className="travel-detail-card"
        data-tone={category.accent || "coast"}
      >
        <div className="travel-detail-card__media">
          <Link
            className="travel-detail-card__back"
            to={detailPath}
            aria-label="Назад к списку"
          >
            ‹
          </Link>
          <img
            src={activeImage}
            alt={listing.title}
            loading="lazy"
            decoding="async"
          />
          {formattedHours ? (
            <span className="travel-detail-card__hours-badge">
              {formattedHours}
            </span>
          ) : null}
        </div>

        {gallery.length > 1 ? (
          <div className="travel-detail-thumbs">
            {gallery.map((imageUrl, index) => (
              <button
                key={`${imageUrl}-${index}`}
                type="button"
                className={`travel-detail-thumbs__item ${index === activeImageIndex ? "is-active" : ""}`}
                onClick={() => setActiveImageIndex(index)}
              >
                <img src={imageUrl} alt="" loading="lazy" decoding="async" />
              </button>
            ))}
          </div>
        ) : null}

        {quickTags.length > 0 ? (
          <div className="travel-tag-pills travel-detail-tag-pills">
            {quickTags.map((item) => (
              <span key={item} className="travel-tag-pill">
                {item}
              </span>
            ))}
          </div>
        ) : null}

        <p className="travel-detail-card__summary-text travel-detail-card__summary-text--lead">
          {aboutText}
        </p>
        {distanceKm !== null ? (
          <div className="travel-info-lines">
            <span>{formatDistance(distanceKm)} от вас</span>
          </div>
        ) : null}

        <div className="travel-detail-actions travel-detail-actions--icon-grid">
          {listingHasCoordinates ? (
            <a
              className="travel-detail-action"
              href={routeUrl}
              target="_blank"
              rel="noreferrer"
            >
              <span className="travel-detail-action__icon-wrap travel-detail-action__icon-wrap--primary">
                <DetailActionIcon name="route" />
              </span>
              <span className="travel-detail-action__label">Открыть маршрут</span>
            </a>
          ) : null}
          <button
            className={`travel-detail-action${favoriteActive ? " is-active" : ""}`}
            type="button"
            onClick={() => toggleFavorite(listing.slug)}
            aria-pressed={favoriteActive}
          >
            <span
              className={`travel-detail-action__icon-wrap${favoriteActive ? " travel-detail-action__icon-wrap--active" : ""}`}
            >
              <DetailActionIcon name="save" active={favoriteActive} />
            </span>
            <span className="travel-detail-action__label">
              {favoriteActive ? "Сохранено" : "Сохранить"}
            </span>
          </button>
          {phoneLink ? (
            <a
              className="travel-detail-action"
              href={`tel:${phoneLink}`}
              onClick={() =>
                recordGuideAnalytics({
                  kind: "phone-click",
                  label: `${listing.title} · call`,
                  path: `tel:${phoneLink}`,
                  entityId: listing.id,
                  categoryId: listing.categoryId,
                })
              }
            >
              <span className="travel-detail-action__icon-wrap">
                <DetailActionIcon name="phone" />
              </span>
              <span className="travel-detail-action__label">
                {isBulletinListing ? "Связаться" : "Позвонить"}
              </span>
            </a>
          ) : null}
          {websiteLink ? (
            <a
              className="travel-detail-action"
              href={websiteLink}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                recordGuideAnalytics({
                  kind: "website-click",
                  label: `${listing.title} · website`,
                  path: websiteLink,
                  entityId: listing.id,
                  categoryId: listing.categoryId,
                })
              }
            >
              <span className="travel-detail-action__icon-wrap">
                <DetailActionIcon name="site" />
              </span>
              <span className="travel-detail-action__label">
                {isBulletinListing ? "Ссылка" : "Открыть сайт"}
              </span>
            </a>
          ) : null}
          <button
            className="travel-detail-action"
            type="button"
            onClick={() => void handleShare()}
          >
            <span
              className={`travel-detail-action__icon-wrap${shareState === "copied" ? " travel-detail-action__icon-wrap--active" : ""}`}
            >
              <DetailActionIcon name="share" />
            </span>
            <span className="travel-detail-action__label">
              {shareState === "copied" ? "Скопировано" : "Поделиться"}
            </span>
          </button>
        </div>

        {hasExtraInfo ? (
          <ul className="travel-detail-info-list">
            {listing.priceLabel ? (
              <li className="travel-detail-info-row">
                <strong>
                  {isBulletinListing ? "Цена / зарплата:" : "Цена:"}
                </strong>{" "}
                <span>{listing.priceLabel}</span>
              </li>
            ) : null}
            {isBulletinListing && (listing.kind || listing.cuisine) ? (
              <li className="travel-detail-info-row">
                <strong>Раздел:</strong>{" "}
                <span>
                  {[listing.kind, listing.cuisine].filter(Boolean).join(" · ")}
                </span>
              </li>
            ) : null}
            {listingHasCoordinates ? (
              <li className="travel-detail-info-row">
                <strong>Карта приложения:</strong>{" "}
                <Link
                  className="travel-detail-info-link"
                  to={`/map?place=${encodeURIComponent(listing.slug)}`}
                >
                  Открыть на карте
                </Link>
              </li>
            ) : null}
          </ul>
        ) : null}
      </section>

      {listingHasCoordinates ? (
        <section className="travel-section travel-detail-map-section">
          <div className="travel-section__header">
            <h2>Карта</h2>
            <a href={routeUrl} target="_blank" rel="noreferrer">
              Открыть маршрут
            </a>
          </div>
          <MapLibrePlaceMap
            places={[
              {
                id: listing.id,
                title: listing.title,
                lat: listing.lat!,
                lng: listing.lng!,
                address: listing.address || listing.location,
                category: category.shortTitle || category.title,
              },
            ]}
          />
        </section>
      ) : null}

      {similar.length > 0 ? (
        <section className="travel-section">
          <div className="travel-section__header">
            <h2>
              {isBulletinListing ? "Похожие объявления" : "Похожие места"}
            </h2>
            <Link to={detailPath}>
              {isBulletinListing ? "Все объявления" : "Открыть раздел"}
            </Link>
          </div>
          <div className="travel-listing-stack">
            {similar.slice(0, 3).map((item) => (
              <ListingCard
                key={item.id}
                listing={item}
                accent={category.accent}
                variant={isBulletinListing ? "bulletin" : "default"}
                isFavorite={isFavorite(item.slug)}
                onToggleFavorite={toggleFavorite}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
