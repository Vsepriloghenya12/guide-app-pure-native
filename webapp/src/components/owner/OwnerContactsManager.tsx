import { useEffect, useState } from 'react';
import type { ContactChannel, EmergencyContact, SupportContentStore } from '../../data/supportContent';
import { fetchOwnerSupportContent, normalizeSupportContent, saveSupportContent } from '../../data/supportContent';

function createChannel(kind: ContactChannel['kind'] = 'telegram'): ContactChannel {
  const id = `${kind}-${Math.random().toString(36).slice(2, 8)}`;
  return {
    id,
    kind,
    title: '',
    subtitle: '',
    value: '',
    href: ''
  };
}

function createEmergency(): EmergencyContact {
  return {
    id: `emergency-${Math.random().toString(36).slice(2, 8)}`,
    title: '',
    description: '',
    value: '',
    href: ''
  };
}

export function OwnerContactsManager() {
  const [content, setContent] = useState<SupportContentStore>(() => normalizeSupportContent());
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchOwnerSupportContent()
      .then((next) => {
        if (active) {
          setContent(next);
        }
      })
      .catch((error) => {
        if (active) {
          setStatus(error instanceof Error ? error.message : 'Не удалось загрузить контакты.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const updateField = <K extends keyof SupportContentStore>(field: K, value: SupportContentStore[K]) => {
    setContent((current) => ({ ...current, [field]: value }));
  };

  const updateChannel = (id: string, patch: Partial<ContactChannel>) => {
    setContent((current) => ({
      ...current,
      contactChannels: current.contactChannels.map((channel) => (channel.id === id ? { ...channel, ...patch } : channel))
    }));
  };

  const updateEmergency = (id: string, patch: Partial<EmergencyContact>) => {
    setContent((current) => ({
      ...current,
      emergencyContacts: current.emergencyContacts.map((contact) => (contact.id === id ? { ...contact, ...patch } : contact))
    }));
  };

  const saveNextContent = async (nextContent: SupportContentStore, savingText: string) => {
    setSaving(true);
    setStatus(savingText);
    try {
      const saved = await saveSupportContent(nextContent);
      setContent(saved);
      setStatus('Страница контактов обновлена.');
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Не удалось сохранить контакты.');
    } finally {
      setSaving(false);
    }
  };

  const deleteChannel = (id: string) => {
    const nextContent = {
      ...content,
      contactChannels: content.contactChannels.filter((item) => item.id !== id)
    };
    setContent(nextContent);
    void saveNextContent(nextContent, 'Удаляю контакт...');
  };

  const deleteEmergency = (id: string) => {
    const nextContent = {
      ...content,
      emergencyContacts: content.emergencyContacts.filter((item) => item.id !== id)
    };
    setContent(nextContent);
    void saveNextContent(nextContent, 'Удаляю контакт...');
  };

  const handleSave = async () => {
    await saveNextContent(content, 'Сохраняю контакты...');
  };

  return (
    <section className="owner-cms-section">
      <div className="owner-cms-section__header">
        <div>
          <span className="eyebrow">CMS / контакты</span>
          <h2>Страница контактов</h2>
          <p>Здесь можно поменять тексты, основные каналы связи и экстренные номера на странице контактов.</p>
        </div>
        <button className="button button--primary" type="button" onClick={handleSave} disabled={saving || loading}>
          {saving ? 'Сохраняю...' : 'Сохранить контакты'}
        </button>
      </div>

      {status ? <div className="owner-editor-status owner-editor-status--spaced">{status}</div> : null}
      {loading ? <div className="panel page-loader">Загружаю контакты…</div> : null}

      {!loading ? (
        <div className="owner-cms-layout owner-contacts-layout owner-contacts-layout--wide">
          <article className="panel owner-subsection">
            <div className="section-headline">
              <strong>Верхний блок</strong>
              <span>Заголовок и текст в начале страницы.</span>
            </div>
            <div className="owner-editor-form__grid owner-editor-form__grid--double">
              <label className="field">
                <span>Подзаголовок</span>
                <input value={content.heroEyebrow} onChange={(event) => updateField('heroEyebrow', event.target.value)} />
              </label>
              <label className="field">
                <span>Кнопка</span>
                <input value={content.helpButtonLabel} onChange={(event) => updateField('helpButtonLabel', event.target.value)} />
              </label>
              <label className="field field--full">
                <span>Заголовок</span>
                <input value={content.heroTitle} onChange={(event) => updateField('heroTitle', event.target.value)} />
              </label>
              <label className="field field--full">
                <span>Текст</span>
                <textarea rows={3} value={content.heroText} onChange={(event) => updateField('heroText', event.target.value)} />
              </label>
            </div>
          </article>

          <article className="panel owner-subsection">
            <div className="section-headline">
              <strong>Основные контакты</strong>
              <span>Telegram, WhatsApp, телефон, email и другие каналы связи.</span>
            </div>
            <div className="owner-stack-list owner-stack-list--contacts owner-stack-list--contacts-single">
              {content.contactChannels.map((channel) => (
                <div key={channel.id} className="owner-inline-card">
                  <div className="owner-editor-form__grid owner-editor-form__grid--double">
                    <label className="field">
                      <span>Тип</span>
                      <select value={channel.kind} onChange={(event) => updateChannel(channel.id, { kind: event.target.value as ContactChannel['kind'] })}>
                        <option value="telegram">Telegram</option>
                        <option value="whatsapp">WhatsApp</option>
                        <option value="phone">Телефон</option>
                        <option value="email">Email</option>
                        <option value="instagram">Instagram</option>
                      </select>
                    </label>
                    <label className="field">
                      <span>Заголовок</span>
                      <input value={channel.title} onChange={(event) => updateChannel(channel.id, { title: event.target.value })} />
                    </label>
                    <label className="field field--full">
                      <span>Описание</span>
                      <input value={channel.subtitle} onChange={(event) => updateChannel(channel.id, { subtitle: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Текст</span>
                      <input value={channel.value} onChange={(event) => updateChannel(channel.id, { value: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Ссылка</span>
                      <input value={channel.href} onChange={(event) => updateChannel(channel.id, { href: event.target.value })} />
                    </label>
                  </div>
                  <button className="button button--ghost button--danger button--small" type="button" onClick={() => deleteChannel(channel.id)} disabled={saving}>
                    Удалить
                  </button>
                </div>
              ))}
              <button className="button button--ghost" type="button" onClick={() => updateField('contactChannels', [...content.contactChannels, createChannel()])}>
                Добавить контакт
              </button>
            </div>
          </article>

          <article className="panel owner-subsection">
            <div className="section-headline">
              <strong>Экстренные номера</strong>
              <span>Блок под важные номера и срочную помощь.</span>
            </div>
            <div className="owner-editor-form__grid owner-editor-form__grid--double">
              <label className="field field--full">
                <span>Заголовок блока</span>
                <input value={content.emergencyTitle} onChange={(event) => updateField('emergencyTitle', event.target.value)} />
              </label>
              <label className="field field--full">
                <span>Подпись блока</span>
                <input value={content.emergencySubtitle} onChange={(event) => updateField('emergencySubtitle', event.target.value)} />
              </label>
            </div>
            <div className="owner-stack-list owner-stack-list--emergency owner-stack-list--emergency-single">
              {content.emergencyContacts.map((contact) => (
                <div key={contact.id} className="owner-inline-card">
                  <div className="owner-editor-form__grid owner-editor-form__grid--double">
                    <label className="field">
                      <span>Название</span>
                      <input value={contact.title} onChange={(event) => updateEmergency(contact.id, { title: event.target.value })} />
                    </label>
                    <label className="field">
                      <span>Номер / текст</span>
                      <input value={contact.value} onChange={(event) => updateEmergency(contact.id, { value: event.target.value })} />
                    </label>
                    <label className="field field--full">
                      <span>Описание</span>
                      <input value={contact.description} onChange={(event) => updateEmergency(contact.id, { description: event.target.value })} />
                    </label>
                    <label className="field field--full">
                      <span>Ссылка</span>
                      <input value={contact.href} onChange={(event) => updateEmergency(contact.id, { href: event.target.value })} />
                    </label>
                  </div>
                  <button className="button button--ghost button--danger button--small" type="button" onClick={() => deleteEmergency(contact.id)} disabled={saving}>
                    Удалить
                  </button>
                </div>
              ))}
              <button className="button button--ghost" type="button" onClick={() => updateField('emergencyContacts', [...content.emergencyContacts, createEmergency()])}>
                Добавить экстренный контакт
              </button>
            </div>
          </article>
        </div>
      ) : null}
    </section>
  );
}
