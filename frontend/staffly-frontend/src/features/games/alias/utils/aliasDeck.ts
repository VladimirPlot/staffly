import { ALIAS_WORDS } from "../data/aliasWords";
import type { AliasWord, DifficultyId, WordPackId } from "../types";

type AliasWordFilter = {
  difficulty: DifficultyId;
  wordPack: WordPackId;
};

const shuffleWords = (words: AliasWord[]) => {
  const shuffled = [...words];

  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    const currentWord = shuffled[index];
    shuffled[index] = shuffled[swapIndex] as AliasWord;
    shuffled[swapIndex] = currentWord as AliasWord;
  }

  return shuffled;
};

export const getAliasWords = ({ difficulty, wordPack }: AliasWordFilter) =>
  ALIAS_WORDS.filter((word) => word.difficulty === difficulty && (wordPack === "all" || word.pack === wordPack));

export const createAliasDeck = (filter: AliasWordFilter) => shuffleWords(getAliasWords(filter));

export const takeAliasWord = (filter: AliasWordFilter, deck: AliasWord[], cursor: number) => {
  const nextDeck = cursor < deck.length ? deck : createAliasDeck(filter);
  const nextCursor = cursor < deck.length ? cursor : 0;
  const word = nextDeck[nextCursor] ?? createAliasDeck({ difficulty: "medium", wordPack: "all" })[0];

  return {
    deck: nextDeck,
    cursor: nextCursor + 1,
    word: word as AliasWord,
  };
};
