import { useCallback, useEffect, useMemo, useState } from "react";
import { api } from "../../api/client";
import { updateGuideContent } from "../../data/guideContent";
import type { ContentReport, GuidePlace, Listing } from "../../types";

type OwnerBulletinModerationPanelProps = {
  items: GuidePlace[];
};

type ModerationBucket = NonNullable<GuidePlace["status"]>;

const moderationBuckets: Array<{
  id: ModerationBucket;
  label: string;
  emptyTitle: string;
  emptyText: string;
}> = [
  {
    id: "draft",
    label: "На модерации",
    emptyTitle: "Нет объявлений на модерации",
    emptyText: "Новые пользовательские объявления появятся здесь."
  },
  {
    id: "hidden",
    label: "Скрытые",
    emptyTitle: "Нет скрытых объявлений",
    emptyText: "Скрытые объявления можно будет вернуть в публикацию отсюда."
  },
  {
    id: "published",
    label: "Опубликованные",
    emptyTitle: "Пока нет опубликованных объявлений",
    emptyText: "После одобрения объявления попадут в этот список."
  }
];

const moderationStatusMeta: Record<
  ModerationBucket,
  { label: string; className: string }
> = {
  published: { label: "Опубликовано", className: "is-published" },
  hidden: { label: "Скрыто", className: "is-hidden" },
  draft: { label: "На модерации", className: "is-draft" }
};

const reportReasonLabels: Record<ContentReport["reason"], string> = {
  spam: "Спам",
  illegal: "Запрещённый контент",
  offensive: "Оскорбительный контент",
  misleading: "Недостоверная информация",
  other: "Другое"
};

const reportStatusLabels: Record<ContentReport["status"], string> = {
  new: "Новая",
  reviewed: "Проверена",
  dismissed: "Отклонена",
  action_taken: "Приняты меры"
};

function sortBulletinItems(left: GuidePlace, right: GuidePlace) {
  const leftOrder = Number(left.sortOrder ?? 1000);
  const rightOrder = Number(right.sortOrder ?? 1000);
  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }
  if (left.top !== right.top) {
    return Number(right.top) - Number(left.top);
  }
  return right.id.localeCompare(left.id);
}

export function OwnerBulletinModerationPanel({
  items
}: OwnerBulletinModerationPanelProps) {
  const [activeBucket, setActiveBucket] = useState<ModerationBucket>("draft");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [renderLimit, setRenderLimit] = useState(24);
  const [reports, setReports] = useState<ContentReport[]>([]);
  const [reportsStatus, setReportsStatus] = useState("");
  const [busyReportId, setBusyReportId] = useState<string | null>(null);

  const bulletinItems = useMemo(
    () =>
      items
        .filter((item) => item.categoryId === "bulletin-board")
        .sort(sortBulletinItems),
    [items]
  );

  const counts = useMemo(() => {
    return bulletinItems.reduce(
      (accumulator, item) => {
        const bucket = item.status || "published";
        accumulator[bucket] += 1;
        return accumulator;
      },
      { draft: 0, hidden: 0, published: 0 } as Record<ModerationBucket, number>
    );
  }, [bulletinItems]);

  const visibleItems = useMemo(
    () => bulletinItems.filter((item) => (item.status || "published") === activeBucket),
    [activeBucket, bulletinItems]
  );

  useEffect(() => {
    setRenderLimit(24);
  }, [activeBucket, visibleItems.length]);

  const loadReports = useCallback(async () => {
    try {
      const response = await api.ownerReports();
      setReports(response.reports);
    } catch (error) {
      setReportsStatus(error instanceof Error ? error.message : "Не удалось загрузить жалобы.");
    }
  }, []);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const visiblePageItems = useMemo(
    () => visibleItems.slice(0, renderLimit),
    [renderLimit, visibleItems]
  );

  const syncSavedPlace = useCallback((savedPlace: GuidePlace) => {
    updateGuideContent(
      (current) => ({
        ...current,
        places: current.places.some((item) => item.id === savedPlace.id)
          ? current.places.map((item) => (item.id === savedPlace.id ? savedPlace : item))
          : [...current.places, savedPlace]
      }),
      { persist: false }
    );
  }, []);

  const syncDeletedPlace = useCallback((id: string) => {
    updateGuideContent(
      (current) => ({
        ...current,
        places: current.places.filter((item) => item.id !== id)
      }),
      { persist: false }
    );
  }, []);

  const updateItemStatus = useCallback(
    async (item: GuidePlace, nextStatus: ModerationBucket) => {
      setBusyId(item.id);
      const moderationNote =
        nextStatus === "hidden"
          ? window.prompt("Почему объявление не прошло модерацию?", item.moderationNote || "")?.trim() || ""
          : nextStatus === "published"
            ? ""
            : item.moderationNote || "";
      setStatus(
        nextStatus === "published"
          ? "Публикую объявление..."
          : nextStatus === "hidden"
            ? "Скрываю объявление..."
            : "Обновляю статус объявления..."
      );

      try {
        const response = await api.saveListing(
          {
            ...(item as Listing),
            categorySlug: item.categorySlug || item.categoryId,
            status: nextStatus,
            moderationNote,
            title: item.title
          },
          { isNew: false }
        );

        syncSavedPlace(response.listing as GuidePlace);
        setStatus(
          nextStatus === "published"
            ? "Объявление опубликовано."
            : nextStatus === "hidden"
              ? "Объявление скрыто."
              : "Статус объявления обновлён."
        );
      } catch (error) {
        setStatus(
          error instanceof Error
            ? error.message
            : "Не удалось изменить статус объявления."
        );
      } finally {
        setBusyId(null);
      }
    },
    [syncSavedPlace]
  );

  const deleteItem = useCallback(
    async (item: GuidePlace) => {
      setBusyId(item.id);
      setStatus("Удаляю объявление...");

      try {
        await api.deleteListing(item.id);
        syncDeletedPlace(item.id);
        setStatus("Объявление удалено.");
      } catch (error) {
        setStatus(
          error instanceof Error ? error.message : "Не удалось удалить объявление."
        );
      } finally {
        setBusyId(null);
      }
    },
    [syncDeletedPlace]
  );

  const handleReportAction = useCallback(
    async (report: ContentReport, action: "dismiss" | "hide_bulletin" | "block_author") => {
      setBusyReportId(report.id);
      setReportsStatus(
        action === "dismiss"
          ? "Отклоняю жалобу..."
          : action === "hide_bulletin"
            ? "Скрываю объявление..."
            : "Блокирую автора..."
      );

      try {
        const response = await api.updateOwnerReport(report.id, action);
        setReports((current) => current.map((item) => (item.id === report.id ? response.report : item)));
        if (response.report.listing?.id && (action === "hide_bulletin" || action === "block_author")) {
          updateGuideContent(
            (current) => ({
              ...current,
              places: current.places.map((item) => (
                item.categoryId === "bulletin-board" &&
                (
                  item.id === response.report.listing?.id ||
                  (action === "block_author" && item.createdByUserId && item.createdByUserId === response.report.listing?.authorUserId)
                )
                  ? { ...item, status: "hidden", visible: false }
                  : item
              ))
            }),
            { persist: false }
          );
        }
        setReportsStatus(
          action === "dismiss"
            ? "Жалоба отклонена."
            : action === "hide_bulletin"
              ? "Объявление скрыто."
              : "Автор заблокирован."
        );
        void loadReports();
      } catch (error) {
        setReportsStatus(error instanceof Error ? error.message : "Не удалось обработать жалобу.");
      } finally {
        setBusyReportId(null);
      }
    },
    [loadReports]
  );

  const activeBucketMeta =
    moderationBuckets.find((bucket) => bucket.id === activeBucket) ||
    moderationBuckets[0];

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <h2>Модерация объявлений</h2>
          <p>
            Здесь собираются объявления из пользовательской доски. Можно быстро
            опубликовать, скрыть или удалить запись.
          </p>
        </div>
      </div>

      <div className="owner-inline-tabs owner-inline-tabs--categories owner-moderation-tabs">
        {moderationBuckets.map((bucket) => (
          <button
            key={bucket.id}
            className={`button button--ghost owner-tab-button ${
              activeBucket === bucket.id ? "is-active" : ""
            }`}
            type="button"
            onClick={() => setActiveBucket(bucket.id)}
            aria-pressed={activeBucket === bucket.id}
          >
            <span className="owner-tab-button__text">{bucket.label}</span>
            <span className="owner-tab-button__count">{counts[bucket.id]}</span>
          </button>
        ))}
      </div>

      {status ? <div className="owner-editor-status">{status}</div> : null}

      <div className="owner-editor-card owner-editor-list">
        <div className="owner-editor-list__head owner-editor-list__head--stack">
          <div>
            <strong>Жалобы</strong>
            <span>{reports.length} шт.</span>
          </div>
          <span>Проверяй пользовательские жалобы на объявления и принимай меры.</span>
        </div>

        {reportsStatus ? <div className="owner-editor-status">{reportsStatus}</div> : null}

        <div className="owner-item-list owner-moderation-list">
          {reports.length > 0 ? (
            reports.slice(0, 24).map((report) => {
              const isBusy = busyReportId === report.id;
              const listingStatus = report.listing?.status || "hidden";
              const listingStatusMeta = moderationStatusMeta[listingStatus] || moderationStatusMeta.hidden;
              const authorLabel = report.listing?.authorName || report.listing?.authorUserId || "Автор не указан";

              return (
                <article key={report.id} className="owner-item-card owner-moderation-card">
                  <div className="owner-moderation-card__content">
                    <div className="owner-moderation-card__top">
                      <div>
                        <h3>{report.listing?.title || "Объявление не найдено"}</h3>
                        <p>{new Date(report.createdAt).toLocaleString("ru-RU")} · {reportReasonLabels[report.reason]}</p>
                      </div>
                      <span className={`owner-status-pill ${listingStatusMeta.className}`}>
                        {reportStatusLabels[report.status]}
                      </span>
                    </div>
                    <p className="owner-item-card__description">
                      {report.comment || "Комментарий не указан."}
                    </p>
                    <div className="owner-place-preview-card__badges owner-moderation-card__badges">
                      <span className="owner-meta-pill">Объявление: {listingStatusMeta.label}</span>
                      <span className="owner-meta-pill">Автор: {authorLabel}</span>
                      {report.reporter?.displayName || report.reporter?.email ? (
                        <span className="owner-meta-pill">Жалоба от: {report.reporter.displayName || report.reporter.email}</span>
                      ) : null}
                    </div>
                    {report.status === "new" ? (
                      <div className="owner-item-card__actions owner-moderation-card__actions">
                        <button className="button button--ghost" type="button" disabled={isBusy || !report.listing?.id} onClick={() => handleReportAction(report, "hide_bulletin")}>
                          Скрыть объявление
                        </button>
                        <button className="button button--ghost" type="button" disabled={isBusy || !report.listing?.authorUserId} onClick={() => handleReportAction(report, "block_author")}>
                          Заблокировать автора
                        </button>
                        <button className="button button--ghost" type="button" disabled={isBusy} onClick={() => handleReportAction(report, "dismiss")}>
                          Отклонить жалобу
                        </button>
                      </div>
                    ) : null}
                  </div>
                </article>
              );
            })
          ) : (
            <article className="owner-place-preview-card owner-place-preview-card--empty">
              <strong>Жалоб пока нет</strong>
              <p>Новые жалобы пользователей появятся здесь.</p>
            </article>
          )}
        </div>
      </div>

      <div className="owner-editor-card owner-editor-list">
        <div className="owner-editor-list__head owner-editor-list__head--stack">
          <div>
            <strong>{activeBucketMeta.label}</strong>
            <span>{visibleItems.length} шт.</span>
          </div>
          <span>
            Для публичных отправок основной рабочий поток — вкладка “На
            модерации”.
          </span>
        </div>

        <div className="owner-item-list owner-moderation-list">
          {visibleItems.length > 0 ? (
            visiblePageItems.map((item) => {
              const isBusy = busyId === item.id;
              const normalizedStatus = item.status || "published";
              const itemStatus = moderationStatusMeta[normalizedStatus];
              const previewImage =
                item.coverImageUrl ||
                item.imageSrc ||
                item.imageGallery?.[0] ||
                "/home-icons/custom/bulletin-board.png";

              return (
                <article key={item.id} className="owner-item-card owner-moderation-card">
                  <div className="owner-moderation-card__frame">
                    <div className="owner-moderation-card__media">
                      <img
                        src={previewImage}
                        alt={item.imageLabel || item.title}
                        loading="lazy"
                      />
                    </div>

                    <div className="owner-moderation-card__content">
                      <div className="owner-moderation-card__top">
                        <div>
                          <h3>{item.title}</h3>
                          <p>
                            {[item.kind, item.cuisine].filter(Boolean).join(" · ")}
                          </p>
                        </div>
                        <span className={`owner-status-pill ${itemStatus.className}`}>
                          {itemStatus.label}
                        </span>
                      </div>

                      <p className="owner-item-card__description">
                        {item.description}
                      </p>

                      <div className="owner-place-preview-card__badges owner-moderation-card__badges">
                        {item.priceLabel ? (
                          <span className="owner-meta-pill owner-meta-pill--accent">
                            {item.priceLabel}
                          </span>
                        ) : null}
                        {item.district ? (
                          <span className="owner-meta-pill">{item.district}</span>
                        ) : null}
                        {item.phone ? (
                          <span className="owner-meta-pill">{item.phone}</span>
                        ) : null}
                        {item.website ? (
                          <span className="owner-meta-pill">Есть ссылка</span>
                        ) : null}
                      </div>

                      {item.moderationNote ? (
                        <p className="owner-item-card__description">
                          Причина: {item.moderationNote}
                        </p>
                      ) : null}

                      <div className="owner-item-card__actions owner-moderation-card__actions">
                        {normalizedStatus !== "published" ? (
                          <button
                            className="button button--primary"
                            type="button"
                            onClick={() => updateItemStatus(item, "published")}
                            disabled={isBusy}
                          >
                            Опубликовать
                          </button>
                        ) : null}

                        {normalizedStatus !== "hidden" ? (
                          <button
                            className="button button--ghost"
                            type="button"
                            onClick={() => updateItemStatus(item, "hidden")}
                            disabled={isBusy}
                          >
                            Скрыть
                          </button>
                        ) : null}

                        <button
                          className="button button--ghost button--danger"
                          type="button"
                          onClick={() => deleteItem(item)}
                          disabled={isBusy}
                        >
                          Удалить
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          ) : (
            <article className="owner-place-preview-card owner-place-preview-card--empty">
              <strong>{activeBucketMeta.emptyTitle}</strong>
              <p>{activeBucketMeta.emptyText}</p>
            </article>
          )}

          {visibleItems.length > renderLimit ? (
            <button
              className="button button--ghost owner-list-more-button"
              type="button"
              onClick={() => setRenderLimit((current) => current + 24)}
            >
              Показать ещё {Math.min(24, visibleItems.length - renderLimit)}
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
