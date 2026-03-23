import type { TrainingQuestionBlankDto } from "../../../api/types";

const PLACEHOLDER_REGEX = /\{\{\s*(\d+)\s*}}/g;

export function createDefaultBlank(index: number): TrainingQuestionBlankDto {
  return {
    index,
    options: [
      { text: "", correct: true, sortOrder: 0 },
      { text: "", correct: false, sortOrder: 1 },
    ],
  };
}

export function syncBlanksWithPrompt(
  nextPrompt: string,
  prevBlanks: TrainingQuestionBlankDto[],
): { prompt: string; blanks: TrainingQuestionBlankDto[] } {
  const orderedSourceIndexes: number[] = [];
  const seen = new Set<number>();

  for (const match of nextPrompt.matchAll(PLACEHOLDER_REGEX)) {
    const raw = Number(match[1]);
    if (!Number.isFinite(raw) || raw <= 0) continue;
    if (!seen.has(raw)) {
      seen.add(raw);
      orderedSourceIndexes.push(raw);
    }
  }

  const renumberMap = new Map<number, number>();
  orderedSourceIndexes.forEach((sourceIndex, idx) => {
    renumberMap.set(sourceIndex, idx + 1);
  });

  const normalizedPrompt = nextPrompt.replace(PLACEHOLDER_REGEX, (_, rawIndex: string) => {
    const mapped = renumberMap.get(Number(rawIndex));
    return mapped ? `{{${mapped}}}` : "";
  });

  const normalizedBlanks = orderedSourceIndexes.map((sourceIndex, idx) => {
    const targetIndex = idx + 1;
    const existing = prevBlanks.find((blank) => blank.index === sourceIndex);

    if (!existing) {
      return createDefaultBlank(targetIndex);
    }

    return {
      ...existing,
      index: targetIndex,
      options:
        existing.options.length > 0
          ? existing.options.map((option, optionIndex) => ({
              ...option,
              sortOrder: optionIndex,
            }))
          : createDefaultBlank(targetIndex).options,
    };
  });

  return {
    prompt: normalizedPrompt,
    blanks: normalizedBlanks,
  };
}

export function insertBlankIntoPromptAtCursor(params: {
  prompt: string;
  blanks: TrainingQuestionBlankDto[];
  selectionStart: number;
  selectionEnd: number;
}) {
  const nextIndex = params.blanks.length + 1;
  const token = `{{${nextIndex}}}`;
  const nextPrompt = `${params.prompt.slice(0, params.selectionStart)}${token}${params.prompt.slice(
    params.selectionEnd,
  )}`;
  const synced = syncBlanksWithPrompt(nextPrompt, [...params.blanks, createDefaultBlank(nextIndex)]);

  return {
    ...synced,
    caretPosition: params.selectionStart + token.length,
  };
}

export function removeBlankFromPrompt(
  prompt: string,
  blanks: TrainingQuestionBlankDto[],
  index: number,
) {
  const nextPrompt = prompt.replace(new RegExp(`\\{\\{\\s*${index}\\s*}}`, "g"), "");
  return syncBlanksWithPrompt(nextPrompt, blanks.filter((blank) => blank.index !== index));
}
