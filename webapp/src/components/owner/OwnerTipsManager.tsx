import { FormEvent, useState } from 'react';
import { updateGuideContent } from '../../data/guideContent';
import type { GuideTip } from '../../types';

type OwnerTipsManagerProps = {
  tips: GuideTip[];
};

type TipDraft = {
  id?: string;
  title: string;
  text: string;
  linkPath: string;
  active: boolean;
};

const initialDraft: TipDraft = {
  title: '',
  text: '',
  linkPath: '/',
  active: true
};

function countActiveTips(tips: GuideTip[]) {
  return tips.filter((tip) => tip.active).length;
}

function createId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }

  return `tip-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function OwnerTipsManager({ tips }: OwnerTipsManagerProps) {
  const [draft, setDraft] = useState<TipDraft>(initialDraft);
  const [status, setStatus] = useState('');

  const resetDraft = () => setDraft(initialDraft);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.title.trim() || !draft.text.trim()) {
      setStatus('Заполни заголовок и текст совета.');
      return;
    }

    const nextTip: GuideTip = {
      id: draft.id || createId(),
      title: draft.title.trim(),
      text: draft.text.trim(),
      linkPath: draft.linkPath.trim() || '/',
      active: draft.active
    };

    updateGuideContent((current) => ({
      ...current,
      tips: draft.id
        ? current.tips.map((tip) => (tip.id === draft.id ? nextTip : tip))
        : [nextTip, ...current.tips]
    }));

    setStatus(draft.id ? 'Совет обновлён.' : 'Совет добавлен.');
    resetDraft();
  };

  const startEdit = (tip: GuideTip) => {
    setDraft({
      id: tip.id,
      title: tip.title,
      text: tip.text,
      linkPath: tip.linkPath,
      active: tip.active
    });
    setStatus('');
  };

  const deleteTip = (id: string) => {
    updateGuideContent((current) => ({
      ...current,
      tips: current.tips.filter((tip) => tip.id !== id),
      home: {
        ...current.home,
        tipIds: current.home.tipIds.filter((tipId) => tipId !== id)
      }
    }));
    if (draft.id === id) {
      resetDraft();
    }
    setStatus('Совет удалён.');
  };

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <span className="eyebrow">CMS / советы</span>
          <h2>Управление текстами в разделе “Советы”</h2>
          <p>Можно создавать отдельные советы, редактировать тексты и выбирать ссылку для перехода.</p>
        </div>
        <button className="button button--ghost" type="button" onClick={resetDraft}>
          Новый совет
        </button>
      </div>

      <div className="owner-cms-layout">
        <form className="owner-editor-card owner-editor-form" onSubmit={handleSubmit}>
          <label className="field">
            <span>Заголовок</span>
            <input
              value={draft.title}
              onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))}
            />
          </label>

          <label className="field field--textarea">
            <span>Текст совета</span>
            <textarea
              rows={5}
              value={draft.text}
              onChange={(event) => setDraft((current) => ({ ...current, text: event.target.value }))}
            />
          </label>

          <div className="owner-editor-form__grid owner-editor-form__grid--double">
            <label className="field">
              <span>Ссылка</span>
              <input
                value={draft.linkPath}
                onChange={(event) => setDraft((current) => ({ ...current, linkPath: event.target.value }))}
                placeholder="/restaurants"
              />
            </label>

            <label className="checkbox-pill checkbox-pill--owner checkbox-pill--owner-wide">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => setDraft((current) => ({ ...current, active: event.target.checked }))}
              />
              <span>Показывать совет</span>
            </label>
          </div>

          {status ? <div className="owner-editor-status">{status}</div> : null}

          <div className="owner-editor-form__actions">
            <button className="button button--primary" type="submit">
              {draft.id ? 'Сохранить совет' : 'Добавить совет'}
            </button>
          </div>
        </form>

        <div className="owner-editor-card owner-editor-list">
          <div className="owner-editor-list__head">
            <div>
              <strong>Советы</strong>
              <span>{countActiveTips(tips)} активны, {tips.length - countActiveTips(tips)} скрыты</span>
            </div>
          </div>

          <div className="owner-item-list">
            {tips.map((tip) => (
              <article key={tip.id} className="owner-item-card">
                <div className="owner-item-card__top">
                  <div>
                    <h3>{tip.title}</h3>
                    <p>{tip.linkPath}</p>
                  </div>
                  <span className={`owner-status-pill ${tip.active ? 'is-published' : 'is-hidden'}`}>
                    {tip.active ? 'Активен' : 'Скрыт'}
                  </span>
                </div>
                <p className="owner-item-card__description">{tip.text}</p>
                <div className="owner-item-card__actions">
                  <button className="button button--ghost" type="button" onClick={() => startEdit(tip)}>
                    Редактировать
                  </button>
                  <button className="button button--ghost button--danger" type="button" onClick={() => deleteTip(tip.id)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
