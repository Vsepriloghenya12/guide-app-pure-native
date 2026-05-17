import type { SupportContentStore } from '../types';

export const defaultSupportContent: SupportContentStore = {
  heroEyebrow: 'На связи',
  heroTitle: 'Все важные контакты в одном месте',
  heroText: 'Здесь собраны основные каналы связи, чтобы телефон, Telegram и WhatsApp всегда были под рукой.',
  helpButtonLabel: 'Открыть помощь',
  emergencyTitle: 'Экстренные контакты',
  emergencySubtitle: 'Полезно сохранить до поездки или держать под рукой.',
  contactChannels: [
    {
      id: 'telegram',
      title: 'Telegram',
      subtitle: 'Быстрые вопросы и помощь по приложению.',
      value: '@danangguide_support',
      href: 'https://t.me/danangguide_support',
      kind: 'telegram'
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      subtitle: 'Удобно для быстрых сообщений.',
      value: '+84 90 000 90 90',
      href: 'https://wa.me/84900009090',
      kind: 'whatsapp'
    },
    {
      id: 'phone',
      title: 'Телефон',
      subtitle: 'Срочный звонок.',
      value: '+84 90 000 90 90',
      href: 'tel:+84900009090',
      kind: 'phone'
    },
    {
      id: 'email',
      title: 'Email',
      subtitle: 'Партнёрства и подробные запросы.',
      value: 'hello@danangguide.app',
      href: 'mailto:hello@danangguide.app',
      kind: 'email'
    }
  ],
  emergencyContacts: [
    { id: 'police', title: 'Полиция', description: 'Экстренная помощь и безопасность.', value: '113', href: 'tel:113' },
    { id: 'fire', title: 'Пожарная служба', description: 'Пожар, задымление, угроза жизни.', value: '114', href: 'tel:114' },
    { id: 'ambulance', title: 'Скорая помощь', description: 'Медицинская экстренная помощь.', value: '115', href: 'tel:115' }
  ]
};
