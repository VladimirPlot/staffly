import { Plus, Trash2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

export default function QuestionEditorModal({
  open,
  restaurantId,
  folderId,
  question,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState<"usage" | "type" | "editor">("usage");
  const [questionGroup, setQuestionGroup] = useState<TrainingQuestionGroup>("PRACTICE");
  const [type, setType] = useState<TrainingQuestionType>("SINGLE");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
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
    setStep(question ? "editor" : "usage");
    setType(question?.type ?? "SINGLE");
    setQuestionGroup(question?.questionGroup ?? "PRACTICE");
    setTitle(question?.title ?? "");
    setPrompt(question?.prompt ?? "");
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
    setBlanks(question?.blanks?.length ? question.blanks : []);
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

  const addBlank = () => {
    const next = blanks.length + 1;
    setPrompt((p) => `${p} {{${next}}}`.trim());
    setBlanks((prev) => [
      ...prev,
      {
        index: next,
        options: [
          { text: "", correct: true, sortOrder: 0 },
          { text: "", correct: false, sortOrder: 1 },
        ],
      },
    ]);
  };

  const removeBlank = (index: number) => {
    const reindexed = blanks
      .filter((b) => b.index !== index)
      .map((b, i) => ({ ...b, index: i + 1 }));
    let nextPrompt = prompt.replace(new RegExp(`\\{\\{${index}}}`, "g"), "");
    reindexed.forEach((b, i) => {
      nextPrompt = nextPrompt.replace(new RegExp(`\\{\\{${b.index}}}`, "g"), `{{${i + 1}}}`);
    });
    setPrompt(nextPrompt.replace(/\s+/g, " ").trim());
    setBlanks(reindexed);
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
        <div className="space-y-3">
          <Input
            label="Название"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
          <Textarea
            label="Формулировка"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            required
          />
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
              <div className="space-y-2">
                <p className="text-muted text-sm [overflow-wrap:anywhere]">
                  Отметьте ровно один верный вариант. Эта отметка определяет правильный ответ.
                </p>
                {options.map((o, i) => (
                  <div
                    key={i}
                    className={[
                      "border-subtle bg-surface flex min-w-0 items-start gap-3 rounded-2xl border p-3 transition sm:items-center",
                      o.correct ? "border-default/70 ring-default/15 ring-4" : "hover:border-default/60",
                    ].join(" ")}
                  >
                    <button
                      type="button"
                      aria-label={`Сделать вариант ${i + 1} верным`}
                      aria-pressed={o.correct}
                      className="group mt-9 flex h-7 w-7 shrink-0 items-center justify-center rounded-full focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-default)] focus-visible:ring-offset-2 sm:mt-0"
                      onClick={() =>
                        setOptions((prev) => prev.map((x, idx) => ({ ...x, correct: idx === i })))
                      }
                    >
                      <span
                        className={[
                          "border-subtle flex h-6 w-6 items-center justify-center rounded-full border-2 bg-transparent transition",
                          o.correct
                            ? "border-default"
                            : "group-hover:border-default/70 group-focus-visible:border-default",
                        ].join(" ")}
                        aria-hidden="true"
                      >
                        <span
                          className={[
                            "bg-default h-3 w-3 rounded-full transition",
                            o.correct ? "scale-100 opacity-100" : "scale-0 opacity-0",
                          ].join(" ")}
                        />
                      </span>
                    </button>
                    <Input
                      label={`Вариант ${i + 1}`}
                      className="min-w-0 flex-1"
                      value={o.text}
                      onChange={(e) =>
                        setOptions((prev) =>
                          prev.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                        )
                      }
                      error={duplicates.has(`option-${i}`) ? "Дубликат" : undefined}
                    />
                    <div className="flex shrink-0 items-end self-stretch sm:self-auto">
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
            <div className="space-y-2">
              {options.map((o, i) => (
                <div key={i} className="flex min-w-0 items-center gap-2">
                  <input
                    type="checkbox"
                    checked={o.correct}
                    onChange={() =>
                      setOptions((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, correct: !x.correct } : x)),
                      )
                    }
                  />
                  <Input
                    label="Вариант"
                    className="min-w-0 flex-1"
                    value={o.text}
                    onChange={(e) =>
                      setOptions((prev) =>
                        prev.map((x, idx) => (idx === i ? { ...x, text: e.target.value } : x)),
                      )
                    }
                    error={duplicates.has(`option-${i}`) ? "Дубликат" : undefined}
                  />
                  <IconButton
                    disabled={options.length <= 2}
                    onClick={() => setOptions((prev) => prev.filter((_, idx) => idx !== i))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </IconButton>
                </div>
              ))}
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
            <div className="space-y-2">
              <label className="flex gap-2 [overflow-wrap:anywhere]">
                <input
                  type="radio"
                  checked={options[0]?.correct ?? true}
                  onChange={() =>
                    setOptions([
                      { text: "Правда", correct: true },
                      { text: "Ложь", correct: false },
                    ])
                  }
                />
                Правда
              </label>
              <label className="flex gap-2 [overflow-wrap:anywhere]">
                <input
                  type="radio"
                  checked={options[1]?.correct ?? false}
                  onChange={() =>
                    setOptions([
                      { text: "Правда", correct: false },
                      { text: "Ложь", correct: true },
                    ])
                  }
                />
                Ложь
              </label>
            </div>
          )}
          {type === "FILL_SELECT" && (
            <div className="space-y-3">
              <Button variant="outline" onClick={addBlank}>
                <Plus className="h-4 w-4" /> Добавить пропуск
              </Button>
              {blanks.map((blank) => (
                <div key={blank.index} className="border-subtle space-y-2 rounded-2xl border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-medium [overflow-wrap:anywhere]">
                      Пропуск {blank.index}
                    </div>
                    <IconButton onClick={() => removeBlank(blank.index)}>
                      <Trash2 className="h-4 w-4" />
                    </IconButton>
                  </div>
                  {blank.options.map((o, i) => (
                    <div key={i} className="flex min-w-0 items-center gap-2">
                      <input
                        type="radio"
                        name={`blank-${blank.index}`}
                        checked={o.correct}
                        onChange={() =>
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
                      />
                      <Input
                        label="Вариант"
                        className="min-w-0 flex-1"
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
                      <IconButton
                        onClick={() =>
                          setBlanks((prev) =>
                            prev.map((b) =>
                              b.index === blank.index
                                ? { ...b, options: b.options.filter((_, idx) => idx !== i) }
                                : b,
                            ),
                          )
                        }
                      >
                        <Trash2 className="h-4 w-4" />
                      </IconButton>
                    </div>
                  ))}
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
