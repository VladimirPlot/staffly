import type { TrainingModule } from "./api";

export type TrainingModuleSlug = "menu" | "bar" | "wine" | "service";

export type TrainingModuleConfig = {
  slug: TrainingModuleSlug;
  title: string;
  description: string;
  module?: TrainingModule;
};

export const TRAINING_MODULES: TrainingModuleConfig[] = [
  {
    slug: "menu",
    title: "Меню",
    description: "Категории блюд и карточки с составом.",
    module: "MENU",
  },
  {
    slug: "bar",
    title: "Барная карта",
    description: "Напитки, коктейли и барные позиции.",
    module: "BAR",
  },
  {
    slug: "wine",
    title: "Винная карта",
    description: "Категории вин и карточки напитков.",
    module: "WINE",
  },
  {
    slug: "service",
    title: "Сервис",
    description: "Стандарты обслуживания. Раздел скоро появится.",
  },
];

const modulesBySlug = TRAINING_MODULES.reduce(
  (acc, item) => {
    acc[item.slug] = item;
    return acc;
  },
  {} as Record<TrainingModuleSlug, TrainingModuleConfig>
);

export function getTrainingModuleConfig(slug?: string | null): TrainingModuleConfig | null {
  if (!slug) return null;
  return modulesBySlug[slug as TrainingModuleSlug] ?? null;
}

export function isConfigWithCategories(
  config: TrainingModuleConfig | null
): config is TrainingModuleConfig & { module: TrainingModule } {
  return Boolean(config?.module);
}

export const MODULE_SLUGS_WITH_CATEGORIES = TRAINING_MODULES.filter(
  (item): item is TrainingModuleConfig & { module: TrainingModule } => Boolean(item.module)
).map((item) => item.slug);
