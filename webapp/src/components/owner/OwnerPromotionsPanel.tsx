import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { api } from "../../api/client";
import type { GuidePlace, Promotion, PromotionStatus, PromotionPushStats } from "../../types";

type OwnerPromotionsPanelProps = {
  items: GuidePlace[];
};

const emptyDraft = {
  listingId: "",
  title: "",
  description: "",
  startsAt: "",
  endsAt: "",
  status: "draft" as PromotionStatus
};

const statusLabels: Record<PromotionStatus, string> = {
  draft: "Черновик",
  published: "Опубликована",
  archived: "Архив"
};

function formatPushStats(stats: PromotionPushStats) {
  return `Отправлено: ${stats.sent}, ошибок: ${stats.failed}, пропущено: ${stats.skipped}`;
}

export function OwnerPromotionsPanel({ items }: OwnerPromotionsPanelProps) {
  const [promotions, setPromotions] = useState<Promotion[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState("");
  const [status, setStatus] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  const listingOptions = useMemo(
    () => items
      .filter((item) => item.categoryId !== "bulletin-board" && (item.status || "published") !== "hidden")
      .sort((left, right) => left.title.localeCompare(right.title)),
    [items]
  );

  const loadPromotions = useCallback(async () => {
    try {
      const response = await api.ownerPromotions();
      setPromotions(response.promotions);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось загрузить акции.");
    }
  }, []);

  useEffect(() => {
    void loadPromotions();
  }, [loadPromotions]);

  const resetDraft = () => {
    setDraft(emptyDraft);
    setEditingId("");
  };

  const handleEdit = (promotion: Promotion) => {
    setEditingId(promotion.id);
    setDraft({
      listingId: promotion.listingId,
      title: promotion.title,
      description: promotion.description,
      startsAt: promotion.startsAt || "",
      endsAt: promotion.endsAt || "",
      status: promotion.status
    });
    window.scrollTo({ top: 0, left: 0, behavior: "smooth" });
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft.listingId || !draft.title.trim()) {
      setStatus("Выберите заведение и укажите название акции.");
      return;
    }

    setBusyId("save");
    try {
      const response = await api.saveOwnerPromotion({
        id: editingId || undefined,
        listingId: draft.listingId,
        title: draft.title,
        description: draft.description,
        startsAt: draft.startsAt,
        endsAt: draft.endsAt,
        status: draft.status
      });
      setPromotions((current) => [response.promotion, ...current.filter((item) => item.id !== response.promotion.id)]);
      setStatus(editingId ? "Акция обновлена." : "Акция создана.");
      resetDraft();
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось сохранить акцию.");
    } finally {
      setBusyId(null);
    }
  };

  const handleSendPush = async (promotion: Promotion, force = false) => {
    if (promotion.status !== "published") {
      setStatus("Push можно отправить только для опубликованной акции.");
      return;
    }

    setBusyId(promotion.id);
    try {
      const response = await api.sendOwnerPromotionPush(promotion.id, { force });
      setPromotions((current) => current.map((item) => (item.id === response.promotion.id ? response.promotion : item)));
      setStatus(formatPushStats(response.stats));
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Не удалось отправить push.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <h2>Акции</h2>
          <p>Информативные push-уведомления уходят только пользователям, которые включили уведомления об акциях.</p>
        </div>
      </div>

      <div className="owner-cms-layout owner-cms-layout--stack">
        <form className="owner-editor-card owner-editor-form" onSubmit={handleSubmit}>
          <div className="owner-editor-form__grid owner-editor-form__grid--double">
            <label className="field">
              <span>Заведение</span>
              <select value={draft.listingId} onChange={(event) => setDraft((current) => ({ ...current, listingId: event.target.value }))}>
                <option value="">Выберите карточку</option>
                {listingOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.title}</option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Статус</span>
              <select value={draft.status} onChange={(event) => setDraft((current) => ({ ...current, status: event.target.value as PromotionStatus }))}>
                <option value="draft">Черновик</option>
                <option value="published">Опубликована</option>
                <option value="archived">Архив</option>
              </select>
            </label>
            <label className="field">
              <span>Название акции</span>
              <input value={draft.title} maxLength={120} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} />
            </label>
            <label className="field">
              <span>Срок окончания</span>
              <input value={draft.endsAt} placeholder="например: 30 июня" onChange={(event) => setDraft((current) => ({ ...current, endsAt: event.target.value }))} />
            </label>
          </div>
          <label className="field">
            <span>Описание</span>
            <textarea value={draft.description} maxLength={600} rows={4} onChange={(event) => setDraft((current) => ({ ...current, description: event.target.value }))} />
          </label>
          {status ? <div className="owner-editor-card__status">{status}</div> : null}
          <div className="owner-editor-form__actions">
            <button type="submit" className="button button--primary" disabled={busyId === "save"}>{editingId ? "Сохранить акцию" : "Создать акцию"}</button>
            {editingId ? <button type="button" className="button button--ghost" onClick={resetDraft}>Отмена</button> : null}
          </div>
        </form>

        <div className="owner-moderation-list">
          {promotions.map((promotion) => (
            <article key={promotion.id} className="owner-moderation-card">
              <div className="owner-moderation-card__content">
                <div className="owner-moderation-card__top">
                  <div>
                    <h3>{promotion.title}</h3>
                    <p>{promotion.listing?.title || "Заведение не найдено"} · {statusLabels[promotion.status]}</p>
                  </div>
                  <div className="owner-moderation-card__badges">
                    {promotion.endsAt ? <span>До {promotion.endsAt}</span> : null}
                    {promotion.pushSentAt ? <span>Push отправлен</span> : null}
                  </div>
                </div>
                {promotion.description ? <p>{promotion.description}</p> : null}
                <div className="owner-moderation-card__actions">
                  <button type="button" className="button button--ghost" onClick={() => handleEdit(promotion)}>Редактировать</button>
                  <button type="button" className="button button--primary" disabled={busyId === promotion.id || promotion.status !== "published"} onClick={() => void handleSendPush(promotion)}>
                    Отправить push
                  </button>
                  {promotion.pushSentAt ? (
                    <button type="button" className="button button--ghost" disabled={busyId === promotion.id} onClick={() => void handleSendPush(promotion, true)}>
                      Повторить
                    </button>
                  ) : null}
                </div>
              </div>
            </article>
          ))}
          {promotions.length === 0 ? (
            <article className="owner-selection-card">
              <div className="owner-selection-card__header">
                <h3>Акций пока нет</h3>
                <span>Создайте первую акцию и опубликуйте её перед отправкой push.</span>
              </div>
            </article>
          ) : null}
        </div>
      </div>
    </section>
  );
}
