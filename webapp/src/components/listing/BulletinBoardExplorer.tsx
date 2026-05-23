import { type ChangeEvent, type FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useUserAuth } from "../auth/userAuthContext";
import { defaultCategories } from "../../data/categories";
import { useGuideContent } from "../../hooks/useGuideContent";
import { usePageMeta } from "../../hooks/usePageMeta";
import type { GuideCategory, GuidePlace, Listing } from "../../types";
import { compressImage } from "../../utils/imageUpload";
import { comparePlacesByPriority, toListingLike } from "../../utils/places";
import { ListingCard } from "./ListingCard";

type BulletinSectionId = "all" | "work" | "sales" | "services" | "community";
type BulletinVisualId = Exclude<BulletinSectionId, "all">;

type BulletinSubmissionDraft = {
  section: string;
  subcategory: string;
  title: string;
  priceLabel: string;
  district: string;
  phone: string;
  link: string;
  contactName: string;
  description: string;
};

type BulletinListingModalInfo = {
  listing: Listing;
  phone: string;
  website: string;
  contactName: string;
  district: string;
  section: string;
  subcategory: string;
  priceLabel: string;
};

type BulletinSubcategory = {
  id: string;
  label: string;
  match: string[];
};

type BulletinQuickSubcategory = {
  id: string;
  label: string;
};

type BulletinSection = {
  id: BulletinSectionId;
  label: string;
  kind?: string;
  match: string[];
  subcategories: BulletinSubcategory[];
};

type BulletinPrimaryButton = {
  id: BulletinVisualId;
  label: string;
  sectionId: BulletinVisualId;
};

const bulletinSections: BulletinSection[] = [
  {
    id: "all",
    label: "Все",
    match: [],
    subcategories: [],
  },
  {
    id: "work",
    label: "Работа",
    kind: "Работа",
    match: [
      "работа",
      "вакансия",
      "вакансии",
      "резюме",
      "подработка",
      "job",
      "work",
      "resume",
    ],
    subcategories: [
      {
        id: "vacancy",
        label: "Вакансии",
        match: [
          "вакансия",
          "вакансии",
          "ищем сотрудника",
          "работодатель",
          "hiring",
        ],
      },
      {
        id: "resume",
        label: "Резюме",
        match: ["резюме", "ищу работу", "соискатель", "resume"],
      },
    ],
  },
  {
    id: "sales",
    label: "Покупка/продажа",
    kind: "Продажи",
    match: [
      "продажи",
      "продам",
      "куплю",
      "покупка",
      "продажа",
      "обмен",
      "отдам",
      "sale",
      "buy",
    ],
    subcategories: [
      {
        id: "sell",
        label: "Продам",
        match: ["продам", "продажа", "sell", "sale"],
      },
      { id: "buy", label: "Куплю", match: ["куплю", "покупка", "buy"] },
      { id: "exchange", label: "Обмен", match: ["обмен", "exchange", "swap"] },
      { id: "free", label: "Отдам", match: ["отдам", "бесплатно", "free"] },
    ],
  },
  {
    id: "services",
    label: "Услуги",
    kind: "Услуги",
    match: ["услуги", "сервис", "мастер", "ремонт", "помощь", "service"],
    subcategories: [
      {
        id: "beauty",
        label: "Красота",
        match: ["красота", "beauty", "мастер"],
      },
      { id: "repair", label: "Ремонт", match: ["ремонт", "repair"] },
      {
        id: "education",
        label: "Обучение",
        match: ["обучение", "уроки", "education", "teacher"],
      },
      { id: "other-services", label: "Другое", match: ["другое", "прочее"] },
    ],
  },
  {
    id: "community",
    label: "Разное",
    kind: "Разное",
    match: [
      "разное",
      "сообщество",
      "ищу",
      "нашел",
      "нашёл",
      "потеряно",
      "other",
    ],
    subcategories: [
      {
        id: "lost-found",
        label: "Находки",
        match: ["потеряно", "нашел", "нашёл", "lost", "found"],
      },
      { id: "other", label: "Другое", match: ["другое", "разное"] },
    ],
  },
];

const bulletinPrimaryButtons: BulletinPrimaryButton[] = [
  {
    id: "work",
    label: "Работа",
    sectionId: "work",
  },
  {
    id: "sales",
    label: "Покупка/продажа",
    sectionId: "sales",
  },
  {
    id: "services",
    label: "Услуги",
    sectionId: "services",
  },
  {
    id: "community",
    label: "Разное",
    sectionId: "community",
  },
];

const initialSubmissionDraft: BulletinSubmissionDraft = {
  section: "Работа",
  subcategory: "Вакансии",
  title: "",
  priceLabel: "",
  district: "",
  phone: "",
  link: "",
  contactName: "",
  description: "",
};

function getSubmissionSubcategories(section: string) {
  return (
    bulletinSections.find((item) => item.kind === section)?.subcategories || []
  );
}

function mergeCategoryWithFallback(category?: GuideCategory | null) {
  if (!category) {
    return null;
  }

  const fallback = defaultCategories.find(
    (item) => item.id === category.id || item.slug === category.slug,
  );
  if (!fallback) {
    return category;
  }

  return {
    ...fallback,
    ...category,
    filterSchema: {
      quickFilters: category.filterSchema?.quickFilters?.length
        ? category.filterSchema.quickFilters
        : fallback.filterSchema?.quickFilters || [],
      fields: category.filterSchema?.fields?.length
        ? category.filterSchema.fields
        : fallback.filterSchema?.fields || [],
    },
    imageSrc: category.imageSrc || fallback.imageSrc || "",
    description: category.description || fallback.description || "",
    shortTitle: category.shortTitle || fallback.shortTitle,
    accent: category.accent || fallback.accent,
    path: category.path || fallback.path,
    slug: category.slug || fallback.slug,
  } satisfies GuideCategory;
}

function normalizeToken(value: string) {
  return value.toLowerCase().trim().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
        return;
      }
      reject(new Error("Не удалось прочитать изображение."));
    };
    reader.onerror = () =>
      reject(reader.error ?? new Error("Не удалось прочитать изображение."));
    reader.readAsDataURL(file);
  });
}

function getPlaceSearchText(place: GuidePlace) {
  return [
    place.title,
    place.description,
    place.shortDescription,
    place.address,
    place.district,
    place.kind,
    place.cuisine,
    place.priceLabel,
    place.hours,
    ...(place.services || []),
    ...(place.tags || []),
  ]
    .filter(Boolean)
    .map((item) => normalizeToken(String(item)))
    .join(" ");
}

function placeMatchesAny(place: GuidePlace, values: string[]) {
  if (values.length === 0) {
    return true;
  }

  const text = getPlaceSearchText(place);
  return values.some((value) => text.includes(normalizeToken(value)));
}

function isPrimaryButtonActive(
  button: BulletinPrimaryButton,
  activeSectionId: BulletinSectionId,
) {
  return button.sectionId === activeSectionId;
}

function getQuickSubcategories(
  activeSection: BulletinSection,
): BulletinQuickSubcategory[] {
  if (activeSection.id === "work") {
    return [
      { id: "resume", label: "Резюме" },
      { id: "vacancy", label: "Вакансии" },
    ];
  }

  if (activeSection.id === "sales") {
    return [
      { id: "buy", label: "Покупка" },
      { id: "sell", label: "Продажа" },
    ];
  }

  return [];
}

function renderBulletinVisual(visual: BulletinVisualId) {
  if (visual === "work") {
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <rect x="23" y="38" width="74" height="54" rx="15" />
        <path d="M43 38v-7c0-5 4-9 9-9h16c5 0 9 4 9 9v7" />
        <path d="M23 57h74" />
        <circle cx="60" cy="57" r="6" />
        <path d="M38 80h44" />
      </svg>
    );
  }

  if (visual === "sales") {
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <path d="M36 35h55l-7 37H43z" />
        <path d="M28 26h10l7 46" />
        <circle cx="48" cy="86" r="8" />
        <circle cx="80" cy="86" r="8" />
        <path d="M55 48h22" />
        <path d="M60 60h14" />
      </svg>
    );
  }

  if (visual === "services") {
    return (
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <path d="M74 25l21 21-17 17-21-21z" />
        <path d="M28 86l31-31 15 15-31 31H28z" />
        <path d="M34 40l13-13 46 46-13 13z" />
        <path d="M26 94h20" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 120 120" aria-hidden="true">
      <circle cx="60" cy="59" r="36" />
      <path d="M60 28v62" />
      <path d="M29 59h62" />
      <path d="M43 36c10 8 24 8 34 0" />
      <path d="M43 82c10-8 24-8 34 0" />
      <circle cx="86" cy="34" r="8" />
    </svg>
  );
}

export function BulletinBoardExplorer() {
  const navigate = useNavigate();
  const { categories, places, loading, error } = useGuideContent();
  const { session, loading: authLoading, openSheet } = useUserAuth();
  const [activeSectionId, setActiveSectionId] =
    useState<BulletinSectionId>("all");
  const [activeSubcategoryId, setActiveSubcategoryId] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [isSubmissionOpen, setSubmissionOpen] = useState(false);
  const [submissionDraft, setSubmissionDraft] =
    useState<BulletinSubmissionDraft>(initialSubmissionDraft);
  const [submissionImageFile, setSubmissionImageFile] = useState<File | null>(null);
  const [submissionImagePreview, setSubmissionImagePreview] = useState("");
  const [submissionStatus, setSubmissionStatus] = useState("");
  const [pageNotice, setPageNotice] = useState("");
  const [isSubmitting, setSubmitting] = useState(false);
  const [selectedListing, setSelectedListing] =
    useState<BulletinListingModalInfo | null>(null);
  const [isContactSheetOpen, setContactSheetOpen] = useState(false);

  const category = useMemo(
    () =>
      mergeCategoryWithFallback(
        categories.find(
          (item) =>
            item.id === "bulletin-board" || item.slug === "bulletin-board",
        ) || null,
      ),
    [categories],
  );

  const activeSection = useMemo(
    () =>
      bulletinSections.find((section) => section.id === activeSectionId) ||
      bulletinSections[0],
    [activeSectionId],
  );

  const activeSubcategory = useMemo(
    () =>
      activeSection.subcategories.find(
        (subcategory) => subcategory.id === activeSubcategoryId,
      ) || null,
    [activeSection, activeSubcategoryId],
  );

  const quickSubcategories = useMemo(
    () => getQuickSubcategories(activeSection),
    [activeSection],
  );

  const submissionSubcategoryOptions = useMemo(
    () => getSubmissionSubcategories(submissionDraft.section),
    [submissionDraft.section],
  );

  usePageMeta({
    title: category?.title || "Доска объявлений",
    description:
      category?.description ||
      "Локальные объявления: работа, вещи, услуги и предложения сообщества.",
  });

  useEffect(() => {
    if (!submissionImageFile) {
      setSubmissionImagePreview("");
      return;
    }

    const previewUrl = URL.createObjectURL(submissionImageFile);
    setSubmissionImagePreview(previewUrl);

    return () => URL.revokeObjectURL(previewUrl);
  }, [submissionImageFile]);

  useEffect(() => {
    if (!selectedListing) {
      setContactSheetOpen(false);
      return undefined;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setSelectedListing(null);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [selectedListing]);

  const categoryPlaces = useMemo(
    () =>
      places.filter(
        (place) =>
          place.categoryId === "bulletin-board" && place.status === "published",
      ),
    [places],
  );

  const filteredPlaces = useMemo(() => {
    const query = normalizeToken(searchQuery);

    const nextPlaces = categoryPlaces.filter((place) => {
      if (
        activeSection.id !== "all" &&
        !placeMatchesAny(place, [
          activeSection.kind || activeSection.label,
          ...activeSection.match,
        ])
      ) {
        return false;
      }

      if (
        activeSubcategory &&
        !placeMatchesAny(place, [
          activeSubcategory.label,
          ...activeSubcategory.match,
        ])
      ) {
        return false;
      }

      if (query && !getPlaceSearchText(place).includes(query)) {
        return false;
      }

      return true;
    });

    return [...nextPlaces].sort(comparePlacesByPriority);
  }, [activeSection, activeSubcategory, categoryPlaces, searchQuery]);

  const handleBack = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }

    navigate("/");
  };

  const handleSectionSelect = (sectionId: BulletinSectionId) => {
    setActiveSectionId(sectionId);
    setActiveSubcategoryId("all");
  };

  const handleSubmissionToggle = () => {
    if (authLoading) {
      return;
    }

    if (!session.authenticated) {
      setPageNotice("Чтобы разместить объявление, сначала войдите в аккаунт.");
      openSheet();
      return;
    }

    setPageNotice("");
    setSubmissionOpen((current) => !current);
  };

  const updateSubmissionDraft = <Key extends keyof BulletinSubmissionDraft>(
    field: Key,
    value: BulletinSubmissionDraft[Key],
  ) => {
    setSubmissionDraft((current) => ({
      ...current,
      [field]: value,
    }));
    setSubmissionStatus("");
  };

  const handleSubmissionImageChange = (event: ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0] || null;
    setSubmissionImageFile(nextFile);
    setSubmissionStatus("");
  };

  const openListingModal = (listing: Listing) => {
    setContactSheetOpen(false);
    setSelectedListing({
      listing,
      phone: listing.phoneNumber || listing.phone || "",
      website: listing.websiteUrl || listing.website || "",
      contactName: listing.contactName || "",
      district: listing.district || listing.address || "",
      section: listing.kind || "",
      subcategory: listing.cuisine || "",
      priceLabel:
        listing.priceLabel ||
        (typeof listing.avgCheck === "number" && Number.isFinite(listing.avgCheck)
          ? `${listing.avgCheck}`
          : "Договорная"),
    });
  };

  const handleSubmissionSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!session.authenticated) {
      setSubmitting(false);
      setPageNotice("Чтобы разместить объявление, сначала войдите в аккаунт.");
      openSheet();
      return;
    }
    setSubmitting(true);
    setSubmissionStatus("Отправляю объявление...");
    setPageNotice("");

    try {
      const preparedImage = submissionImageFile
        ? await compressImage(submissionImageFile, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 0.82,
          })
        : null;
      const imageDataUrl = preparedImage
        ? await readFileAsDataUrl(preparedImage)
        : undefined;

      const response = await api.submitBulletinListing({
        ...submissionDraft,
        imageDataUrl,
        imageFileName: preparedImage?.name || submissionImageFile?.name,
      });
      setSubmissionStatus(
        response.message || "Объявление отправлено на модерацию.",
      );
      setSubmissionDraft(initialSubmissionDraft);
      setSubmissionImageFile(null);
    } catch (error) {
      setSubmissionStatus(
        error instanceof Error
          ? error.message
          : "Не удалось отправить объявление.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteOwnListing = async () => {
    if (!selectedListing) {
      return;
    }

    try {
      await api.deleteOwnBulletin(selectedListing.listing.id);
      setPageNotice("Объявление удалено.");
      setSelectedListing(null);
    } catch (error) {
      setPageNotice(
        error instanceof Error ? error.message : "Не удалось удалить объявление.",
      );
    }
  };

  const activeFeedTitle =
    activeSection.id === "all" ? "Свежие объявления" : activeSection.label;
  const canManageSelectedListing =
    Boolean(
      selectedListing &&
        session.authenticated &&
        session.user?.id &&
        selectedListing.listing.createdByUserId &&
        selectedListing.listing.createdByUserId === session.user.id,
    );

  return (
    <div className="page-stack category-explorer-page category-explorer-page--restaurants category-explorer-page--bulletin bulletin-board-page">
      <div className="category-page-back-wrap bulletin-back-wrap bulletin-toolbar">
        <button
          className="travel-topbar__button category-page-back"
          type="button"
          onClick={handleBack}
          aria-label="Назад"
        >
          <span className="category-page-back__glyph" aria-hidden="true">‹</span>
        </button>
        <label className="bulletin-search-bar bulletin-search-bar--plain">
          <span className="bulletin-search-bar__icon" aria-hidden="true">
            <svg viewBox="0 0 24 24">
              <path d="m20 20-4.4-4.4m2.4-5.1a7.5 7.5 0 1 1-15 0 7.5 7.5 0 0 1 15 0Z" />
            </svg>
          </span>
          <span className="sr-only">Поиск объявлений</span>
          <input
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Повар, байк, ремонт, резюме..."
          />
          {searchQuery ? (
            <button
              className="bulletin-search-bar__clear"
              type="button"
              onClick={() => setSearchQuery("")}
              aria-label="Очистить поиск"
            >
              ×
            </button>
          ) : null}
        </label>
      </div>

      <button
        className="button button--primary bulletin-post-button bulletin-post-button--premium bulletin-post-button--standalone"
        type="button"
        onClick={handleSubmissionToggle}
      >
        <span>
          {session.authenticated
            ? isSubmissionOpen
              ? "Скрыть форму"
              : "Разместить"
            : "Войти и разместить"}
        </span>
      </button>

      {pageNotice ? (
        <div className="bulletin-page-notice" role="status">
          {pageNotice}
        </div>
      ) : null}

      {isSubmissionOpen ? (
        <form
          className="bulletin-submit-form bulletin-submit-form--premium"
          onSubmit={handleSubmissionSubmit}
        >
          <div className="bulletin-submit-form__header">
            <span>Разместить объявление</span>
            <p>После модерации оно появится в ленте.</p>
          </div>

          <div className="bulletin-filter-grid bulletin-submit-form__grid">
            <label className="field">
              <span>Раздел</span>
              <select
                value={submissionDraft.section}
                onChange={(event) => {
                  const nextSection = event.target.value;
                  const nextSubcategory =
                    getSubmissionSubcategories(nextSection)[0]?.label || "";
                  setSubmissionDraft((current) => ({
                    ...current,
                    section: nextSection,
                    subcategory: nextSubcategory,
                  }));
                  setSubmissionStatus("");
                }}
              >
                {bulletinSections
                  .filter((section) => section.kind)
                  .map((section) => (
                    <option key={section.id} value={section.kind}>
                      {section.label}
                    </option>
                  ))}
              </select>
            </label>
            <label className="field">
              <span>Подкатегория</span>
              <select
                value={submissionDraft.subcategory}
                onChange={(event) =>
                  updateSubmissionDraft("subcategory", event.target.value)
                }
              >
                {submissionSubcategoryOptions.map((option) => (
                  <option key={option.id} value={option.label}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Цена / зарплата</span>
              <input
                value={submissionDraft.priceLabel}
                onChange={(event) =>
                  updateSubmissionDraft("priceLabel", event.target.value)
                }
                placeholder="Договорная"
              />
            </label>
          </div>

          <label className="bulletin-search-field bulletin-submit-title-field">
            <span>Название</span>
            <input
              value={submissionDraft.title}
              onChange={(event) =>
                updateSubmissionDraft("title", event.target.value)
              }
              placeholder="Коротко: что продаёте или кого ищете"
            />
          </label>

          <label className="bulletin-search-field bulletin-search-field--textarea">
            <span>Описание</span>
            <textarea
              value={submissionDraft.description}
              onChange={(event) =>
                updateSubmissionDraft("description", event.target.value)
              }
              rows={4}
              placeholder="Условия, детали, график, состояние товара или требования"
            />
          </label>

          <div className="bulletin-filter-grid bulletin-submit-form__grid bulletin-submit-form__grid--contacts">
            <label className="field">
              <span>Имя</span>
              <input
                value={submissionDraft.contactName}
                onChange={(event) =>
                  updateSubmissionDraft("contactName", event.target.value)
                }
                placeholder="Как к вам обращаться"
              />
            </label>
            <label className="field">
              <span>Телефон</span>
              <input
                value={submissionDraft.phone}
                onChange={(event) =>
                  updateSubmissionDraft("phone", event.target.value)
                }
                placeholder="+84..."
              />
            </label>
            <label className="field">
              <span>Ссылка / Telegram</span>
              <input
                value={submissionDraft.link}
                onChange={(event) =>
                  updateSubmissionDraft("link", event.target.value)
                }
                placeholder="https://t.me/..."
              />
            </label>
          </div>

          <label className="field field--file bulletin-submit-form__file">
            <span>Фото объявления</span>
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              onChange={handleSubmissionImageChange}
            />
            <small>
              Можно добавить своё фото. Если не загружать, останется картинка по
              умолчанию.
            </small>
          </label>

          {submissionImagePreview ? (
            <div className="bulletin-submit-form__image-preview">
              <img src={submissionImagePreview} alt="Предпросмотр объявления" />
            </div>
          ) : null}

          {submissionStatus ? (
            <div className="bulletin-submit-form__status">
              {submissionStatus}
            </div>
          ) : null}

          <div className="bulletin-submit-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Отправляю..." : "Отправить на модерацию"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={() => setSubmissionOpen(false)}
              disabled={isSubmitting}
            >
              Закрыть
            </button>
          </div>
        </form>
      ) : null}

      <section
        className="bulletin-category-stage"
        aria-label="Категории объявлений"
      >
        <div className="bulletin-category-mosaic">
          {bulletinPrimaryButtons.map((button) => (
            <button
              key={button.id}
              type="button"
              className={`bulletin-category-card ${isPrimaryButtonActive(button, activeSectionId) ? "is-active" : ""}`}
              data-bulletin-tone={button.id}
              onClick={() =>
                handleSectionSelect(
                  activeSectionId === button.sectionId ? "all" : button.sectionId,
                )
              }
              aria-pressed={isPrimaryButtonActive(button, activeSectionId)}
            >
              <span className="bulletin-category-card__visual">
                <span className="bulletin-category-card__orb" />
                {renderBulletinVisual(button.id)}
              </span>
              <span className="bulletin-category-card__copy">
                <strong>{button.label}</strong>
              </span>
            </button>
          ))}
        </div>
      </section>

      {quickSubcategories.length > 0 ? (
        <section
          className="bulletin-quick-subcategory-row bulletin-quick-subcategory-row--premium"
          aria-label="Быстрый выбор подкатегории"
        >
          {quickSubcategories.map((subcategory) => (
            <button
              key={subcategory.id}
              type="button"
              className={`button button--ghost bulletin-quick-subcategory-button ${activeSubcategoryId === subcategory.id ? "is-active" : ""}`}
              onClick={() =>
                setActiveSubcategoryId((current) =>
                  current === subcategory.id ? "all" : subcategory.id,
                )
              }
            >
              {subcategory.label}
            </button>
          ))}
        </section>
      ) : null}

      <section
        className="bulletin-feed-head"
        aria-label="Результаты фильтрации"
      >
        <h2>{activeFeedTitle}</h2>
      </section>

      {loading ? (
        <div className="travel-state-card">Загружаю объявления…</div>
      ) : null}
      {error ? (
        <div className="travel-state-card">
          <strong>Не удалось обновить объявления</strong>
          <p>{error}</p>
        </div>
      ) : null}

      {!loading && filteredPlaces.length > 0 ? (
        <section className="restaurant-list bulletin-list bulletin-list--premium">
          {filteredPlaces.map((item) => {
            const listing = toListingLike(item);
            return (
              <ListingCard
                key={item.id}
                listing={listing}
                accent={category?.accent || "bridge"}
                variant="bulletin"
                onOpen={openListingModal}
              />
            );
          })}
        </section>
      ) : null}

      {!loading && filteredPlaces.length === 0 ? (
        <section className="travel-state-card bulletin-empty-card">
          <strong>
            {categoryPlaces.length > 0
              ? "По выбранным параметрам ничего не найдено"
              : "Пока нет объявлений"}
          </strong>
          <p>
            {categoryPlaces.length > 0
              ? "Измени категорию или поисковый запрос."
              : "Добавь первое объявление в CMS: категория “Доска объявлений”, раздел в поле “Тип”, подкатегория в поле “Кухня / направление”."}
          </p>
        </section>
      ) : null}

      {selectedListing ? (
        <div
          className="modal-backdrop bulletin-modal-backdrop"
          role="presentation"
          onClick={() => setSelectedListing(null)}
        >
          <div
            className="modal-window filter-modal bulletin-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="bulletin-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="modal-window__header bulletin-detail-modal__header">
              <div>
                <strong id="bulletin-detail-title">
                  {selectedListing.listing.title}
                </strong>
                <small>
                  {[selectedListing.section, selectedListing.subcategory]
                    .filter(Boolean)
                    .join(" · ")}
                </small>
              </div>
              <button
                className="modal-window__close"
                type="button"
                onClick={() => setSelectedListing(null)}
                aria-label="Закрыть"
              >
                ×
              </button>
            </div>

            <div className="modal-window__body bulletin-detail-modal__body">
              <div className="bulletin-detail-modal__image">
                <img
                  src={
                    selectedListing.listing.coverImageUrl ||
                    selectedListing.listing.imageUrls[0] ||
                    "/home-icons/custom/bulletin-board.png"
                  }
                  alt={selectedListing.listing.title}
                />
              </div>

              <div className="bulletin-detail-modal__facts">
                <span className="travel-list-card__restaurant-fact travel-list-card__restaurant-fact--check">
                  <span className="travel-list-card__restaurant-fact-label">
                    {selectedListing.section === "Работа" ? "ЗП" : "Цена"}
                  </span>
                  <span className="travel-list-card__restaurant-fact-value">
                    {selectedListing.priceLabel}
                  </span>
                </span>
                {selectedListing.district ? (
                  <span className="travel-list-card__restaurant-fact travel-list-card__restaurant-fact--hours">
                    <span className="travel-list-card__restaurant-fact-label">
                      Район
                    </span>
                    <span className="travel-list-card__restaurant-fact-value">
                      {selectedListing.district}
                    </span>
                  </span>
                ) : null}
              </div>

              <div className="bulletin-detail-modal__description">
                {selectedListing.listing.description}
              </div>

              <div className="bulletin-detail-modal__actions">
                {selectedListing.phone || selectedListing.website ? (
                  <button
                    className="button button--primary"
                    type="button"
                    onClick={() =>
                      setContactSheetOpen((current) => !current)
                    }
                  >
                    Связаться
                  </button>
                ) : null}
                {canManageSelectedListing ? (
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => void handleDeleteOwnListing()}
                  >
                    Удалить объявление
                  </button>
                ) : null}
              </div>

              {isContactSheetOpen ? (
                <div className="bulletin-contact-sheet">
                  {selectedListing.contactName ? (
                    <div className="bulletin-contact-sheet__name">
                      {selectedListing.contactName}
                    </div>
                  ) : null}
                  <div className="bulletin-contact-sheet__actions">
                    {selectedListing.phone ? (
                      <a
                        className="button button--primary"
                        href={`tel:${selectedListing.phone}`}
                      >
                        Позвонить
                      </a>
                    ) : null}
                    {selectedListing.website ? (
                      <a
                        className="button button--ghost"
                        href={selectedListing.website}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Открыть ссылку
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
