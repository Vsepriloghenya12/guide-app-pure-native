import type { GuideCategory, GuideCategoryId } from "../types";

function makeCategory(
  id: GuideCategoryId,
  title: string,
  path: string,
  options: {
    badge?: string;
    description?: string;
    visible?: boolean;
    showOnHome?: boolean;
    shortTitle?: string;
    accent?: string;
    imageSrc?: string;
    quickFilters?: string[];
    fields?: string[];
  } = {},
): GuideCategory {
  return {
    id,
    title,
    path,
    badge: options.badge,
    description: options.description,
    visible: options.visible ?? true,
    showOnHome: options.showOnHome ?? false,
    slug: id,
    shortTitle: options.shortTitle ?? title,
    accent: options.accent ?? "coast",
    imageSrc: options.imageSrc ?? "",
    sortOrder: 100,
    filterSchema: {
      quickFilters: options.quickFilters ?? [],
      fields: options.fields ?? [],
    },
  };
}

export const defaultCategories: GuideCategory[] = [
  makeCategory("restaurants", "Еда", "/restaurants", {
    badge: "Популярно",
    description: "Рестораны, кафе, завтраки и места на каждый день.",
    showOnHome: true,
    shortTitle: "Еда",
    accent: "sunset",
    quickFilters: ["breakfast", "vegan", "pets"],
    fields: ["avgCheck", "cuisine", "kind", "tags"],
  }),
  makeCategory("events", "Досуг", "/section/events", {
    showOnHome: true,
    shortTitle: "Досуг",
    accent: "sunset",
    description: "Афиша, бары, вечерние планы и городские активности.",
    quickFilters: ["today", "weekend", "free"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory("wellness", "Оздоровление", "/wellness", {
    description: "СПА, массаж, хамам и спокойное восстановление.",
    showOnHome: true,
    shortTitle: "Оздоровление",
    accent: "emerald",
    quickFilters: ["childPrograms"],
    fields: ["services", "avgCheck", "tags"],
  }),
  makeCategory("active-rest", "Активный отдых", "/section/active-rest", {
    showOnHome: true,
    shortTitle: "Активный отдых",
    accent: "sunset",
    description: "Серф, SUP, роуп-парки, водные активности и места с драйвом.",
    quickFilters: ["outdoor", "family", "water"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory("hotels", "Резорты", "/section/hotels", {
    shortTitle: "Резорты",
    accent: "coast",
    description:
      "Резорты, отели, апартаменты и варианты проживания в разных районах.",
    quickFilters: [],
    fields: ["hotelStars", "hotelPool", "hotelSpa", "petFriendly", "district"],
  }),
  makeCategory("car-rental", "Транспорт", "/section/car-rental", {
    shortTitle: "Транспорт",
    accent: "bridge",
    description: "Прокат байков и авто, доставка транспорта и удобные условия.",
    quickFilters: ["bike", "car", "delivery"],
    fields: ["kind", "services", "avgCheck", "district"],
  }),
  makeCategory("atm", "Финансы", "/section/atm", {
    shortTitle: "Финансы",
    accent: "emerald",
    description: "Банкоматы, банки и точки снятия наличных.",
    quickFilters: ["24/7", "usd", "beach"],
    fields: ["kind", "services", "district"],
  }),
  makeCategory("shops", "Покупки", "/section/shops", {
    showOnHome: true,
    shortTitle: "Покупки",
    accent: "sunset",
    description: "Сувениры, рынки, локальные бренды и полезные покупки.",
    quickFilters: ["market", "local", "design"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory(
    "bulletin-board",
    "Доска объявлений",
    "/section/bulletin-board",
    {
      showOnHome: true,
      shortTitle: "Объявления",
      accent: "bridge",
      description: "Работа, вещи, услуги и предложения сообщества.",
      quickFilters: ["Работа", "Продажи", "Вакансии", "Резюме"],
      fields: ["kind", "cuisine", "avgCheck", "tags", "district"],
    },
  ),
  makeCategory("culture", "Культура и искусство", "/section/culture", {
    showOnHome: true,
    shortTitle: "Культура и искусство",
    accent: "coast",
    description: "Музеи, архитектура, городские символы и культурные точки.",
    quickFilters: ["museum", "temple", "view"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory("kids", "Детям", "/section/kids", {
    shortTitle: "Детям",
    accent: "emerald",
    description:
      "Семейные локации, игровые, кафе и места, куда удобно идти с детьми.",
    quickFilters: ["family", "indoor", "outdoor"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory("medicine", "Медицина", "/section/medicine", {
    shortTitle: "Медицина",
    accent: "bridge",
    description:
      "Клиники, аптеки, стоматология и точки, которые полезно знать заранее.",
    quickFilters: ["24/7", "english", "pharmacy"],
    fields: ["kind", "services", "district"],
  }),
  makeCategory("photo-spots", "Виды города", "/section/photo-spots", {
    shortTitle: "Виды города",
    accent: "sunset",
    description: "Смотровые, rooftop и точки с красивыми видами на Дананг.",
    quickFilters: ["sunrise", "sunset", "view"],
    fields: ["kind", "tags", "district"],
  }),
  makeCategory("coworkings", "Коворкинги", "/section/coworkings", {
    shortTitle: "Коворкинги",
    accent: "coast",
    description: "Пространства для работы, встреч и спокойных рабочих часов.",
    quickFilters: [],
    fields: ["kind", "services", "district"],
  }),
  makeCategory("misc", "Разное", "/section/misc", {
    shortTitle: "Разное",
    accent: "bridge",
    description:
      "Дополнительные полезные точки, которые не входят в основные рубрики.",
    quickFilters: [],
    fields: ["kind", "tags", "district"],
  }),
];

export const sectionTitles: Record<string, string> = defaultCategories.reduce(
  (accumulator, category) => ({
    ...accumulator,
    [category.id]: category.title,
  }),
  {
    excursions: "Лучшие экскурсии",
  } as Record<string, string>,
);

export const categoryStatusMap: Record<string, string> = {
  restaurants: "Полноценные карточки еды с фильтрами и контактами",
  events: "Афиша и досуговые карточки",
  wellness: "Полноценные карточки оздоровления и услуг",
  "active-rest": "Можно использовать как будущий раздел подборок и локаций",
  hotels: "Готово место под резорты, отели и апартаменты",
  "car-rental": "Раздел под транспорт и прокат",
  atm: "Раздел под банкоматы, банки и финансы",
  shops: "Раздел под покупки и сувениры",
  "bulletin-board":
    "Раздел объявлений с рубриками, подкатегориями, поиском и фильтрами",
  culture: "Раздел под культуру и искусство",
  kids: "Можно сделать семейный раздел",
  medicine: "Можно вынести клиники и аптеки",
  "photo-spots": "Раздел под видовые точки города",
  coworkings: "Раздел под рабочие пространства",
  misc: "Раздел под разные полезные точки",
};
