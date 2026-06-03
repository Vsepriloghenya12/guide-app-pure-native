import { buildApiUrl } from '../api/url';
import { notifyOwnerAuthRequired } from '../utils/ownerEvents';

export type ContactChannel = {
  id: string;
  title: string;
  subtitle: string;
  value: string;
  href: string;
  kind: 'telegram' | 'whatsapp' | 'phone' | 'email' | 'instagram';
};

export type EmergencyContact = {
  id: string;
  title: string;
  description: string;
  value: string;
  href: string;
};

export type FaqItem = {
  id: string;
  question: string;
  answer: string;
};

export type SupportContentStore = {
  heroEyebrow: string;
  heroTitle: string;
  heroText: string;
  helpButtonLabel: string;
  emergencyTitle: string;
  emergencySubtitle: string;
  contactChannels: ContactChannel[];
  emergencyContacts: EmergencyContact[];
};

export const defaultSupportContent: SupportContentStore = {
  heroEyebrow: 'На связи',
  heroTitle: 'Все важные контакты в одном месте',
  heroText:
    'Здесь собраны основные каналы связи, чтобы телефон, Telegram и WhatsApp всегда были под рукой. Ниже также есть важные номера для экстренных ситуаций.',
  helpButtonLabel: 'Открыть помощь',
  emergencyTitle: 'Экстренные контакты',
  emergencySubtitle: 'Полезно сохранить до поездки или держать под рукой в офлайн-режиме.',
  contactChannels: [
    {
      id: 'telegram',
      title: 'Telegram',
      subtitle: 'Быстрые вопросы, рекомендации и помощь по приложению.',
      value: '@danangguide_support',
      href: 'https://t.me/danangguide_support',
      kind: 'telegram'
    },
    {
      id: 'whatsapp',
      title: 'WhatsApp',
      subtitle: 'Удобно для быстрых сообщений и отправки локации.',
      value: '+84 90 000 90 90',
      href: 'https://wa.me/84900009090',
      kind: 'whatsapp'
    },
    {
      id: 'phone',
      title: 'Телефон',
      subtitle: 'Срочный звонок, если нужна помощь или уточнение по контакту.',
      value: '+84 90 000 90 90',
      href: 'tel:+84900009090',
      kind: 'phone'
    },
    {
      id: 'email',
      title: 'Email',
      subtitle: 'Для партнёрств, размещения и подробных запросов.',
      value: 'hello@danangguide.app',
      href: 'mailto:hello@danangguide.app',
      kind: 'email'
    },
    {
      id: 'instagram',
      title: 'Instagram',
      subtitle: 'Актуальные анонсы, места дня и подборки для города.',
      value: '@danangguide.app',
      href: 'https://instagram.com/danangguide.app',
      kind: 'instagram'
    }
  ],
  emergencyContacts: [
    {
      id: 'police',
      title: 'Полиция',
      description: 'Экстренная помощь и безопасность.',
      value: '113',
      href: 'tel:113'
    },
    {
      id: 'fire',
      title: 'Пожарная служба',
      description: 'Пожар, задымление, угроза жизни.',
      value: '114',
      href: 'tel:114'
    },
    {
      id: 'ambulance',
      title: 'Скорая помощь',
      description: 'Медицинская экстренная помощь.',
      value: '115',
      href: 'tel:115'
    },
    {
      id: 'tourist-help',
      title: 'Туристическая помощь',
      description: 'Локальная помощь по логистике, утерянным вещам и маршрутам.',
      value: '+84 90 000 90 90',
      href: 'tel:+84900009090'
    }
  ]
};

export const contactChannels = defaultSupportContent.contactChannels;
export const emergencyContacts = defaultSupportContent.emergencyContacts;

function normalizeChannel(channel: Partial<ContactChannel>, index: number): ContactChannel {
  const kind = ['telegram', 'whatsapp', 'phone', 'email', 'instagram'].includes(String(channel.kind))
    ? (channel.kind as ContactChannel['kind'])
    : 'telegram';

  return {
    id: String(channel.id || `${kind}-${index + 1}`),
    title: String(channel.title || 'Контакт').trim(),
    subtitle: String(channel.subtitle || '').trim(),
    value: String(channel.value || '').trim(),
    href: String(channel.href || '').trim(),
    kind
  };
}

function normalizeEmergency(contact: Partial<EmergencyContact>, index: number): EmergencyContact {
  return {
    id: String(contact.id || `emergency-${index + 1}`),
    title: String(contact.title || 'Экстренный контакт').trim(),
    description: String(contact.description || '').trim(),
    value: String(contact.value || '').trim(),
    href: String(contact.href || '').trim()
  };
}

export function normalizeSupportContent(input?: Partial<SupportContentStore> | null): SupportContentStore {
  return {
    heroEyebrow: String(input?.heroEyebrow || defaultSupportContent.heroEyebrow).trim(),
    heroTitle: String(input?.heroTitle || defaultSupportContent.heroTitle).trim(),
    heroText: String(input?.heroText || defaultSupportContent.heroText).trim(),
    helpButtonLabel: String(input?.helpButtonLabel || defaultSupportContent.helpButtonLabel).trim(),
    emergencyTitle: String(input?.emergencyTitle || defaultSupportContent.emergencyTitle).trim(),
    emergencySubtitle: String(input?.emergencySubtitle || defaultSupportContent.emergencySubtitle).trim(),
    contactChannels: Array.isArray(input?.contactChannels)
      ? input.contactChannels.map(normalizeChannel).filter((item) => item.title || item.value || item.href)
      : defaultSupportContent.contactChannels.map(normalizeChannel),
    emergencyContacts: Array.isArray(input?.emergencyContacts)
      ? input.emergencyContacts.map(normalizeEmergency).filter((item) => item.title || item.value || item.href)
      : defaultSupportContent.emergencyContacts.map(normalizeEmergency)
  };
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(buildApiUrl(path), {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {})
    },
    ...init
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    if (response.status === 401) {
      notifyOwnerAuthRequired();
    }
    throw new Error((data as { message?: string; error?: string }).message || (data as { message?: string; error?: string }).error || 'Ошибка запроса');
  }

  return data as T;
}

export async function fetchSupportContent(): Promise<SupportContentStore> {
  const response = await request<{ ok: true; content: SupportContentStore }>('/api/support-content');
  return normalizeSupportContent(response.content);
}

export async function fetchOwnerSupportContent(): Promise<SupportContentStore> {
  const response = await request<{ ok: true; content: SupportContentStore }>('/api/owner/support-content');
  return normalizeSupportContent(response.content);
}

export async function saveSupportContent(content: SupportContentStore): Promise<SupportContentStore> {
  const response = await request<{ ok: true; content: SupportContentStore }>('/api/owner/support-content', {
    method: 'PUT',
    body: JSON.stringify({ content })
  });
  return normalizeSupportContent(response.content);
}

export const helpFaq: FaqItem[] = [
  {
    id: 'how-to-use',
    question: 'Как пользоваться приложением удобнее всего?',
    answer:
      'Начни с категорий на главной, добавляй понравившиеся места в избранное и включай геолокацию для блока «Рядом». Так приложение начнёт подсказывать, что ближе к тебе именно сейчас.'
  },
  {
    id: 'owner-updates',
    question: 'Как быстро обновляется информация в приложении?',
    answer:
      'Новые карточки, баннеры и советы обычно появляются в приложении довольно быстро.'
  },
  {
    id: 'favorites',
    question: 'Где искать сохранённые места?',
    answer:
      'Сохраняй локации через кнопку «В избранное» в карточке места. Потом открой нижнее меню → «Избранное», и места будут сгруппированы по категориям.'
  },
  {
    id: 'nearby',
    question: 'Почему раздел «Рядом» показывает не все места?',
    answer:
      'Для раздела «Рядом» нужны геолокация устройства и данные о местоположении самих мест. Поэтому часть точек может появляться не сразу.'
  },
  {
    id: 'offline',
    question: 'Что будет, если пропадёт интернет?',
    answer:
      'Приложение сохраняет часть данных для быстрого открытия и показывает офлайн-страницу. Но актуальные данные и поиск всё равно требуют подключения к сети.'
  },
  {
    id: 'maps',
    question: 'Как открыть маршрут в удобных картах?',
    answer:
      'В карточке места есть встроенная карта и кнопка маршрута. Если включена геолокация, там же сразу появится примерное расстояние и время пути.'
  }
];

export const supportQuickLinks = [
  {
    id: 'search',
    title: 'Поиск по приложению',
    description: 'Найти место по тегам, кухне, услугам и названию.',
    path: '/search'
  },
  {
    id: 'nearby',
    title: 'Что рядом со мной',
    description: 'Показать ближайшие точки и открыть маршрут.',
    path: '/nearby'
  },
  {
    id: 'events',
    title: 'Скоро в афише',
    description: 'События, вечеринки, мастер-классы и планы на выходные.',
    path: '/section/events'
  },
  {
    id: 'contacts',
    title: 'Связаться с нами',
    description: 'Telegram, WhatsApp, телефон и важные номера.',
    path: '/contacts'
  }
];
