export type DifficultyId = "easy" | "medium" | "hard";
export type WordPackId = "all" | "food" | "bar" | "service";
export type AliasWordPackId = Exclude<WordPackId, "all">;
export type AliasRoundResult = "correct" | "skipped";
export type AliasGamePhase = "setup" | "ready" | "playing" | "paused" | "roundSummary" | "gameOver";

export type AliasOption<T extends string> = {
  id: T;
  label: string;
  description: string;
};

export type AliasWord = {
  id: number;
  text: string;
  pack: AliasWordPackId;
  difficulty: DifficultyId;
};

export type AliasTeam = {
  id: string;
  name: string;
  score: number;
};

export type AliasRoundEvent = {
  word: AliasWord;
  result: AliasRoundResult;
};

export type AliasGameSettings = {
  difficulty: DifficultyId;
  wordPack: WordPackId;
  targetScore: number;
  roundDurationSeconds: number;
  teams: AliasTeam[];
};
