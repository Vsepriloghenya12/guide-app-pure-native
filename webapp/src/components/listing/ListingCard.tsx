import type { SyntheticEvent } from "react";
import { Link } from "react-router-dom";
import type { Listing } from "../../types";
import { recordGuideAnalytics } from "../../utils/analytics";
import { formatOpeningHours } from "../../utils/places";

type ListingCardProps = {
  listing: Listing;
  accent?: string;
  isFavorite?: boolean;
  onToggleFavorite?: (slug: string) => void;
  variant?: "default" | "restaurant" | "bulletin";
  titleOnImage?: boolean;
  onOpen?: (listing: Listing) => void;
};

type HoursBadgeState = {
  label: string;
  tone: "open" | "closed" | "soon";
} | null;

function buildMeta(listing: Listing) {
  return [
    listing.shortDescription || listing.description,
    listing.district || listing.address,
  ].filter(Boolean);
}

function buildPills(listing: Listing) {
  const formattedHours = formatOpeningHours(listing.hours);
  return [
    listing.priceLabel || "",
    formattedHours ? `Открыто ${formattedHours}` : "",
  ]
    .filter(Boolean)
    .slice(0, 3);
}

function buildBulletinFacts(listing: Listing) {
  const priceValue =
    listing.priceLabel ||
    (typeof listing.avgCheck === "number" && Number.isFinite(listing.avgCheck)
      ? `от ${listing.avgCheck}`
      : "Договорная");
  const priceLabel = listing.kind === "Работа" ? "ЗП" : "Цена";

  return [{ tone: "check" as const, label: priceLabel, value: priceValue }];
}

function parseHoursRange(hours: string) {
  const normalized = String(hours || "")
    .replace(/[–—]/g, "-")
    .replace(/\./g, ":");
  const matches = [...normalized.matchAll(/(\d{1,2}):(\d{2})/g)];

  if (matches.length < 2) {
    return null;
  }

  const [openMatch, closeMatch] = matches;
  const openMinutes =
    Number(openMatch[1]) * 60 + Number(openMatch[2]);
  let closeMinutes =
    Number(closeMatch[1]) * 60 + Number(closeMatch[2]);

  if (!Number.isFinite(openMinutes) || !Number.isFinite(closeMinutes)) {
    return null;
  }

  return { openMinutes, closeMinutes };
}

function getHoursBadgeState(hours: string): HoursBadgeState {
  const normalized = String(hours || "").toLowerCase();
  if (!normalized.trim()) {
    return null;
  }

  if (
    normalized.includes("24/7") ||
    normalized.includes("круглосуточ") ||
    normalized.includes("24 часа")
  ) {
    return { label: "Открыто", tone: "open" };
  }

  const range = parseHoursRange(hours);
  if (!range) {
    return null;
  }

  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  let comparableCurrent = currentMinutes;
  let closeMinutes = range.closeMinutes;

  if (closeMinutes <= range.openMinutes) {
    if (comparableCurrent < range.openMinutes) {
      comparableCurrent += 24 * 60;
    }
    closeMinutes += 24 * 60;
  }

  const isOpen =
    comparableCurrent >= range.openMinutes && comparableCurrent < closeMinutes;

  if (!isOpen) {
    return { label: "Закрыто", tone: "closed" };
  }

  const minutesUntilClose = closeMinutes - comparableCurrent;
  if (minutesUntilClose <= 60) {
    return { label: "Скоро закроется", tone: "soon" };
  }

  return { label: "Открыто", tone: "open" };
}

function formatAverageCheck(listing: Listing) {
  if (listing.priceLabel) {
    return listing.priceLabel;
  }

  if (typeof listing.avgCheck === "number" && Number.isFinite(listing.avgCheck)) {
    return `${listing.avgCheck}`;
  }

  return "Не указан";
}

function buildRestaurantFacts(listing: Listing) {
  const formattedHours = formatOpeningHours(listing.hours);
  return [
    {
      key: "hours",
      icon: "hours" as const,
      value: formattedHours || "Не указано",
      badge: getHoursBadgeState(listing.hours || ""),
    },
    {
      key: "cuisine",
      icon: "cuisine" as const,
      value: listing.cuisine || listing.listingType || listing.kind || "Не указано",
      badge: null,
    },
    {
      key: "price",
      icon: "price" as const,
      value: formatAverageCheck(listing),
      badge: null,
    },
  ];
}

function FactIcon({ name }: { name: "hours" | "cuisine" | "price" }) {
  if (name === "hours") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M12 3.8a8.2 8.2 0 1 0 8.2 8.2A8.21 8.21 0 0 0 12 3.8Zm0 14.6a6.4 6.4 0 1 1 6.4-6.4 6.41 6.41 0 0 1-6.4 6.4Zm.9-10.1h-1.8v4.3l3.5 2.1.9-1.5-2.6-1.6Z"
        />
      </svg>
    );
  }

  if (name === "cuisine") {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path
          fill="currentColor"
          d="M8.3 4.2A3.6 3.6 0 0 0 4.7 7.8v1.3a3.6 3.6 0 0 0 2.5 3.43V19a1 1 0 1 0 2 0v-6.47a3.6 3.6 0 0 0 2.5-3.43V7.8a3.6 3.6 0 0 0-3.6-3.6Zm7.9.2a3.1 3.1 0 0 0-3.1 3.1v4.2a2.88 2.88 0 0 0 2.2 2.8V19a1 1 0 1 0 2 0V4.4h-1.1Z"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="currentColor"
        d="M4.5 6.3A2.3 2.3 0 0 1 6.8 4h10.4a2.3 2.3 0 0 1 2.3 2.3v11.4a2.3 2.3 0 0 1-2.3 2.3H6.8a2.3 2.3 0 0 1-2.3-2.3V6.3Zm2.3-.5a.5.5 0 0 0-.5.5v1.2h11.4V6.3a.5.5 0 0 0-.5-.5H6.8Zm-.5 3.5v8.4a.5.5 0 0 0 .5.5h10.4a.5.5 0 0 0 .5-.5V9.3H6.3Zm2 2.1h4.9v1.6H8.3v-1.6Zm0 3h7.4V16H8.3v-1.6Z"
      />
    </svg>
  );
}

function handleCardImageError(event: SyntheticEvent<HTMLImageElement>) {
  const image = event.currentTarget;
  if (image.dataset.fallbackApplied === "true") {
    return;
  }

  image.dataset.fallbackApplied = "true";
  image.src = "/icons/icon-512.png";
}

export function ListingCard({
  listing,
  accent,
  isFavorite,
  onToggleFavorite,
  variant = "default",
  titleOnImage = true,
  onOpen,
}: ListingCardProps) {
  const images =
    listing.imageUrls.length > 0
      ? listing.imageUrls
      : [
          listing.categoryId === "bulletin-board"
            ? "/home-icons/custom/bulletin-board.png"
            : "/icons/icon-512.png",
        ];
  const detailPath = `/place/${listing.slug}`;
  const meta = buildMeta(listing);
  const pills = buildPills(listing);
  const restaurantFacts = buildRestaurantFacts(listing);

  if (variant === "bulletin") {
    const bulletinFacts = buildBulletinFacts(listing);
    const handleBulletinOpen = () => {
      recordGuideAnalytics({
        kind: "place-click",
        label: listing.title,
        path: detailPath,
        entityId: listing.id,
        categoryId: listing.categoryId,
      });
      onOpen?.(listing);
    };

    return (
      <article
        className="travel-list-card travel-list-card--restaurant travel-list-card--bulletin"
        data-tone={accent || "bridge"}
      >
        {onOpen ? (
          <button
            className="travel-list-card__main travel-list-card__main--restaurant travel-list-card__main--bulletin"
            type="button"
            onClick={handleBulletinOpen}
          >
            <span className="travel-list-card__thumb-wrap travel-list-card__thumb-wrap--restaurant travel-list-card__thumb-wrap--bulletin">
              <span
                className="travel-list-card__thumb-strip"
                aria-label={
                  images.length > 1
                    ? `Фото объявления: ${images.length}`
                    : undefined
                }
              >
                {images.map((item, index) => (
                  <img
                    key={`${item}-${index}`}
                    className="travel-list-card__thumb travel-list-card__thumb-slide"
                    src={item}
                    alt={
                      index === 0
                        ? listing.title
                        : `${listing.title}, фото ${index + 1}`
                    }
                    loading="lazy"
                    decoding="async"
                    onError={handleCardImageError}
                  />
                ))}
              </span>
              <span className="travel-list-card__thumb-badge travel-list-card__thumb-badge--bulletin">
                {listing.cuisine || listing.kind || "Объявление"}
              </span>
              {images.length > 1 ? (
                <span className="travel-list-card__photo-count">
                  {images.length}
                </span>
              ) : null}
            </span>

            <span className="travel-list-card__body travel-list-card__body--restaurant travel-list-card__body--bulletin">
              <strong className="travel-list-card__title--restaurant travel-list-card__title--bulletin">
                {listing.title}
              </strong>
              <span className="travel-list-card__restaurant-meta travel-list-card__bulletin-meta">
                {bulletinFacts.map((fact) => (
                  <span
                    key={`${fact.label}-${fact.value}`}
                    className={`travel-list-card__restaurant-fact travel-list-card__restaurant-fact--${fact.tone}`}
                  >
                    <span className="travel-list-card__restaurant-fact-label">
                      {fact.label}
                    </span>
                    <span className="travel-list-card__restaurant-fact-value">
                      {fact.value}
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </button>
        ) : (
          <Link
            className="travel-list-card__main travel-list-card__main--restaurant travel-list-card__main--bulletin"
            to={detailPath}
            onClick={handleBulletinOpen}
          >
            <span className="travel-list-card__thumb-wrap travel-list-card__thumb-wrap--restaurant travel-list-card__thumb-wrap--bulletin">
              <span
                className="travel-list-card__thumb-strip"
                aria-label={
                  images.length > 1
                    ? `Фото объявления: ${images.length}`
                    : undefined
                }
              >
                {images.map((item, index) => (
                  <img
                    key={`${item}-${index}`}
                    className="travel-list-card__thumb travel-list-card__thumb-slide"
                    src={item}
                    alt={
                      index === 0
                        ? listing.title
                        : `${listing.title}, фото ${index + 1}`
                    }
                    loading="lazy"
                    decoding="async"
                    onError={handleCardImageError}
                  />
                ))}
              </span>
              <span className="travel-list-card__thumb-badge travel-list-card__thumb-badge--bulletin">
                {listing.cuisine || listing.kind || "Объявление"}
              </span>
              {images.length > 1 ? (
                <span className="travel-list-card__photo-count">
                  {images.length}
                </span>
              ) : null}
            </span>

            <span className="travel-list-card__body travel-list-card__body--restaurant travel-list-card__body--bulletin">
              <strong className="travel-list-card__title--restaurant travel-list-card__title--bulletin">
                {listing.title}
              </strong>
              <span className="travel-list-card__restaurant-meta travel-list-card__bulletin-meta">
                {bulletinFacts.map((fact) => (
                  <span
                    key={`${fact.label}-${fact.value}`}
                    className={`travel-list-card__restaurant-fact travel-list-card__restaurant-fact--${fact.tone}`}
                  >
                    <span className="travel-list-card__restaurant-fact-label">
                      {fact.label}
                    </span>
                    <span className="travel-list-card__restaurant-fact-value">
                      {fact.value}
                    </span>
                  </span>
                ))}
              </span>
            </span>
          </Link>
        )}
      </article>
    );
  }

  if (variant === "restaurant") {
    return (
      <article
        className="travel-list-card travel-list-card--restaurant"
        data-tone={accent || "coast"}
      >
        <Link
          className="travel-list-card__main travel-list-card__main--restaurant"
          to={detailPath}
          onClick={() =>
            recordGuideAnalytics({
              kind: "place-click",
              label: listing.title,
              path: detailPath,
              entityId: listing.id,
              categoryId: listing.categoryId,
            })
          }
        >
          <span
            className={`travel-list-card__thumb-wrap travel-list-card__thumb-wrap--restaurant${titleOnImage ? " travel-list-card__thumb-wrap--with-title" : ""}`}
          >
            <span
              className="travel-list-card__thumb-strip"
              aria-label={
                images.length > 1 ? `Фото места: ${images.length}` : undefined
              }
            >
              {images.map((item, index) => (
                <img
                  key={`${item}-${index}`}
                  className="travel-list-card__thumb travel-list-card__thumb-slide"
                  src={item}
                  alt={
                    index === 0
                      ? listing.title
                      : `${listing.title}, фото ${index + 1}`
                  }
                  loading="lazy"
                  decoding="async"
                  onError={handleCardImageError}
                />
              ))}
            </span>
            {images.length > 1 ? (
              <span className="travel-list-card__photo-count">
                {images.length}
              </span>
            ) : null}
            {titleOnImage ? (
              <span className="travel-list-card__thumb-title travel-list-card__thumb-title--restaurant">
                {listing.title}
              </span>
            ) : null}
          </span>

          <span className="travel-list-card__body travel-list-card__body--restaurant">
            {!titleOnImage ? (
              <strong className="travel-list-card__title--restaurant">
                {listing.title}
              </strong>
            ) : null}
            <span className="travel-list-card__restaurant-meta">
              {restaurantFacts.map((fact) => (
                <span
                  key={fact.key}
                  className={`travel-list-card__restaurant-fact travel-list-card__restaurant-fact--${fact.icon}`}
                >
                  <span className="travel-list-card__restaurant-fact-icon">
                    <FactIcon name={fact.icon} />
                  </span>
                  <span className="travel-list-card__restaurant-fact-content">
                    <span className="travel-list-card__restaurant-fact-value">
                      {fact.value}
                    </span>
                    {fact.badge ? (
                      <span
                        className={`travel-list-card__restaurant-status travel-list-card__restaurant-status--${fact.badge.tone}`}
                      >
                        {fact.badge.label}
                      </span>
                    ) : null}
                  </span>
                </span>
              ))}
            </span>
          </span>
        </Link>
      </article>
    );
  }

  return (
    <article className="travel-list-card" data-tone={accent || "coast"}>
      <Link
        className="travel-list-card__main"
        to={detailPath}
        onClick={() =>
          recordGuideAnalytics({
            kind: "place-click",
            label: listing.title,
            path: detailPath,
            entityId: listing.id,
            categoryId: listing.categoryId,
          })
        }
      >
        <span
          className={`travel-list-card__thumb-wrap${titleOnImage ? " travel-list-card__thumb-wrap--with-title" : ""}`}
        >
          <span
            className="travel-list-card__thumb-strip"
            aria-label={
              images.length > 1 ? `Фото места: ${images.length}` : undefined
            }
          >
            {images.map((item, index) => (
              <img
                key={`${item}-${index}`}
                className="travel-list-card__thumb travel-list-card__thumb-slide"
                src={item}
                alt={
                  index === 0
                    ? listing.title
                    : `${listing.title}, фото ${index + 1}`
                }
                loading="lazy"
                decoding="async"
                onError={handleCardImageError}
              />
            ))}
          </span>
          {images.length > 1 ? (
            <span className="travel-list-card__photo-count">
              {images.length}
            </span>
          ) : null}
          {titleOnImage ? (
            <span className="travel-list-card__thumb-title">
              {listing.title}
            </span>
          ) : null}
        </span>

        <span className="travel-list-card__body">
          {!titleOnImage ? <strong>{listing.title}</strong> : null}
          {meta[0] ? (
            <span className="travel-list-card__subtitle">{meta[0]}</span>
          ) : null}
          {pills.length > 0 ? (
            <span className="travel-list-card__pills">
              {pills.map((item, index) => (
                <span
                  key={`${item}-${index}`}
                  className="travel-list-card__pill"
                >
                  {item}
                </span>
              ))}
            </span>
          ) : null}
          {meta[1] ? (
            <span className="travel-list-card__meta">{meta[1]}</span>
          ) : null}
        </span>

        <span className="travel-list-card__right">
          {onToggleFavorite ? (
            <button
              className={`travel-list-card__save${isFavorite ? " is-active" : ""}`}
              type="button"
              onClick={(event) => {
                event.preventDefault();
                event.stopPropagation();
                onToggleFavorite(listing.slug);
              }}
              aria-label={
                isFavorite ? "Убрать из избранного" : "Добавить в избранное"
              }
            >
              {isFavorite ? "♥" : "♡"}
            </button>
          ) : null}
          <span className="travel-list-card__arrow" aria-hidden="true">
            ›
          </span>
        </span>
      </Link>
    </article>
  );
}
