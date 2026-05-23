import type { GuideCategoryId } from '../types';

export type StayProgramTone = 'coast' | 'bridge' | 'sunset' | 'emerald';

export type StayProgram = {
  id: string;
  stayLabel: string;
  title: string;
  description: string;
  highlights: string[];
  categoryIds: GuideCategoryId[];
  collectionIds: string[];
  tone: StayProgramTone;
};

export const stayPrograms: StayProgram[] = [
  {
    id: 'weekend',
    stayLabel: '2-3 дня',
    title: 'Первое знакомство с Данангом',
    description: 'Сценарий для короткой поездки: Cham Museum днём, ужин в Madame Lan и вечерний Dragon Bridge без сложной логистики.',
    highlights: ['Madame Lân', 'Cham Museum', 'Dragon Bridge'],
    categoryIds: ['restaurants', 'culture', 'photo-spots'],
    collectionIds: ['collection-1'],
    tone: 'sunset'
  },
  {
    id: 'classic',
    stayLabel: '4-5 дней',
    title: 'Классический отпуск',
    description: 'Баланс между центральными точками, Han Market, семейным вечером в Helio и выездом на Hải Vân Pass.',
    highlights: ['Han Market', 'Helio Center', 'Hải Vân Pass'],
    categoryIds: ['restaurants', 'events', 'shops', 'culture', 'kids', 'photo-spots'],
    collectionIds: ['collection-1', 'collection-2'],
    tone: 'bridge'
  },
  {
    id: 'week',
    stayLabel: '6-7 дней',
    title: 'Полная неделя у моря',
    description: 'Неделя позволяет чередовать Mikazuki Water Park, Son Tra Marina, spa-день и спокойные прогулки по центру.',
    highlights: ['Mikazuki', 'Son Tra Marina', 'Herbal Spa'],
    categoryIds: ['restaurants', 'wellness', 'active-rest', 'culture', 'photo-spots'],
    collectionIds: ['collection-2'],
    tone: 'emerald'
  },
  {
    id: 'long',
    stayLabel: '8+ дней',
    title: 'Длинный отдых в своем ритме',
    description: 'Если отдыха больше недели, удобно включить utility-слой города: транспорт, байк, рынок, hospital и спокойные выезды по районам.',
    highlights: ['Airport', 'Motorvina', 'Family Hospital'],
    categoryIds: ['restaurants', 'shops', 'photo-spots', 'wellness', 'car-rental', 'medicine', 'coworkings', 'misc'],
    collectionIds: ['collection-1', 'collection-2'],
    tone: 'coast'
  }
];
