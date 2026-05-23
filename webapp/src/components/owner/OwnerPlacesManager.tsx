import {
  ChangeEvent,
  FormEvent,
  useEffect,
  memo,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import { api } from "../../api/client";
import { updateGuideContent } from "../../data/guideContent";
import type {
  GuideCategory,
  GuideCategoryId,
  GuidePlace,
  Listing,
} from "../../types";
import { CategoryIcon } from "../common/CategoryIcon";
import { uploadImageAsset } from "../../utils/imageUpload";
import { OwnerMapPicker } from "../map/OwnerMapPicker";
import { type AppMapPoint } from "../../utils/appMap";

type OwnerPlacesManagerProps = {
  items: GuidePlace[];
  categories: GuideCategory[];
};

type PlaceDraft = {
  id?: string;
  categoryId: GuidePlace["categoryId"];
  title: string;
  slug: string;
  description: string;
  address: string;
  district: string;
  mapQuery: string;
  phone: string;
  website: string;
  hours: string;
  avgCheck: string;
  hotelStars: string;
  kind: string;
  cuisine: string;
  services: string;
  tags: string;
  breakfast: boolean;
  vegan: boolean;
  pets: boolean;
  hotelPool: boolean;
  hotelSpa: boolean;
  childPrograms: boolean;
  top: boolean;
  status: NonNullable<GuidePlace["status"]>;
  sortOrder: string;
  lat: string;
  lng: string;
  imageLabel: string;
  imageSrc: string;
  imageGallery: string[];
};

const initialDraft: PlaceDraft = {
  categoryId: "restaurants",
  title: "",
  slug: "",
  description: "",
  address: "",
  district: "",
  mapQuery: "",
  phone: "",
  website: "",
  hours: "",
  avgCheck: "",
  hotelStars: "",
  kind: "",
  cuisine: "",
  services: "",
  tags: "",
  breakfast: false,
  vegan: false,
  pets: false,
  hotelPool: false,
  hotelSpa: false,
  childPrograms: false,
  top: false,
  status: "published",
  sortOrder: "100",
  lat: "",
  lng: "",
  imageLabel: "",
  imageSrc: "",
  imageGallery: [],
};

type RequiredPlaceField = "title" | "description";

const requiredPlaceFieldLabels: Record<RequiredPlaceField, string> = {
  title: "название",
  description: "описание",
};

function getMissingRequiredFields(draft: PlaceDraft): RequiredPlaceField[] {
  const requiredFields: Array<[RequiredPlaceField, string]> = [
    ["title", draft.title],
    ["description", draft.description],
  ];

  return requiredFields
    .filter(([, value]) => !value.trim())
    .map(([field]) => field);
}

const statusMeta: Record<
  NonNullable<GuidePlace["status"]>,
  { label: string; className: string; helper: string }
> = {
  published: {
    label: "Опубликовано",
    className: "is-published",
    helper: "Карточка видна в публичной части приложения.",
  },
  hidden: {
    label: "Скрыто",
    className: "is-hidden",
    helper: "Карточка сохранена, но не показывается пользователям.",
  },
  draft: {
    label: "Черновик",
    className: "is-draft",
    helper: "Карточка редактируется и не публикуется наружу.",
  },
};

const bulletinCategoryOptions = [
  {
    value: "Работа",
    label: "Работа",
    subcategories: ["Вакансии", "Резюме"],
  },
  {
    value: "Продажи",
    label: "Продажи",
    subcategories: ["Продам", "Куплю", "Обмен", "Отдам"],
  },
  {
    value: "Услуги",
    label: "Услуги",
    subcategories: ["Красота", "Ремонт", "Обучение", "Другое"],
  },
  {
    value: "Разное",
    label: "Разное",
    subcategories: ["Находки", "Встречи", "Другое"],
  },
];

function getBulletinSubcategories(kind: string) {
  return (
    bulletinCategoryOptions.find((item) => item.value === kind)
      ?.subcategories || []
  );
}

function getBulletinKindValue(value: string) {
  return bulletinCategoryOptions.some((item) => item.value === value)
    ? value
    : "Работа";
}

function getBulletinCuisineValue(kind: string, value: string) {
  const options = getBulletinSubcategories(kind);
  return options.includes(value) ? value : options[0] || "";
}

function createEmptyDraftForCategory(
  categoryId: GuideCategoryId,
  sortOrder: string,
): PlaceDraft {
  const base = {
    ...initialDraft,
    categoryId,
    sortOrder,
  };

  if (categoryId !== "bulletin-board") {
    return base;
  }

  return {
    ...base,
    kind: "Работа",
    cuisine: "Вакансии",
    imageLabel: "Фото объявления",
  };
}

function createId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `place-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function parseMultiValue(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function normalizeSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9а-яё\s-]/gi, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseNullableNumber(value: string) {
  if (!value.trim()) {
    return null;
  }

  const parsed = Number(value.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

function parseAverageCheckNumber(value: string) {
  const digitsOnly = value.replace(/[^\d]/g, "");
  if (!digitsOnly) {
    return null;
  }

  const parsed = Number(digitsOnly);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeAverageCheckLabel(value: string) {
  const trimmed = value.trim().replace(/\s+/g, " ");
  if (!trimmed) {
    return "";
  }

  const normalizedCurrencyText = trimmed
    .replace(/\s*vnd\b/gi, " VND")
    .replace(/\s+/g, " ")
    .trim();
  const numericValue = parseAverageCheckNumber(normalizedCurrencyText);
  const rawWithoutCurrency = normalizedCurrencyText
    .replace(/\s*VND\b/gi, "")
    .trim();
  const isNumericLike = /^[\d\s,._-]+$/.test(rawWithoutCurrency);

  if (
    numericValue !== null &&
    (isNumericLike || /\bVND\b/i.test(normalizedCurrencyText))
  ) {
    return `${numericValue.toLocaleString("en-US")} VND`;
  }

  return normalizedCurrencyText;
}

function getPlaceImages(item: GuidePlace) {
  if (Array.isArray(item.imageGallery) && item.imageGallery.length > 0) {
    return item.imageGallery;
  }
  return item.imageSrc ? [item.imageSrc] : [];
}

function getOwnerPreviewImage(item: GuidePlace) {
  return (
    getPlaceImages(item)[0] ||
    (item.categoryId === "bulletin-board"
      ? "/home-icons/custom/bulletin-board.png"
      : "/home-hero-background.png")
  );
}

function toDraft(item: GuidePlace): PlaceDraft {
  const imageGallery = getPlaceImages(item);

  return {
    id: item.id,
    categoryId: item.categoryId,
    title: item.title,
    slug: item.slug || "",
    description: item.description,
    address: item.address,
    district: item.district || "",
    mapQuery: item.mapQuery || "",
    phone: item.phone,
    website: item.website,
    hours: item.hours,
    avgCheck:
      item.priceLabel?.trim() ||
      (typeof item.avgCheck === "number" && Number.isFinite(item.avgCheck)
        ? String(item.avgCheck)
        : ""),
    hotelStars:
      typeof item.hotelStars === "number" ? String(item.hotelStars) : "",
    kind: item.kind,
    cuisine: item.cuisine,
    services: item.services.join(", "),
    tags: item.tags.join(", "),
    breakfast: item.breakfast,
    vegan: item.vegan,
    pets: item.pets,
    hotelPool: Boolean(item.hotelPool),
    hotelSpa: Boolean(item.hotelSpa),
    childPrograms: item.childPrograms,
    top: item.top,
    status: item.status || "published",
    sortOrder: String(item.sortOrder ?? 100),
    lat: typeof item.lat === "number" ? String(item.lat) : "",
    lng: typeof item.lng === "number" ? String(item.lng) : "",
    imageLabel: item.imageLabel,
    imageSrc: imageGallery[0] ?? "",
    imageGallery,
  };
}

function sortPlaces(left: GuidePlace, right: GuidePlace) {
  const leftOrder = Number(left.sortOrder ?? 1000);
  const rightOrder = Number(right.sortOrder ?? 1000);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (left.top !== right.top) {
    return Number(right.top) - Number(left.top);
  }
  return left.title.localeCompare(right.title);
}

function createPlacePayload(draft: PlaceDraft) {
  const normalizedGallery = draft.imageGallery.filter(Boolean);
  const generatedSlug = normalizeSlug(
    draft.slug ||
      draft.title ||
      `${draft.categoryId}-${draft.id || createId()}`,
  );
  const averageCheckNumber = parseAverageCheckNumber(draft.avgCheck);
  const averageCheckLabel = normalizeAverageCheckLabel(draft.avgCheck);

  return {
    id: draft.id || createId(),
    categoryId: draft.categoryId,
    categorySlug: draft.categoryId,
    title: draft.title.trim(),
    slug: generatedSlug,
    description: draft.description.trim(),
    address: draft.address.trim(),
    district: draft.district.trim(),
    mapQuery:
      draft.mapQuery.trim() ||
      (parseNullableNumber(draft.lat) !== null &&
      parseNullableNumber(draft.lng) !== null
        ? `${parseNullableNumber(draft.lat)},${parseNullableNumber(draft.lng)}`
        : ""),
    phone: draft.phone.trim(),
    website: draft.website.trim(),
    hours: draft.hours.trim(),
    avgCheck: averageCheckNumber ?? undefined,
    priceLabel: averageCheckLabel,
    hotelStars:
      draft.categoryId === "hotels" && draft.hotelStars
        ? Number(draft.hotelStars)
        : null,
    hotelPool: draft.categoryId === "hotels" ? draft.hotelPool : false,
    hotelSpa: draft.categoryId === "hotels" ? draft.hotelSpa : false,
    kind: draft.kind.trim(),
    cuisine: draft.cuisine.trim(),
    services: parseMultiValue(draft.services),
    tags: parseMultiValue(draft.tags),
    breakfast: draft.breakfast,
    vegan: draft.vegan,
    pets: draft.pets,
    childPrograms: draft.childPrograms,
    top: draft.top,
    status: draft.status,
    sortOrder: Number(draft.sortOrder || 100) || 100,
    lat: parseNullableNumber(draft.lat),
    lng: parseNullableNumber(draft.lng),
    imageLabel: draft.imageLabel.trim() || "Карточка места",
    imageSrc: normalizedGallery[0] ?? "",
    imageGallery: normalizedGallery,
  };
}

type OwnerPlacesListPanelProps = {
  accent?: string;
  categoryTitle: string;
  items: GuidePlace[];
  isBusy: boolean;
  onDelete: (id: string) => void;
  onEdit: (item: GuidePlace) => void;
};

const OwnerPlacesListPanel = memo(function OwnerPlacesListPanel({
  accent,
  categoryTitle,
  items,
  isBusy,
  onDelete,
  onEdit,
}: OwnerPlacesListPanelProps) {
  const [renderLimit, setRenderLimit] = useState(24);

  useEffect(() => {
    setRenderLimit(24);
  }, [categoryTitle, items.length]);

  const visiblePreviewItems = useMemo(
    () => items.slice(0, renderLimit),
    [items, renderLimit],
  );

  return (
    <div className="owner-editor-card owner-editor-list">
      <div className="owner-editor-list__head owner-editor-list__head--stack">
        <div>
          <strong>{categoryTitle}</strong>
          <span>{items.length} шт.</span>
        </div>
        <span>
          Список справа повторяет карточки из приложения, чтобы владелец сразу
          видел итоговый вид.
        </span>
      </div>

      <div className="owner-item-list owner-item-list--app-preview">
        {items.length > 0 ? (
          visiblePreviewItems.map((item) => {
            const itemStatus = statusMeta[item.status || "published"];
            const imageCount = getPlaceImages(item).length;
            const hasMapPoint =
              typeof item.lat === "number" &&
              Number.isFinite(item.lat) &&
              typeof item.lng === "number" &&
              Number.isFinite(item.lng);
            const previewImage = getOwnerPreviewImage(item);
            const previewMeta = item.categoryId === "bulletin-board"
              ? [item.kind, item.cuisine].filter(Boolean).join(" · ")
              : item.priceLabel || item.kind || item.cuisine || item.address;

            return (
              <article key={item.id} className="owner-place-preview-card">
                <div className="owner-place-preview-card__listing" aria-hidden="true">
                  <div
                    className="owner-place-preview-lite"
                    data-tone={accent || "bridge"}
                  >
                    <div className="owner-place-preview-lite__image-wrap">
                      <img
                        className="owner-place-preview-lite__image"
                        src={previewImage}
                        alt=""
                        loading="lazy"
                        decoding="async"
                      />
                      {imageCount > 1 ? (
                        <span className="owner-place-preview-lite__count">
                          {imageCount}
                        </span>
                      ) : null}
                    </div>

                    <div className="owner-place-preview-lite__body">
                      <strong className="owner-place-preview-lite__title">
                        {item.title}
                      </strong>
                      {previewMeta ? (
                        <span className="owner-place-preview-lite__meta">
                          {previewMeta}
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                <div className="owner-place-preview-card__admin">
                  <div className="owner-place-preview-card__badges">
                    <span
                      className={`owner-status-pill ${itemStatus.className}`}
                    >
                      {itemStatus.label}
                    </span>
                    <span className="owner-meta-pill">
                      Порядок {item.sortOrder ?? 100}
                    </span>
                    {item.top ? (
                      <span className="owner-meta-pill owner-meta-pill--accent">
                        Топ
                      </span>
                    ) : null}
                    <span className="owner-meta-pill">Фото {imageCount}</span>
                    <span
                      className={`owner-meta-pill ${hasMapPoint ? "owner-meta-pill--success" : "owner-meta-pill--muted"}`}
                    >
                      {hasMapPoint ? "Точка на карте" : "Нет точки"}
                    </span>
                  </div>

                  <div className="owner-place-preview-card__actions">
                    <button
                      className="button button--ghost"
                      type="button"
                      onClick={() => onEdit(item)}
                      disabled={isBusy}
                    >
                      Редактировать
                    </button>
                    <button
                      className="button button--ghost button--danger"
                      type="button"
                      onClick={() => onDelete(item.id)}
                      disabled={isBusy}
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              </article>
            );
          })
        ) : (
          <article className="owner-place-preview-card owner-place-preview-card--empty">
            <strong>Пока пусто</strong>
            <p>
              Когда появится первая карточка, справа сразу будет видно, как она
              выглядит в приложении.
            </p>
          </article>
        )}

        {items.length > renderLimit ? (
          <button
            className="button button--ghost owner-list-more-button"
            type="button"
            onClick={() => setRenderLimit((current) => current + 24)}
          >
            Показать ещё {Math.min(24, items.length - renderLimit)}
          </button>
        ) : null}
      </div>
    </div>
  );
});

export function OwnerPlacesManager({
  items,
  categories,
}: OwnerPlacesManagerProps) {
  const [draft, setDraft] = useState<PlaceDraft>(initialDraft);
  const [isEditing, setIsEditing] = useState(false);
  const [status, setStatus] = useState("");
  const [activeTab, setActiveTab] = useState<GuideCategoryId>("restaurants");
  const [isUploading, setIsUploading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isMapEditorOpen, setIsMapEditorOpen] = useState(false);
  const [invalidFields, setInvalidFields] = useState<RequiredPlaceField[]>([]);
  const formRef = useRef<HTMLFormElement>(null);

  const visibleCategories = useMemo(
    () =>
      categories.filter(
        (category) =>
          category.visible ||
          items.some((item) => item.categoryId === category.id),
      ),
    [categories, items],
  );

  const itemsCountByCategory = useMemo(() => {
    return items.reduce(
      (accumulator, item) => {
        accumulator[item.categoryId] = (accumulator[item.categoryId] ?? 0) + 1;
        return accumulator;
      },
      {} as Partial<Record<GuideCategoryId, number>>,
    );
  }, [items]);

  const activeCategory = useMemo(
    () => categories.find((category) => category.id === activeTab),
    [activeTab, categories],
  );

  const visibleItems = useMemo(() => {
    return [...items]
      .filter((item) => item.categoryId === activeTab)
      .sort(sortPlaces);
  }, [activeTab, items]);

  const draftStatusMeta = statusMeta[draft.status];
  const isBusy = isUploading || isSaving;
  const isBulletinDraft = draft.categoryId === "bulletin-board";
  const bulletinSubcategoryOptions = getBulletinSubcategories(draft.kind);

  const clearFieldValidation = useCallback((field: keyof PlaceDraft) => {
    setInvalidFields((current) => current.filter((item) => item !== field));
    setStatus((current) => (current ? "" : current));
  }, []);

  const updateDraftField = useCallback(
    <Key extends keyof PlaceDraft>(field: Key, value: PlaceDraft[Key]) => {
      setDraft((current) => ({
        ...current,
        [field]: value,
      }));
      clearFieldValidation(field);
    },
    [clearFieldValidation],
  );

  const getSuggestedSortOrder = useCallback(
    (categoryId: GuideCategoryId, additionalItems = 0) =>
      String(
        Math.max(
          ((itemsCountByCategory[categoryId] ?? 0) + additionalItems) * 10 + 10,
          10,
        ),
      ),
    [itemsCountByCategory],
  );

  const resetForm = useCallback(() => {
    setDraft(
      createEmptyDraftForCategory(activeTab, getSuggestedSortOrder(activeTab)),
    );
    setIsMapEditorOpen(false);
    setInvalidFields([]);
    setIsEditing(false);
    setStatus("");
  }, [activeTab, getSuggestedSortOrder]);

  const syncSavedPlace = useCallback((savedPlace: GuidePlace) => {
    updateGuideContent(
      (current) => ({
        ...current,
        places: current.places.some((item) => item.id === savedPlace.id)
          ? current.places.map((item) =>
              item.id === savedPlace.id ? savedPlace : item,
            )
          : [...current.places, savedPlace],
      }),
      { persist: false },
    );
  }, []);

  const syncDeletedPlace = useCallback((id: string) => {
    updateGuideContent(
      (current) => ({
        ...current,
        places: current.places.filter((item) => item.id !== id),
        home: {
          ...current.home,
          popularPlaceIds: current.home.popularPlaceIds.filter(
            (itemId) => itemId !== id,
          ),
        },
        collections: current.collections.map((collection) => ({
          ...collection,
          itemIds: collection.itemIds.filter((itemId) => itemId !== id),
        })),
      }),
      { persist: false },
    );
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const missingFields = getMissingRequiredFields(draft);
    if (missingFields.length > 0) {
      setInvalidFields(missingFields);
      setStatus(
        `Заполни обязательные поля: ${missingFields.map((field) => requiredPlaceFieldLabels[field]).join(", ")}.`,
      );
      requestAnimationFrame(() => {
        formRef.current
          ?.querySelector<HTMLElement>(`[name="${missingFields[0]}"]`)
          ?.focus();
      });
      return;
    }

    const nextItem = createPlacePayload(draft);

    if (!nextItem.slug) {
      setStatus(
        "Не удалось подготовить адрес карточки. Проверь название места.",
      );
      return;
    }

    setInvalidFields([]);
    setIsSaving(true);
    setStatus(draft.id ? "Сохраняю изменения..." : "Добавляю карточку...");

    try {
      const response = await api.saveListing(
        nextItem as Partial<Listing> & Pick<Listing, "categorySlug" | "title">,
        {
          isNew: !draft.id,
        },
      );
      const savedPlace = response.listing as GuidePlace;

      syncSavedPlace(savedPlace);
      setActiveTab(savedPlace.categoryId);
      setStatus(
        draft.id
          ? "Карточка обновлена и сохранена на сервере."
          : "Новая карточка добавлена и сохранена на сервере.",
      );
      setDraft(
        createEmptyDraftForCategory(
          savedPlace.categoryId,
          getSuggestedSortOrder(savedPlace.categoryId, draft.id ? 0 : 1),
        ),
      );
      setInvalidFields([]);
      setIsEditing(false);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Не удалось сохранить карточку. Попробуй ещё раз.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  const startEdit = useCallback((item: GuidePlace) => {
    setDraft(toDraft(item));
    setActiveTab(item.categoryId);
    setIsMapEditorOpen(false);
    setInvalidFields([]);
    setIsEditing(true);
    setStatus("");
  }, []);

  const deleteItem = useCallback(
    async (id: string) => {
      setIsSaving(true);
      setStatus("Удаляю карточку...");

      try {
        await api.deleteListing(id);
        syncDeletedPlace(id);

        if (draft.id === id) {
          setDraft(
            createEmptyDraftForCategory(
              activeTab,
              getSuggestedSortOrder(activeTab, -1),
            ),
          );
          setIsMapEditorOpen(false);
          setIsEditing(false);
        }

        setStatus("Карточка удалена с сервера.");
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Не удалось удалить карточку.",
        );
      } finally {
        setIsSaving(false);
      }
    },
    [activeTab, draft.id, getSuggestedSortOrder, syncDeletedPlace],
  );

  const handleImageChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    setIsUploading(true);
    setStatus(`Загружаю ${files.length} фото...`);

    try {
      const uploadedImages = await Promise.all(
        files.map((file) => uploadImageAsset(file, "place")),
      );
      setDraft((current) => ({
        ...current,
        imageGallery: [...current.imageGallery, ...uploadedImages],
        imageSrc: current.imageSrc || uploadedImages[0] || "",
        imageLabel: current.imageLabel || files[0]?.name || current.imageLabel,
      }));
      setStatus(`Загружено: ${uploadedImages.length} фото.`);
    } catch (error) {
      setStatus(
        error instanceof Error
          ? error.message
          : "Не удалось загрузить изображения.",
      );
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  const removeImage = (imageIndex: number) => {
    setDraft((current) => {
      const nextGallery = current.imageGallery.filter(
        (_, index) => index !== imageIndex,
      );
      return {
        ...current,
        imageGallery: nextGallery,
        imageSrc: nextGallery[0] ?? "",
      };
    });
  };

  const makeCover = (imageIndex: number) => {
    setDraft((current) => {
      const nextGallery = [...current.imageGallery];
      const [selectedImage] = nextGallery.splice(imageIndex, 1);
      if (!selectedImage) {
        return current;
      }
      nextGallery.unshift(selectedImage);
      return {
        ...current,
        imageGallery: nextGallery,
        imageSrc: nextGallery[0] ?? "",
      };
    });
  };

  const handleMapPointChange = useCallback((point: AppMapPoint | null) => {
    setDraft((current) => ({
      ...current,
      lat: point ? point.lat.toFixed(6) : "",
      lng: point ? point.lng.toFixed(6) : "",
      mapQuery: point ? `${point.lat.toFixed(6)},${point.lng.toFixed(6)}` : "",
    }));
    setStatus(
      point
        ? "Точка на карте приложения поставлена."
        : "Точка на карте убрана.",
    );
  }, []);

  const selectedMapPoint = useMemo(() => {
    const lat = parseNullableNumber(draft.lat);
    const lng = parseNullableNumber(draft.lng);
    if (lat === null || lng === null) {
      return null;
    }
    return { lat, lng };
  }, [draft.lat, draft.lng]);

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <span className="eyebrow">CMS / карточки</span>
          <h2>Карточки мест по категориям</h2>
          <p>
            Карточка сохраняется сразу на сервер, а справа видно, как она
            выглядит в приложении.
          </p>
        </div>
        <button
          className="button button--ghost"
          type="button"
          onClick={resetForm}
          disabled={isBusy}
        >
          Новая карточка
        </button>
      </div>

      <div className="owner-inline-tabs owner-inline-tabs--categories">
        {visibleCategories.map((category) => {
          const count = itemsCountByCategory[category.id] ?? 0;
          return (
            <button
              key={category.id}
              type="button"
              className={`button button--ghost owner-tab-button ${activeTab === category.id ? "is-active" : ""}`}
              onClick={() => {
                setActiveTab(category.id);
                if (!isEditing) {
                  setDraft((current) => {
                    if (category.id !== "bulletin-board") {
                      return {
                        ...current,
                        categoryId: category.id,
                        sortOrder: getSuggestedSortOrder(category.id),
                      };
                    }

                    return createEmptyDraftForCategory(
                      category.id,
                      getSuggestedSortOrder(category.id),
                    );
                  });
                }
              }}
            >
              <CategoryIcon categoryId={category.id} size="sm" />
              <span className="owner-tab-button__text">{category.title}</span>
              <span className="owner-tab-button__count">{count}</span>
            </button>
          );
        })}
      </div>

      <div className="owner-cms-layout">
        <form
          ref={formRef}
          className="owner-editor-card owner-editor-form"
          onSubmit={handleSubmit}
          noValidate
        >
          <div className="owner-editor-form__grid owner-editor-form__grid--double">
            <label className="field">
              <span>Категория</span>
              <select
                value={draft.categoryId}
                onChange={(event) => {
                  const nextCategoryId = event.target
                    .value as GuidePlace["categoryId"];
                  setDraft((current) => {
                    if (nextCategoryId !== "bulletin-board") {
                      return { ...current, categoryId: nextCategoryId };
                    }

                    const nextKind = getBulletinKindValue(current.kind);
                    return {
                      ...current,
                      categoryId: nextCategoryId,
                      kind: nextKind,
                      cuisine: getBulletinCuisineValue(
                        nextKind,
                        current.cuisine,
                      ),
                      imageLabel: current.imageLabel || "Фото объявления",
                    };
                  });
                  clearFieldValidation("categoryId");
                }}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.title}
                  </option>
                ))}
              </select>
            </label>

            <label
              className={
                invalidFields.includes("title")
                  ? "field field--invalid"
                  : "field"
              }
            >
              <span>Название</span>
              <input
                name="title"
                value={draft.title}
                onChange={(event) =>
                  updateDraftField("title", event.target.value)
                }
                aria-invalid={invalidFields.includes("title")}
              />
            </label>

            <label className="field">
              <span>Статус публикации</span>
              <select
                value={draft.status}
                onChange={(event) =>
                  updateDraftField(
                    "status",
                    event.target.value as NonNullable<GuidePlace["status"]>,
                  )
                }
              >
                <option value="published">Опубликовано</option>
                <option value="hidden">Скрыто</option>
                <option value="draft">Черновик</option>
              </select>
            </label>

            <label className="field">
              <span>{isBulletinDraft ? "Раздел объявления" : "Тип"}</span>
              {isBulletinDraft ? (
                <select
                  value={draft.kind || "Работа"}
                  onChange={(event) => {
                    const nextKind = event.target.value;
                    setDraft((current) => ({
                      ...current,
                      kind: nextKind,
                      cuisine: getBulletinSubcategories(nextKind)[0] || "",
                    }));
                  }}
                >
                  {bulletinCategoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft.kind}
                  onChange={(event) =>
                    updateDraftField("kind", event.target.value)
                  }
                />
              )}
            </label>

            <label className="field">
              <span>
                {isBulletinDraft ? "Подкатегория" : "Кухня / направление"}
              </span>
              {isBulletinDraft ? (
                <select
                  value={draft.cuisine || bulletinSubcategoryOptions[0] || ""}
                  onChange={(event) =>
                    updateDraftField("cuisine", event.target.value)
                  }
                >
                  {bulletinSubcategoryOptions.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  value={draft.cuisine}
                  onChange={(event) =>
                    updateDraftField("cuisine", event.target.value)
                  }
                />
              )}
            </label>

            <label className="field">
              <span>{isBulletinDraft ? "Цена / зарплата" : "Средний чек"}</span>
              <input
                type="text"
                value={draft.avgCheck}
                onChange={(event) =>
                  updateDraftField("avgCheck", event.target.value)
                }
                placeholder={
                  isBulletinDraft
                    ? "Например: 5 000 000 VND, $450 или договорная"
                    : undefined
                }
              />
            </label>

            {draft.categoryId === "hotels" ? (
              <label className="field">
                <span>Звёзды</span>
                <select
                  value={draft.hotelStars}
                  onChange={(event) =>
                    updateDraftField("hotelStars", event.target.value)
                  }
                >
                  <option value="">Не указано</option>
                  <option value="5">5★</option>
                  <option value="4">4★</option>
                  <option value="3">3★</option>
                  <option value="2">2★</option>
                  <option value="1">1★</option>
                </select>
              </label>
            ) : null}

            <label className="field">
              <span>Порядок показа</span>
              <input
                type="number"
                value={draft.sortOrder}
                onChange={(event) =>
                  updateDraftField("sortOrder", event.target.value)
                }
              />
            </label>

            <div className={`owner-status-hint ${draftStatusMeta.className}`}>
              <strong>{draftStatusMeta.label}</strong>
              <span>{draftStatusMeta.helper}</span>
            </div>
          </div>

          {!isBulletinDraft ? (
            <section className="owner-inline-card owner-map-editor-card">
              <div className="owner-editor-list__head owner-editor-list__head--stack">
                <div>
                  <strong>Карта приложения</strong>
                  <span>
                    {selectedMapPoint
                      ? `Точка установлена: ${selectedMapPoint.lat.toFixed(4)}, ${selectedMapPoint.lng.toFixed(4)}`
                      : "Точка пока не установлена"}
                  </span>
                </div>
                <button
                  className="button button--ghost"
                  type="button"
                  onClick={() => setIsMapEditorOpen((current) => !current)}
                  aria-expanded={isMapEditorOpen}
                >
                  {isMapEditorOpen ? "Скрыть карту" : "Открыть карту"}
                </button>
              </div>

              {isMapEditorOpen ? (
                <OwnerMapPicker
                  value={selectedMapPoint}
                  disabled={isBusy}
                  onChange={handleMapPointChange}
                />
              ) : (
                <p className="owner-map-editor-card__hint">
                  Карта открывается только по запросу, чтобы кабинет работал
                  быстрее при редактировании.
                </p>
              )}
            </section>
          ) : null}

          <div className="owner-editor-form__grid owner-editor-form__grid--double owner-editor-form__grid--triple">
            <label className="field">
              <span>Телефон</span>
              <input
                value={draft.phone}
                onChange={(event) =>
                  updateDraftField("phone", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>{isBulletinDraft ? "Ссылка / Telegram" : "Сайт"}</span>
              <input
                value={draft.website}
                onChange={(event) =>
                  updateDraftField("website", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>
                {isBulletinDraft ? "График / актуальность" : "Часы работы"}
              </span>
              <input
                value={draft.hours}
                onChange={(event) =>
                  updateDraftField("hours", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>Подпись на фото</span>
              <input
                value={draft.imageLabel}
                onChange={(event) =>
                  updateDraftField("imageLabel", event.target.value)
                }
              />
            </label>
          </div>

          <label
            className={
              invalidFields.includes("description")
                ? "field field--invalid field--textarea"
                : "field field--textarea"
            }
          >
            <span>Описание</span>
            <textarea
              name="description"
              value={draft.description}
              onChange={(event) =>
                updateDraftField("description", event.target.value)
              }
              rows={5}
              aria-invalid={invalidFields.includes("description")}
            />
          </label>

          <div className="owner-editor-form__grid owner-editor-form__grid--double">
            <label className="field">
              <span>
                {isBulletinDraft ? "Условия / детали" : "Услуги / особенности"}
              </span>
              <input
                value={draft.services}
                onChange={(event) =>
                  updateDraftField("services", event.target.value)
                }
              />
            </label>

            <label className="field">
              <span>
                {isBulletinDraft ? "Дополнительные теги" : "Теги и фильтры"}
              </span>
              <input
                value={draft.tags}
                onChange={(event) =>
                  updateDraftField("tags", event.target.value)
                }
              />
            </label>
          </div>

          <label className="field field--file">
            <span>{isUploading ? "Загрузка фото..." : "Фото карточки"}</span>
            <input
              type="file"
              accept="image/*"
              multiple
              onChange={handleImageChange}
              disabled={isBusy}
            />
          </label>

          {draft.imageGallery.length > 0 ? (
            <div className="owner-gallery-preview-grid">
              {draft.imageGallery.map((image, index) => (
                <article
                  key={`${image}-${index}`}
                  className="owner-gallery-preview-card"
                >
                  <img
                    src={image}
                    alt={`${draft.title || "Фото"} ${index + 1}`}
                    loading="lazy"
                    decoding="async"
                  />
                  <div className="owner-gallery-preview-card__actions">
                    {index === 0 ? (
                      <span className="owner-gallery-preview-card__cover">
                        Обложка
                      </span>
                    ) : (
                      <button
                        className="button button--ghost"
                        type="button"
                        onClick={() => makeCover(index)}
                      >
                        Сделать обложкой
                      </button>
                    )}
                    <button
                      className="button button--ghost button--danger"
                      type="button"
                      onClick={() => removeImage(index)}
                    >
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>
          ) : null}

          <div className="owner-checkbox-grid">
            {!isBulletinDraft ? (
              <>
                <label className="checkbox-pill checkbox-pill--owner">
                  <input
                    type="checkbox"
                    checked={draft.breakfast}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        breakfast: event.target.checked,
                      }))
                    }
                  />
                  <span>Есть завтраки</span>
                </label>
                <label className="checkbox-pill checkbox-pill--owner">
                  <input
                    type="checkbox"
                    checked={draft.vegan}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        vegan: event.target.checked,
                      }))
                    }
                  />
                  <span>Веган-опции</span>
                </label>
                <label className="checkbox-pill checkbox-pill--owner">
                  <input
                    type="checkbox"
                    checked={draft.pets}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        pets: event.target.checked,
                      }))
                    }
                  />
                  <span>Можно с животными</span>
                </label>
                {draft.categoryId === "hotels" ? (
                  <label className="checkbox-pill checkbox-pill--owner">
                    <input
                      type="checkbox"
                      checked={draft.hotelPool}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          hotelPool: event.target.checked,
                        }))
                      }
                    />
                    <span>Есть бассейн</span>
                  </label>
                ) : null}
                {draft.categoryId === "hotels" ? (
                  <label className="checkbox-pill checkbox-pill--owner">
                    <input
                      type="checkbox"
                      checked={draft.hotelSpa}
                      onChange={(event) =>
                        setDraft((current) => ({
                          ...current,
                          hotelSpa: event.target.checked,
                        }))
                      }
                    />
                    <span>Есть СПА</span>
                  </label>
                ) : null}
                <label className="checkbox-pill checkbox-pill--owner checkbox-pill--owner-wide">
                  <input
                    type="checkbox"
                    checked={draft.childPrograms}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        childPrograms: event.target.checked,
                      }))
                    }
                  />
                  <span>Есть детские программы</span>
                </label>
              </>
            ) : (
              <div className="owner-status-hint is-published owner-status-hint--bulletin">
                <strong>Структура объявлений</strong>
                <span>
                  Раздел хранится в поле “Раздел объявления”, подкатегория — в
                  поле “Подкатегория”. Цена участвует в фильтрах публичной
                  доски.
                </span>
              </div>
            )}
            <label className="checkbox-pill checkbox-pill--owner checkbox-pill--owner-accent">
              <input
                type="checkbox"
                checked={draft.top}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    top: event.target.checked,
                  }))
                }
              />
              <span>
                {isBulletinDraft
                  ? "Поднять выше в списке"
                  : "Показывать в топе"}
              </span>
            </label>
          </div>

          {status ? <div className="owner-editor-status">{status}</div> : null}

          <div className="owner-editor-form__actions">
            <button
              className="button button--primary"
              type="submit"
              disabled={isBusy}
            >
              {isSaving
                ? "Сохраняю..."
                : isEditing
                  ? "Сохранить изменения"
                  : "Добавить карточку"}
            </button>
            <button
              className="button button--ghost"
              type="button"
              onClick={resetForm}
              disabled={isBusy}
            >
              Очистить форму
            </button>
          </div>
        </form>

        <OwnerPlacesListPanel
          accent={activeCategory?.accent}
          categoryTitle={activeCategory?.title ?? "Карточки категории"}
          items={visibleItems}
          isBusy={isBusy}
          onDelete={deleteItem}
          onEdit={startEdit}
        />
      </div>
    </section>
  );
}
