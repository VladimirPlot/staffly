import React from "react";

import { ALIAS_MAX_TEAMS, ALIAS_MIN_TEAMS, ALIAS_ROUND_DURATION_SECONDS, ALIAS_TARGET_SCORE } from "../constants";
import { createAliasDeck, takeAliasWord } from "../utils/aliasDeck";
import type {
  AliasGamePhase,
  AliasGameSettings,
  AliasRoundEvent,
  AliasRoundResult,
  AliasTeam,
  AliasWord,
  DifficultyId,
  WordPackId,
} from "../types";

type AliasGameState = {
  phase: AliasGamePhase;
  settings: AliasGameSettings;
  teams: AliasTeam[];
  currentTeamIndex: number;
  remainingSeconds: number;
  deck: AliasWord[];
  deckCursor: number;
  currentWord: AliasWord | null;
  roundEvents: AliasRoundEvent[];
  lastRoundEvents: AliasRoundEvent[];
  lastRoundTeam: AliasTeam | null;
  winnerTeam: AliasTeam | null;
};

type AliasGameAction =
  | { type: "setDifficulty"; difficulty: DifficultyId }
  | { type: "setWordPack"; wordPack: WordPackId }
  | { type: "setTargetScore"; targetScore: number }
  | { type: "renameTeam"; teamId: string; name: string }
  | { type: "addTeam" }
  | { type: "removeTeam"; teamId: string }
  | { type: "startGame" }
  | { type: "startRound" }
  | { type: "tick" }
  | { type: "markWord"; result: AliasRoundResult }
  | { type: "pauseRound" }
  | { type: "resumeRound" }
  | { type: "finishRound" }
  | { type: "nextTurn" }
  | { type: "resetGame" };

const createInitialTeams = (): AliasTeam[] => [
  { id: "team-1", name: "Команда 1", score: 0 },
  { id: "team-2", name: "Команда 2", score: 0 },
];

const getRoundScore = (events: AliasRoundEvent[]) =>
  events.reduce((score, event) => score + (event.result === "correct" ? 1 : -1), 0);

const normalizeTeams = (teams: AliasTeam[]) =>
  teams.map((team, index) => ({
    ...team,
    name: team.name.trim() || `Команда ${index + 1}`,
  }));

const createInitialState = (): AliasGameState => {
  const settings: AliasGameSettings = {
    difficulty: "medium",
    wordPack: "all",
    targetScore: ALIAS_TARGET_SCORE,
    roundDurationSeconds: ALIAS_ROUND_DURATION_SECONDS,
    teams: createInitialTeams(),
  };

  return {
    phase: "setup",
    settings,
    teams: settings.teams,
    currentTeamIndex: 0,
    remainingSeconds: settings.roundDurationSeconds,
    deck: createAliasDeck(settings),
    deckCursor: 0,
    currentWord: null,
    roundEvents: [],
    lastRoundEvents: [],
    lastRoundTeam: null,
    winnerTeam: null,
  };
};

const finishRound = (state: AliasGameState): AliasGameState => {
  if (state.phase !== "playing" && state.phase !== "paused") {
    return state;
  }

  const currentTeam = state.teams[state.currentTeamIndex] as AliasTeam;
  const roundScore = getRoundScore(state.roundEvents);
  const nextTeams = state.teams.map((team, index) =>
    index === state.currentTeamIndex ? { ...team, score: Math.max(0, team.score + roundScore) } : team,
  );
  const updatedTeam = nextTeams[state.currentTeamIndex] as AliasTeam;
  const winnerTeam = updatedTeam.score >= state.settings.targetScore ? updatedTeam : null;

  return {
    ...state,
    phase: winnerTeam ? "gameOver" : "roundSummary",
    teams: nextTeams,
    currentWord: null,
    remainingSeconds: 0,
    lastRoundEvents: state.roundEvents,
    lastRoundTeam: currentTeam,
    winnerTeam,
  };
};

const reducer = (state: AliasGameState, action: AliasGameAction): AliasGameState => {
  switch (action.type) {
    case "setDifficulty": {
      const settings = { ...state.settings, difficulty: action.difficulty };
      return { ...state, settings, deck: createAliasDeck(settings), deckCursor: 0 };
    }
    case "setWordPack": {
      const settings = { ...state.settings, wordPack: action.wordPack };
      return { ...state, settings, deck: createAliasDeck(settings), deckCursor: 0 };
    }
    case "setTargetScore": {
      const targetScore = Number.isFinite(action.targetScore) ? action.targetScore : ALIAS_TARGET_SCORE;
      const settings = { ...state.settings, targetScore: Math.min(60, Math.max(5, targetScore)) };
      return { ...state, settings };
    }
    case "renameTeam": {
      const teams = state.teams.map((team) => (team.id === action.teamId ? { ...team, name: action.name } : team));
      return { ...state, teams, settings: { ...state.settings, teams } };
    }
    case "addTeam": {
      if (state.teams.length >= ALIAS_MAX_TEAMS) return state;

      const nextNumber = state.teams.length + 1;
      const teams = [...state.teams, { id: `team-${Date.now()}`, name: `Команда ${nextNumber}`, score: 0 }];
      return { ...state, teams, settings: { ...state.settings, teams } };
    }
    case "removeTeam": {
      if (state.teams.length <= ALIAS_MIN_TEAMS) return state;

      const teams = state.teams.filter((team) => team.id !== action.teamId);
      return { ...state, teams, settings: { ...state.settings, teams } };
    }
    case "startGame": {
      const teams = normalizeTeams(state.teams).map((team) => ({ ...team, score: 0 }));
      return {
        ...state,
        phase: "ready",
        settings: { ...state.settings, teams },
        teams,
        currentTeamIndex: 0,
        remainingSeconds: state.settings.roundDurationSeconds,
        currentWord: null,
        roundEvents: [],
        lastRoundEvents: [],
        lastRoundTeam: null,
        winnerTeam: null,
      };
    }
    case "startRound": {
      const next = takeAliasWord(state.settings, state.deck, state.deckCursor);

      return {
        ...state,
        phase: "playing",
        deck: next.deck,
        deckCursor: next.cursor,
        currentWord: next.word,
        remainingSeconds: state.settings.roundDurationSeconds,
        roundEvents: [],
      };
    }
    case "tick": {
      if (state.phase !== "playing") return state;
      if (state.remainingSeconds <= 1) return finishRound(state);

      return { ...state, remainingSeconds: state.remainingSeconds - 1 };
    }
    case "markWord": {
      if (state.phase !== "playing" || !state.currentWord) return state;

      const next = takeAliasWord(state.settings, state.deck, state.deckCursor);

      return {
        ...state,
        deck: next.deck,
        deckCursor: next.cursor,
        currentWord: next.word,
        roundEvents: [...state.roundEvents, { word: state.currentWord, result: action.result }],
      };
    }
    case "pauseRound":
      return state.phase === "playing" ? { ...state, phase: "paused" } : state;
    case "resumeRound":
      return state.phase === "paused" ? { ...state, phase: "playing" } : state;
    case "finishRound":
      return finishRound(state);
    case "nextTurn":
      return {
        ...state,
        phase: "ready",
        currentTeamIndex: (state.currentTeamIndex + 1) % state.teams.length,
        remainingSeconds: state.settings.roundDurationSeconds,
        currentWord: null,
        roundEvents: [],
      };
    case "resetGame":
      return createInitialState();
    default:
      return state;
  }
};

export const useAliasGame = () => {
  const [state, dispatch] = React.useReducer(reducer, undefined, createInitialState);

  React.useEffect(() => {
    if (state.phase !== "playing") return undefined;

    const intervalId = window.setInterval(() => {
      dispatch({ type: "tick" });
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, [state.phase]);

  const actions = React.useMemo(
    () => ({
      setDifficulty: (difficulty: DifficultyId) => dispatch({ type: "setDifficulty", difficulty }),
      setWordPack: (wordPack: WordPackId) => dispatch({ type: "setWordPack", wordPack }),
      setTargetScore: (targetScore: number) => dispatch({ type: "setTargetScore", targetScore }),
      renameTeam: (teamId: string, name: string) => dispatch({ type: "renameTeam", teamId, name }),
      addTeam: () => dispatch({ type: "addTeam" }),
      removeTeam: (teamId: string) => dispatch({ type: "removeTeam", teamId }),
      startGame: () => dispatch({ type: "startGame" }),
      startRound: () => dispatch({ type: "startRound" }),
      markCorrect: () => dispatch({ type: "markWord", result: "correct" }),
      markSkipped: () => dispatch({ type: "markWord", result: "skipped" }),
      pauseRound: () => dispatch({ type: "pauseRound" }),
      resumeRound: () => dispatch({ type: "resumeRound" }),
      finishRound: () => dispatch({ type: "finishRound" }),
      nextTurn: () => dispatch({ type: "nextTurn" }),
      resetGame: () => dispatch({ type: "resetGame" }),
    }),
    [],
  );

  return { state, actions };
};

export const getAliasRoundScore = getRoundScore;
