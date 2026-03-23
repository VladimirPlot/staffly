import type { ReactNode } from "react";
import type { AttemptQuestionSnapshotDto } from "../../api/types";

export function measureTextWidth(text: string, font = '500 16px system-ui') {
  if (typeof document === "undefined") return 0;

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) return 0;

  context.font = font;
  return context.measureText(text).width;
}

export function getFillBlankSelectWidth(blankOptions: { text: string }[], selectedValue = "") {
  const texts = blankOptions.map((option) => option.text.trim()).filter(Boolean);
  if (selectedValue.trim()) texts.push(selectedValue.trim());

  const longestText = texts.reduce((longest, current) => (current.length > longest.length ? current : longest), "");
  const textWidth = measureTextWidth(longestText || "000000", '500 16px system-ui');
  const totalWidth = Math.ceil(textWidth + 16 + 28 + 16);
  return `${Math.min(Math.max(totalWidth, 84), 260)}px`;
}

export function buildFillPromptParts(prompt: string) {
  const result: Array<
    | { type: "text"; value: string; key: string }
    | { type: "blank"; blankIndex: number; key: string }
  > = [];

  const regex = /\{\{(\d+)\}\}/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null = null;
  let tokenIndex = 0;

  while ((match = regex.exec(prompt)) !== null) {
    if (match.index > lastIndex) {
      result.push({ type: "text", value: prompt.slice(lastIndex, match.index), key: `text-${tokenIndex}-${lastIndex}` });
    }
    result.push({ type: "blank", blankIndex: Number(match[1]), key: `blank-${tokenIndex}-${match[1]}` });
    lastIndex = regex.lastIndex;
    tokenIndex += 1;
  }

  if (lastIndex < prompt.length) {
    result.push({ type: "text", value: prompt.slice(lastIndex), key: `text-tail-${lastIndex}` });
  }

  return result;
}

export function renderInlineFillPrompt(
  question: AttemptQuestionSnapshotDto,
  byIndex: Map<number, string>,
  isConfirmed: boolean,
  onChange: (blankIndex: number, value: string) => void,
) {
  const blanksByIndex = new Map(question.blanks.map((blank) => [blank.blankIndex, blank]));
  const parts = buildFillPromptParts(question.prompt);

  return (
    <div className="text-lg font-medium leading-8 text-default">
      {parts.map((part): ReactNode => {
        if (part.type === "text") {
          return <span key={part.key} className="whitespace-pre-wrap">{part.value}</span>;
        }

        const blank = blanksByIndex.get(part.blankIndex);
        if (!blank) {
          return <span key={part.key} className="whitespace-pre-wrap text-rose-600">{`{{${part.blankIndex}}}`}</span>;
        }

        const selectedValue = byIndex.get(blank.blankIndex) ?? "";
        const selectWidth = getFillBlankSelectWidth(blank.options, selectedValue);

        return (
          <span key={part.key} className="mx-1 inline-block align-middle">
            <select
              className="h-10 rounded-xl border border-subtle bg-surface px-2 pr-7 text-sm text-default"
              style={{ width: selectWidth, maxWidth: "100%" }}
              value={selectedValue}
              disabled={isConfirmed}
              onChange={(event) => onChange(blank.blankIndex, event.target.value)}
            >
              <option value="">—</option>
              {blank.options.map((option) => (
                <option key={option.text} value={option.text}>{option.text}</option>
              ))}
            </select>
          </span>
        );
      })}
    </div>
  );
}
