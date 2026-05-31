import React from "react";

import type { DifficultyId, WordPackId } from "../types";

export const useAliasSetupState = () => {
  const [difficulty, setDifficulty] = React.useState<DifficultyId>("medium");
  const [wordPack, setWordPack] = React.useState<WordPackId>("all");

  const handleDifficultyChange = React.useCallback((nextDifficulty: DifficultyId) => {
    setDifficulty(nextDifficulty);
  }, []);

  const handleWordPackChange = React.useCallback((nextWordPack: WordPackId) => {
    setWordPack(nextWordPack);
  }, []);

  return {
    difficulty,
    wordPack,
    onDifficultyChange: handleDifficultyChange,
    onWordPackChange: handleWordPackChange,
  };
};
