export type DifficultyId = "easy" | "medium" | "hard";
export type WordPackId = "all" | "food" | "bar" | "service";

export type AliasOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};
