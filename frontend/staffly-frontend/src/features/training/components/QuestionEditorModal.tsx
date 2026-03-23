import { Check, Trash2 } from "lucide-react";
import { useEffect, useId, useMemo, useState } from "react";
import Button from "../../../shared/ui/Button";
import IconButton from "../../../shared/ui/IconButton";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import Textarea from "../../../shared/ui/Textarea";
import { createQuestion, updateQuestion } from "../api/trainingApi";
import type {
  TrainingQuestionBlankDto,
  TrainingQuestionDto,
  TrainingQuestionGroup,
  TrainingQuestionType,
} from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";
import {
  QUESTION_GROUP_LABELS,
  QUESTION_TYPE_LABELS,
  QUESTION_TYPE_ORDER,
} from "../utils/questionLabels";

type Props = {
  open: boolean;
  restaurantId: number;
  folderId: number;
  question?: TrainingQuestionDto | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

type Option = { text: string; correct: boolean };
type Pair = { leftText: string; rightText: string };

const PLACEHOLDER_REGEX = /\{\{\s*(\d+)\s*}}/g;

function createDefaultBlank(index: number): TrainingQuestionBlankDto {
  return {
    index,
    options: [
      { text: "", correct: true, sortOrder: 0 },
      { text: "", correct: false, sortOrder: 1 },
    ],
  };
}

function syncBlanksWithPrompt(
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

export default function QuestionEditorModal({
  open,
  restaurantId,
  folderId,
  question,
  onClose,
  onSaved,
}: Props) {
  const promptTextareaId = useId();

  const [step, setStep] = useState<"usage" | "type" | "editor">("usage");
  const [questionGroup, setQuestionGroup] = useState<TrainingQuestionGroup>("PRACTICE");
  const [type, setType] = useState<TrainingQuestionType>("SINGLE");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptSelection, setPromptSelection] = useState({ start: 0, end: 0 });
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<Option[]>([
    { text: "", correct: true },
    { text: "", correct: false },
  ]);
  const [pairs, setPairs] = useState<Pair[]>([
    { leftText: "", rightText: "" },
    { leftText: "", rightText: "" },
  ]);
  const [blanks, setBlanks] = useState<TrainingQuestionBlankDto[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;

    const initialType = question?.type ?? "SINGLE";
    const initialPrompt = question?.prompt ?? "";
    const initialBlanks = question?.blanks?.length ? question.blanks : [];

    const syncedFillState =
      initialType === "FILL_SELECT"
        ? syncBlanksWithPrompt(initialPrompt, initialBlanks)
        : { prompt: initialPrompt, blanks: initialBlanks };

    setStep(question ? "editor" : "usage");
    setType(initialType);
    setQuestionGroup(question?.questionGroup ?? "PRACTICE");
    setTitle(question?.title ?? "");
    setPrompt(syncedFillState.prompt);
    setPromptSelection({
      start: syncedFillState.prompt.length,
      end: syncedFillState.prompt.length,
    });
    setExplanation(question?.explanation ?? "");
    setOptions(
      question?.options?.length
        ? question.options.map((o) => ({ text: o.text, correct: o.correct }))
        : [
            { text: "", correct: true },
            { text: "", correct: false },
          ],
    );
    setPairs(
      question?.matchPairs?.length
        ? question.matchPairs.map((p) => ({ leftText: p.leftText, rightText: p.rightText }))
        : [
            { leftText: "", rightText: "" },
            { leftText: "", rightText: "" },
          ],
    );
    setBlanks(syncedFillState.blanks);
    setError(null);
  }, [open, question]);

  const duplicates = useMemo(() => {
    const d = new Set<string>();

    if (type === "MATCH") {
      const seen = new Set<string>();
      pairs.forEach((p, i) => {
        const key = `${p.leftText.trim().toLowerCase()}|||${p.rightText.trim().toLowerCase()}`;
        if (p.leftText.trim() && p.rightText.trim() && seen.has(key)) d.add(`pair-${i}`);
        seen.add(key);
      });
    } else if (type === "FILL_SELECT") {
      blanks.forEach((b) => {
        const seen = new Set<string>();
        b.options.forEach((o, i) => {
          const key = o.text.trim().toLowerCase();
          if (key && seen.has(key)) d.add(`blank-${b.index}-${i}`);
          seen.add(key);
        });
      });
    } else {
      const seen = new Set<string>();
      options.forEach((o, i) => {
        const key = o.text.trim().toLowerCase();
        if (key && seen.has(key)) d.add(`option-${i}`);
        seen.add(key);
      });
    }

    return d;
  }, [type, options, pairs, blanks]);

  const applyPromptChange = (nextPrompt: string) => {
    if (type !== "FILL_SELECT") {
      setPrompt(nextPrompt);
      return;
    }

    const synced = syncBlanksWithPrompt(nextPrompt, blanks);
    setPrompt(synced.prompt);
    setBlanks(synced.blanks);
  };

  const updatePromptSelectionFromElement = (element: HTMLTextAreaElement) => {
    setPromptSelection({
      start: element.selectionStart ?? 0,
      end: element.selectionEnd ?? 0,
    });
  };

  const insertBlankAtCursor = () => {
    const nextIndex = blanks.length + 1;
    const token = `{{${nextIndex}}}`;

    const start = promptSelection.start ?? prompt.length;
    const end = promptSelection.end ?? prompt.length;

    const nextPrompt = `${prompt.slice(0, start)}${token}${prompt.slice(end)}`;
    const synced = syncBlanksWithPrompt(nextPrompt, [
      ...blanks,
      createDefaultBlank(nextIndex),
    ]);

    setPrompt(synced.prompt);
    setBlanks(synced.blanks);

    const nextCaretPosition = start + token.length;

    requestAnimationFrame(() => {
      const textarea = document.getElementById(promptTextareaId) as HTMLTextAreaElement | null;
      if (!textarea) return;
      textarea.focus();
      textarea.setSelectionRange(nextCaretPosition, nextCaretPosition);
      setPromptSelection({
        start: nextCaretPosition,
        end: nextCaretPosition,
      });
    });
  };

  const removeBlank = (index: number) => {
    const nextPrompt = prompt.replace(new RegExp(`\\{\\{\\s*${index}\\s*}}`, "g"), "");
    const synced = syncBlanksWithPrompt(nextPrompt, blanks.filter((blank) => blank.index !== index));
    setPrompt(synced.prompt);
    setBlanks(synced.blanks);
  };

  const submit = async () => {
    setSaving(true);
    setError(null);

    try {
      const payload = {
        folderId,
        questionGroup,
        type,
        title: title.trim(),
        prompt: prompt.trim(),
        explanation: explanation.trim() || null,
        options:
          type === "MATCH" || type === "FILL_SELECT"
            ? []
            : type === "TRUE_FALSE"
              ? [
                  { text: "Правда", correct: options[0]?.correct ?? true, sortOrder: 0 },
                  { text: "Ложь", correct: options[1]?.correct ?? false, sortOrder: 1 },
                ]
              : options.map((o, i) => ({ ...o, sortOrder: i })),
        matchPairs: type === "MATCH" ? pairs.map((p, i) => ({ ...p, sortOrder: i })) : [],
        blanks:
          type === "FILL_SELECT"
            ? blanks.map((b) => ({
                ...b,
                options: b.options.map((o, i) => ({ ...o, sortOrder: i })),
              }))
            : [],
      };

      if (question) await updateQuestion(restaurantId, question.id, payload);
      else await createQuestion(restaurantId, payload);

      await onSaved();
      onClose();
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось сохранить вопрос."));
    } finally {
      setSaving(false);
    }
  };

  const renderFooter = () => {
    if (step === "usage") {
      return (
        <>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => setStep("type")}>Далее</Button>
        </>
      );
    }

    if (step === "type") {
      return (
        <>
          <Button variant="outline" onClick={() => setStep("usage")}>
            Назад
          </Button>
          <Button variant="outline" onClick={onClose}>
            Отмена
          </Button>
          <Button onClick={() => setStep("editor")}>Далее</Button>
        </>
      );
    }

    return (
      <>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} isLoading={saving} disabled={!title.trim() || !prompt.trim()}>
          Сохранить
        </Button>
      </>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={
        question
          ? "Редактирование вопроса"
          : step === "usage"
            ? "Вид вопроса"
            : step === "type"
              ? "Тип вопроса"
              : "Новый вопрос"
      }
      footer={renderFooter()}
    >
      {step === "usage" && (
        <div className="space-y-2">
          <Button
            variant={questionGroup === "PRACTICE" ? "primary" : "outline"}
            className="w-full"
            onClick={() => setQuestionGroup("PRACTICE")}
          >
            {QUESTION_GROUP_LABELS.PRACTICE} вопрос
          </Button>
          <Button
            variant={questionGroup === "CERTIFICATION" ? "primary" : "outline"}
            className="w-full"
            onClick={() => setQuestionGroup("CERTIFICATION")}
          >
            {QUESTION_GROUP_LABELS.CERTIFICATION} вопрос
          </Button>
        </div>
      )}

      {step === "type" && (
        <SelectField
          label="Тип"
          value={type}
          onChange={(e) => setType(e.target.value as TrainingQuestionType)}
        >
          {QUESTION_TYPE_ORDER.map((questionType) => (
            <option key={questionType} value={questionType}>
              {QUESTION_TYPE_LABELS[questionType]}
            </option>
          ))}
        </SelectField>
      )}

      {step === "editor" && (
        <div className="space-y-4">
          <Input
            label="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />

          <div className="space-y-2">
            <Textarea
              id={promptTextareaId}
              label="Формулировка"
              value={prompt}
              onChange={(e) => applyPromptChange(e.target.value)}
              onSelect={(e) => updatePromptSelectionFromElement(e.currentTarget)}
              onClick={(e) => updatePromptSelectionFromElement(e.currentTarget)}
              onKeyUp={(e) => updatePromptSelectionFromElement(e.currentTarget)}
              required
            />

            {type === "FILL_SELECT" && (
              <div className="flex justify-end">
                <Button variant="outline" onClick={insertBlankAtCursor}>
                  Добавить пропуск
                </Button>
              </div>
            )}
          </div>

          <Textarea
            label="Пояснение"
            hint="Показывается пользователю после ответа и объясняет правильный вариант. Оставьте поле пустым, если пояснение не требуется."
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
          />

          {type === "MATCH" && (
            <div className="space-y-2">
              {pairs.map((p, i) => (
                <div
                  key={i}
                  className="grid grid-cols-1 gap-2 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto]"
                >
                  <Input
                    label="Левая часть"
                    value={p.leftText}
                    onChange={(e) =>
                      setPairs((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, leftText: e.target.value } : x)),
                      )
                    }
                    error={duplicates.has(`pair-${i}`) ? "Дубликат пары" : undefined}
                  />
                  <Input
                    label="Правая часть"
                    value={p.rightText}
                    onChange={(e) =>
                      setPairs((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, rightText: e.target.value } : x)),
                      )
                    }
                    error={duplicates.has(`pair-${i}`) ? "Дубликат пары" : undefined}
                  />
                  <div className="flex items-end justify-end">
                    <IconButton
                      onClick={() => setPairs((prev) => prev.filter((_, idx) => idx !== i))}
                    >
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                </div>
              ))}

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setPairs((prev) => [...prev, { leftText: "", rightText: "" }])}
              >
                Добавить пару
              </Button>
            </div>
          )}

          {type === "SINGLE" && (
            <div className="space-y-3">
              <p className="text-muted text-sm [overflow-wrap:anywhere]">
                Отметьте ровно один верный вариант. Эта отметка определяет правильный ответ.
              </p>

              <div className="space-y-3">
                {options.map((o, i) => (
                  <div
                    key={i}
                    className={[
                      "flex min-w-0 items-start gap-3",
                      i > 0 ? "border-subtle border-t pt-3" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      aria-label={`Сделать вариант ${i + 1} верным`}
                      aria-pressed={o.correct}
                      className="mt-9 flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
                      onClick={() =>
                        setOptions((prev) => prev.map((x, idx) => ({ ...x, correct: idx === i })))
                      }
                    >
                      <span
                        className={[
                          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition",
                          o.correct
                            ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                            : "border-[var(--staffly-border)] bg-transparent text-transparent",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <Input
                        label={`Вариант ${i + 1}`}
                        value={o.text}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                          )
                        }
                        error={duplicates.has(`option-${i}`) ? "Дубликат" : undefined}
                      />
                    </div>

                    <div className="shrink-0 pt-9">
                      <IconButton
                        disabled={options.length <= 2}
                        onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setOptions((prev) => [...prev, { text: "", correct: false }])}
              >
                Добавить вариант
              </Button>
            </div>
          )}

          {type === "MULTI" && (
            <div className="space-y-3">
              <p className="text-muted text-sm [overflow-wrap:anywhere]">
                Отметьте все верные варианты. Можно выбрать несколько правильных ответов.
              </p>

              <div className="space-y-3">
                {options.map((o, i) => (
                  <div
                    key={i}
                    className={[
                      "flex min-w-0 items-start gap-3",
                      i > 0 ? "border-subtle border-t pt-3" : "",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      aria-label={`Переключить правильность варианта ${i + 1}`}
                      aria-pressed={o.correct}
                      className="mt-9 flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
                      onClick={() =>
                        setOptions((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, correct: !x.correct } : x)),
                        )
                      }
                    >
                      <span
                        className={[
                          "flex h-5 w-5 items-center justify-center rounded-md border-2 transition",
                          o.correct
                            ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                            : "border-[var(--staffly-border)] bg-transparent text-transparent",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    </button>

                    <div className="min-w-0 flex-1">
                      <Input
                        label={`Вариант ${i + 1}`}
                        value={o.text}
                        onChange={(e) =>
                          setOptions((prev) =>
                            prev.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                          )
                        }
                        error={duplicates.has(`option-${i}`) ? "Дубликат" : undefined}
                      />
                    </div>

                    <div className="shrink-0 pt-9">
                      <IconButton
                        disabled={options.length <= 2}
                        onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                variant="outline"
                className="w-full"
                onClick={() => setOptions((prev) => [...prev, { text: "", correct: false }])}
              >
                Добавить вариант
              </Button>
            </div>
          )}

          {type === "TRUE_FALSE" && (
            <div className="space-y-3">
              <p className="text-muted text-sm [overflow-wrap:anywhere]">
                Выберите один правильный вариант ответа.
              </p>

              <div className="space-y-3">
                {[
                  { label: "Правда", index: 0 },
                  { label: "Ложь", index: 1 },
                ].map(({ label, index }, rowIndex) => {
                  const checked = options[index]?.correct ?? false;

                  return (
                    <div
                      key={label}
                      className={[
                        "flex min-w-0 items-center gap-3",
                        rowIndex > 0 ? "border-subtle border-t pt-3" : "",
                      ].join(" ")}
                    >
                      <button
                        type="button"
                        aria-label={`Выбрать вариант: ${label}`}
                        aria-pressed={checked}
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
                        onClick={() =>
                          setOptions([
                            { text: "Правда", correct: index === 0 },
                            { text: "Ложь", correct: index === 1 },
                          ])
                        }
                      >
                        <span
                          className={[
                            "flex h-5 w-5 items-center justify-center rounded-md border-2 transition",
                            checked
                              ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                              : "border-[var(--staffly-border)] bg-transparent text-transparent",
                          ].join(" ")}
                          aria-hidden="true"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </span>
                      </button>

                      <button
                        type="button"
                        className="text-left text-lg font-medium text-default transition hover:opacity-80"
                        onClick={() =>
                          setOptions([
                            { text: "Правда", correct: index === 0 },
                            { text: "Ложь", correct: index === 1 },
                          ])
                        }
                      >
                        {label}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {type === "FILL_SELECT" && (
            <div className="space-y-3">
              {blanks.length === 0 && (
                <p className="text-muted text-sm [overflow-wrap:anywhere]">
                  Добавьте пропуск в формулировку, и здесь появятся варианты ответа для него.
                </p>
              )}

              {blanks.map((blank) => (
                <div key={blank.index} className="border-subtle space-y-3 rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium [overflow-wrap:anywhere]">Пропуск {blank.index}</div>
                    <IconButton onClick={() => removeBlank(blank.index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>

                  <div className="space-y-3">
                    {blank.options.map((o, i) => (
                      <div
                        key={i}
                        className={[
                          "flex min-w-0 items-start gap-3",
                          i > 0 ? "border-subtle border-t pt-3" : "",
                        ].join(" ")}
                      >
                        <button
                          type="button"
                          aria-label={`Сделать вариант ${i + 1} верным для пропуска ${blank.index}`}
                          aria-pressed={o.correct}
                          className="mt-9 flex h-6 w-6 shrink-0 items-center justify-center rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
                          onClick={() =>
                            setBlanks((prev) =>
                              prev.map((b) =>
                                b.index === blank.index
                                  ? {
                                      ...b,
                                      options: b.options.map((x, idx) => ({
                                        ...x,
                                        correct: idx === i,
                                      })),
                                    }
                                  : b,
                              ),
                            )
                          }
                        >
                          <span
                            className={[
                              "flex h-5 w-5 items-center justify-center rounded-md border-2 transition",
                              o.correct
                                ? "border-[var(--staffly-text-strong)] bg-[var(--staffly-text-strong)] text-[var(--staffly-surface)]"
                                : "border-[var(--staffly-border)] bg-transparent text-transparent",
                            ].join(" ")}
                            aria-hidden="true"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </span>
                        </button>

                        <div className="min-w-0 flex-1">
                          <Input
                            label={`Вариант ${i + 1}`}
                            value={o.text}
                            onChange={(e) =>
                              setBlanks((prev) =>
                                prev.map((b) =>
                                  b.index === blank.index
                                    ? {
                                        ...b,
                                        options: b.options.map((x, idx) =>
                                          idx === i ? { ...x, text: e.target.value } : x,
                                        ),
                                      }
                                    : b,
                                ),
                              )
                            }
                            error={duplicates.has(`blank-${blank.index}-${i}`) ? "Дубликат" : undefined}
                          />
                        </div>

                        <div className="shrink-0 pt-9">
                          <IconButton
                            onClick={() =>
                              setBlanks((prev) =>
                                prev.map((b) =>
                                  b.index === blank.index
                                    ? {
                                        ...b,
                                        options: b.options
                                          .filter((_, idx) => idx !== i)
                                          .map((option, optionIndex) => ({
                                            ...option,
                                            correct:
                                              optionIndex === 0
                                                ? option.correct || i === 0
                                                : option.correct,
                                            sortOrder: optionIndex,
                                          })),
                                      }
                                    : b,
                                ),
                              )
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </IconButton>
                        </div>
                      </div>
                    ))}
                  </div>

                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      setBlanks((prev) =>
                        prev.map((b) =>
                          b.index === blank.index
                            ? {
                                ...b,
                                options: [
                                  ...b.options,
                                  { text: "", correct: false, sortOrder: b.options.length },
                                ],
                              }
                            : b,
                        ),
                      )
                    }
                  >
                    Добавить вариант
                  </Button>
                </div>
              ))}
            </div>
          )}

          {error && <div className="text-sm [overflow-wrap:anywhere] text-red-600">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
