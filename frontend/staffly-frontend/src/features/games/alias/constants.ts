import type { AliasOption, DifficultyId, WordPackId } from "./types";

export const ALIAS_ROUND_DURATION_SECONDS = 60;

export const DIFFICULTY_OPTIONS: AliasOption<DifficultyId>[] = [
  { id: "easy", label: "Легко", description: "понятные слова" },
  { id: "medium", label: "Средне", description: "ресторанная база" },
  { id: "hard", label: "Сложно", description: "гастро-термины" },
];

export const WORD_PACK_OPTIONS: AliasOption<WordPackId>[] = [
  { id: "all", label: "Все", description: "еда, бар, сервис" },
  { id: "food", label: "Еда", description: "блюда и продукты" },
  { id: "bar", label: "Бар", description: "напитки и посуда" },
  { id: "service", label: "Сервис", description: "зал и ситуации" },
];

export const DIFFICULTY_LABEL_BY_ID: Record<DifficultyId, string> = {
  easy: "Легко",
  medium: "Средне",
  hard: "Сложно",
};

export const WORD_PACK_LABEL_BY_ID: Record<WordPackId, string> = {
  all: "Все",
  food: "Еда",
  bar: "Бар",
  service: "Сервис",
};
