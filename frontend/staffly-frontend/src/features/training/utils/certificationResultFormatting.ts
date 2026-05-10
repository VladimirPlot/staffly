export function formatDateTime(value?: string | null): string {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU");
}

function formatParsedAnswer(parsed: unknown): string {
  if (typeof parsed === "string") return parsed;
  if (Array.isArray(parsed)) {
    return parsed
      .map((item) => {
        if (typeof item === "string") return item;
        if (item && typeof item === "object") {
          if ("left" in item && "right" in item) return `${String(item.left)} → ${String(item.right ?? "")}`;
          if ("blankIndex" in item && "value" in item) return `${String(item.blankIndex)}: ${String(item.value ?? "")}`;
          if ("blankIndex" in item && "correct" in item) return `${String(item.blankIndex)}: ${String(item.correct ?? "")}`;
        }
        return JSON.stringify(item);
      })
      .join(", ");
  }
  if (parsed && typeof parsed === "object") {
    if ("blankIndex" in parsed && "value" in parsed) {
      return `${String(parsed.blankIndex)}: ${String(parsed.value ?? "")}`;
    }
    if ("blankIndex" in parsed && "correct" in parsed) {
      return `${String(parsed.blankIndex)}: ${String(parsed.correct ?? "")}`;
    }
  }
  return JSON.stringify(parsed);
}

export function renderAnswer(rawAnswerJson?: string | null, emptyLabel = "Ответ не указан"): string {
  if (!rawAnswerJson) return emptyLabel;
  try {
    const parsed = JSON.parse(rawAnswerJson);
    return formatParsedAnswer(parsed);
  } catch {
    return rawAnswerJson;
  }
}
