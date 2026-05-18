import { ChangeEvent, FormEvent, useMemo, useState } from 'react';
import { updateGuideContent } from '../../data/guideContent';
import type { GuideCollection, HomeContent } from '../../types';
import { uploadImageAsset } from '../../utils/imageUpload';

type OwnerBannerManagerProps = {
  home: HomeContent;
  collections: GuideCollection[];
};

type BannerDraft = {
  id?: string;
  title: string;
  description: string;
  linkPath: string;
  imageSrc: string;
  active: boolean;
};

const initialBannerDraft: BannerDraft = {
  title: '',
  description: '',
  linkPath: '/',
  imageSrc: '',
  active: true
};

function createId(prefix: string) {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function moveItem(ids: string[], id: string, direction: 'up' | 'down') {
  const currentIndex = ids.indexOf(id);
  if (currentIndex < 0) {
    return ids;
  }

  const nextIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
  if (nextIndex < 0 || nextIndex >= ids.length) {
    return ids;
  }

  const nextIds = [...ids];
  const [item] = nextIds.splice(currentIndex, 1);
  nextIds.splice(nextIndex, 0, item);
  return nextIds;
}

export function OwnerBannerManager({ home, collections }: OwnerBannerManagerProps) {
  const [draft, setDraft] = useState<BannerDraft>(initialBannerDraft);
  const [status, setStatus] = useState('');
  const [isUploading, setUploading] = useState(false);

  const activeBannerIds = useMemo(
    () => home.collectionIds.filter((id) => collections.some((collection) => collection.id === id)),
    [collections, home.collectionIds]
  );

  const activeBanners = useMemo(
    () =>
      activeBannerIds
        .map((id) => collections.find((collection) => collection.id === id))
        .filter((collection): collection is GuideCollection => Boolean(collection)),
    [activeBannerIds, collections]
  );

  const otherCollections = useMemo(
    () => collections.filter((collection) => !activeBannerIds.includes(collection.id)),
    [activeBannerIds, collections]
  );

  const updateDraftField = <Key extends keyof BannerDraft>(field: Key, value: BannerDraft[Key]) => {
    setDraft((current) => ({ ...current, [field]: value }));
    setStatus('');
  };

  const handleImageUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setStatus('Загружаю баннер...');

    try {
      const imageSrc = await uploadImageAsset(file, 'collection', {
        maxWidth: 2200,
        maxHeight: 1400,
        quality: 0.88
      });
      setDraft((current) => ({ ...current, imageSrc }));
      setStatus('Изображение баннера загружено.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось загрузить баннер.');
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!draft.title.trim()) {
      setStatus('Укажи название баннера.');
      return;
    }

    const currentCollection = collections.find((collection) => collection.id === draft.id) || null;
    const nextCollection: GuideCollection = {
      id: draft.id || createId('collection'),
      title: draft.title.trim(),
      description: draft.description.trim(),
      linkPath: draft.linkPath.trim() || '/',
      imageSrc: draft.imageSrc.trim(),
      itemIds: currentCollection?.itemIds || [],
      active: draft.active
    };

    updateGuideContent((current) => ({
      ...current,
      collections: draft.id
        ? current.collections.map((collection) => (collection.id === draft.id ? nextCollection : collection))
        : [nextCollection, ...current.collections],
      home: current.home.collectionIds.includes(nextCollection.id)
        ? current.home
        : {
            ...current.home,
            collectionIds: [nextCollection.id, ...current.home.collectionIds]
          }
    }));

    setStatus(draft.id ? 'Баннер обновлён.' : 'Баннер добавлен.');
    setDraft(initialBannerDraft);
  };

  const handleEdit = (collection: GuideCollection) => {
    setDraft({
      id: collection.id,
      title: collection.title,
      description: collection.description,
      linkPath: collection.linkPath,
      imageSrc: collection.imageSrc,
      active: collection.active
    });
    setStatus('');
  };

  const handleDelete = (id: string) => {
    updateGuideContent((current) => ({
      ...current,
      collections: current.collections.filter((collection) => collection.id !== id),
      home: {
        ...current.home,
        collectionIds: current.home.collectionIds.filter((collectionId) => collectionId !== id)
      }
    }));
    setStatus('Баннер удалён.');
    setDraft((current) => (current.id === id ? initialBannerDraft : current));
  };

  const toggleOnHome = (id: string, enabled: boolean) => {
    updateGuideContent((current) => ({
      ...current,
      home: {
        ...current.home,
        collectionIds: enabled
          ? current.home.collectionIds.includes(id)
            ? current.home.collectionIds
            : [id, ...current.home.collectionIds]
          : current.home.collectionIds.filter((collectionId) => collectionId !== id)
      }
    }));
    setStatus(enabled ? 'Баннер добавлен на главную.' : 'Баннер убран с главной.');
  };

  const moveBanner = (id: string, direction: 'up' | 'down') => {
    updateGuideContent((current) => ({
      ...current,
      home: {
        ...current.home,
        collectionIds: moveItem(current.home.collectionIds, id, direction)
      }
    }));
  };

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <span className="eyebrow">CMS / баннеры</span>
          <h2>Управление баннерами</h2>
          <p>Здесь настраиваются баннеры, которые прокручиваются на главной странице приложения.</p>
        </div>
      </div>

      <div className="owner-cms-layout owner-cms-layout--stack">
        <form className="owner-editor-card owner-editor-form" onSubmit={handleSubmit}>
          <div className="owner-editor-form__grid owner-editor-form__grid--double">
            <label className="field">
              <span>Название</span>
              <input value={draft.title} onChange={(event) => updateDraftField('title', event.target.value)} />
            </label>

            <label className="field">
              <span>Ссылка перехода при нажатии</span>
              <input
                value={draft.linkPath}
                onChange={(event) => updateDraftField('linkPath', event.target.value)}
                placeholder="https://site.com, /programs, /routes, /section/restaurants или /place/slug"
              />
            </label>

            <label className="field field--full">
              <span>Описание</span>
              <textarea
                value={draft.description}
                onChange={(event) => updateDraftField('description', event.target.value)}
                rows={3}
              />
            </label>

            <label className="field">
              <span>URL изображения</span>
              <input
                value={draft.imageSrc}
                onChange={(event) => updateDraftField('imageSrc', event.target.value)}
                placeholder="/uploads/banner.jpg"
              />
            </label>

            <label className="field field--file">
              <span>{isUploading ? 'Загрузка баннера...' : 'Загрузить баннер'}</span>
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={isUploading} />
            </label>

            <label className="field field--checkbox">
              <input
                type="checkbox"
                checked={draft.active}
                onChange={(event) => updateDraftField('active', event.target.checked)}
              />
              <span>Баннер активен</span>
            </label>
          </div>

          {draft.imageSrc ? (
            <div className="owner-inline-card">
              <strong>Предпросмотр баннера</strong>
              <img className="owner-media-preview" src={draft.imageSrc} alt={draft.title || 'Баннер'} />
            </div>
          ) : null}

          {status ? <div className="owner-editor-card__status">{status}</div> : null}

          <div className="owner-editor-form__actions">
            <button className="button button--primary" type="submit">
              {draft.id ? 'Сохранить баннер' : 'Добавить баннер'}
            </button>
            <button className="button button--ghost" type="button" onClick={() => setDraft(initialBannerDraft)}>
              Очистить
            </button>
          </div>
        </form>

        <section className="owner-selection-card">
          <div className="owner-selection-card__header">
            <h3>Баннеры на главной</h3>
            <span>{activeBanners.length} шт.</span>
          </div>
          <div className="owner-collection-list">
            {activeBanners.map((collection, index) => (
              <article key={collection.id} className="owner-collection-item">
                {collection.imageSrc ? (
                  <img className="owner-collection-item__thumb" src={collection.imageSrc} alt={collection.title} />
                ) : null}
                <div className="owner-collection-item__body">
                  <strong>{collection.title}</strong>
                  <span>{collection.description || 'Описание не заполнено.'}</span>
                  <small>{collection.linkPath}</small>
                </div>
                <div className="owner-collection-item__actions">
                  <button className="button button--ghost" type="button" onClick={() => moveBanner(collection.id, 'up')} disabled={index === 0}>
                    Выше
                  </button>
                  <button
                    className="button button--ghost"
                    type="button"
                    onClick={() => moveBanner(collection.id, 'down')}
                    disabled={index === activeBanners.length - 1}
                  >
                    Ниже
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => handleEdit(collection)}>
                    Редактировать
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => toggleOnHome(collection.id, false)}>
                    Убрать
                  </button>
                </div>
              </article>
            ))}
            {activeBanners.length === 0 ? <p className="panel-helper">Пока нет баннеров на главной.</p> : null}
          </div>
        </section>

        <section className="owner-selection-card">
          <div className="owner-selection-card__header">
            <h3>Другие баннеры</h3>
            <span>{otherCollections.length} шт.</span>
          </div>
          <div className="owner-collection-list">
            {otherCollections.map((collection) => (
              <article key={collection.id} className="owner-collection-item">
                {collection.imageSrc ? (
                  <img className="owner-collection-item__thumb" src={collection.imageSrc} alt={collection.title} />
                ) : null}
                <div className="owner-collection-item__body">
                  <strong>{collection.title}</strong>
                  <span>{collection.description || 'Описание не заполнено.'}</span>
                  <small>{collection.linkPath}</small>
                </div>
                <div className="owner-collection-item__actions">
                  <button className="button button--ghost" type="button" onClick={() => handleEdit(collection)}>
                    Редактировать
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => toggleOnHome(collection.id, true)}>
                    На главную
                  </button>
                  <button className="button button--ghost" type="button" onClick={() => handleDelete(collection.id)}>
                    Удалить
                  </button>
                </div>
              </article>
            ))}
            {otherCollections.length === 0 ? <p className="panel-helper">Все баннеры уже используются на главной.</p> : null}
          </div>
        </section>
      </div>
    </section>
  );
}
