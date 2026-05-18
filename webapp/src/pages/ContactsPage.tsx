import { useEffect, useState } from 'react';
import { PageHeader } from '../components/layout/PageHeader';
import {
  defaultSupportContent,
  fetchSupportContent,
  helpFaq,
  type SupportContentStore
} from '../data/supportContent';
import { recordGuideAnalytics } from '../utils/analytics';
import { usePageMeta } from '../hooks/usePageMeta';

function getChannelBadge(kind: string) {
  switch (kind) {
    case 'telegram':
      return 'Telegram';
    case 'whatsapp':
      return 'WhatsApp';
    case 'phone':
      return 'Телефон';
    case 'email':
      return 'Email';
    case 'instagram':
      return 'Instagram';
    default:
      return 'Контакт';
  }
}

export function ContactsPage() {
  const [content, setContent] = useState<SupportContentStore>(defaultSupportContent);

  useEffect(() => {
    let active = true;
    fetchSupportContent()
      .then((next) => {
        if (active) {
          setContent(next);
        }
      })
      .catch(() => {
        // fallback stays on defaults
      });

    return () => {
      active = false;
    };
  }, []);

  usePageMeta({
    title: 'Помощь',
    description: 'Экстренные службы, основные контакты и ответы на частые вопросы.'
  });

  return (
    <div className="page-stack travel-page client-tab-page client-tab-page--help">
      <PageHeader
        title="Помощь"
        subtitle="Все важные контакты и быстрые ответы в одном месте."
        showBack
      />

      <section className="client-help-sections" aria-label="Разделы помощи">
        <a className="client-help-sections__chip" href="#help-emergency">Экстренные службы</a>
        <a className="client-help-sections__chip" href="#help-contacts">Контакты</a>
        <a className="client-help-sections__chip" href="#help-faq">FAQ</a>
      </section>

      <section className="client-help-block" id="help-emergency" aria-labelledby="help-emergency-title">
        <div className="client-help-block__header">
          <h2 id="help-emergency-title">Экстренные службы</h2>
          <p>{content.emergencySubtitle}</p>
        </div>

        <div className="client-contact-list client-contact-list--emergency" role="list">
          {content.emergencyContacts.map((contact) => (
            <a
              key={contact.id}
              className="client-contact-row client-contact-row--emergency"
              role="listitem"
              href={contact.href}
              onClick={() =>
                recordGuideAnalytics({
                  kind: 'phone-click',
                  label: `Emergency · ${contact.title}`,
                  path: contact.href
                })
              }
            >
              <span className="client-contact-row__body">
                <strong>{contact.title}</strong>
                <span className="client-contact-row__meta">Важно</span>
                <span className="client-contact-row__value">{contact.value}</span>
                {contact.description ? (
                  <span className="client-contact-row__note">{contact.description}</span>
                ) : null}
              </span>
              <span className="client-contact-row__arrow" aria-hidden="true">
                ›
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="client-help-block" id="help-contacts" aria-labelledby="help-contacts-title">
        <div className="client-help-block__header">
          <h2 id="help-contacts-title">Контакты</h2>
          <p>{content.heroText}</p>
        </div>

        <div className="client-contact-list" role="list">
          {content.contactChannels.map((channel) => (
            <a
              key={channel.id}
              className="client-contact-row"
              role="listitem"
              href={channel.href}
              target={channel.href.startsWith('http') ? '_blank' : undefined}
              rel={channel.href.startsWith('http') ? 'noreferrer' : undefined}
              onClick={() =>
                recordGuideAnalytics({
                  kind: channel.kind === 'phone' ? 'phone-click' : 'website-click',
                  label: `Контакты · ${channel.title}`,
                  path: channel.href
                })
              }
            >
              <span className="client-contact-row__body">
                <strong>{channel.title}</strong>
                <span className="client-contact-row__meta">{getChannelBadge(channel.kind)}</span>
                <span className="client-contact-row__value">{channel.value}</span>
                {channel.subtitle ? (
                  <span className="client-contact-row__note">{channel.subtitle}</span>
                ) : null}
              </span>
              <span className="client-contact-row__arrow" aria-hidden="true">
                ›
              </span>
            </a>
          ))}
        </div>
      </section>

      <section className="client-help-block" id="help-faq" aria-labelledby="help-faq-title">
        <div className="client-help-block__header">
          <h2 id="help-faq-title">FAQ</h2>
          <p>Короткие ответы на вопросы, которые чаще всего возникают у пользователей.</p>
        </div>

        <div className="travel-story-list travel-story-list--plain" role="list">
          {helpFaq.map((item) => (
            <article
              key={item.id}
              className="travel-story-row travel-story-row--no-arrow travel-story-row--static travel-story-row--faq"
              role="listitem"
            >
              <span className="travel-story-row__body">
                <strong>{item.question}</strong>
                <span>{item.answer}</span>
              </span>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
