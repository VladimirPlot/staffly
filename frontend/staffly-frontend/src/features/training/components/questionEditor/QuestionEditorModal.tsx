import { useEffect, useMemo, useState, type ReactNode } from "react";
import Button from "../../../../shared/ui/Button";
import Modal from "../../../../shared/ui/Modal";
import { createQuestion, updateQuestion } from "../../api/trainingApi";
import type {
  TrainingQuestionDto,
  TrainingQuestionGroup,
  TrainingQuestionType,
} from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import FillSelectEditor from "./editors/FillSelectEditor";
import MatchQuestionEditor from "./editors/MatchQuestionEditor";
import MultiChoiceEditor from "./editors/MultiChoiceEditor";
import SingleChoiceEditor from "./editors/SingleChoiceEditor";
import TrueFalseEditor from "./editors/TrueFalseEditor";
import QuestionEditorCommonFields from "./QuestionEditorCommonFields";
import QuestionEditorStepType from "./QuestionEditorStepType";
import QuestionEditorStepUsage from "./QuestionEditorStepUsage";
import {
  insertBlankIntoPromptAtCursor,
  removeBlankFromPrompt,
  syncBlanksWithPrompt,
} from "./shared/fillSelectUtils";
import type {
  QuestionEditorStep,
  QuestionOptionDraft,
  QuestionPairDraft,
} from "./shared/questionEditorTypes";

type Props = {
  open: boolean;
  restaurantId: number;
  folderId: number;
  question?: TrainingQuestionDto | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

const DEFAULT_OPTIONS: QuestionOptionDraft[] = [
  { text: "", correct: true },
  { text: "", correct: false },
];

const DEFAULT_PAIRS: QuestionPairDraft[] = [
  { leftText: "", rightText: "" },
  { leftText: "", rightText: "" },
];

export default function QuestionEditorModal({
  open,
  restaurantId,
  folderId,
  question,
  onClose,
  onSaved,
}: Props) {
  const [step, setStep] = useState<QuestionEditorStep>("usage");
  const [questionGroup, setQuestionGroup] = useState<TrainingQuestionGroup>("PRACTICE");
  const [type, setType] = useState<TrainingQuestionType>("SINGLE");
  const [title, setTitle] = useState("");
  const [prompt, setPrompt] = useState("");
  const [promptSelection, setPromptSelection] = useState({ start: 0, end: 0 });
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<QuestionOptionDraft[]>(DEFAULT_OPTIONS);
  const [pairs, setPairs] = useState<QuestionPairDraft[]>(DEFAULT_PAIRS);
  const [blanks, setBlanks] = useState(question?.blanks?.length ? question.blanks : []);
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
        ? question.options.map((option) => ({ text: option.text, correct: option.correct }))
        : DEFAULT_OPTIONS,
    );
    setPairs(
      question?.matchPairs?.length
        ? question.matchPairs.map((pair) => ({ leftText: pair.leftText, rightText: pair.rightText }))
        : DEFAULT_PAIRS,
    );
    setBlanks(syncedFillState.blanks);
    setError(null);
  }, [open, question]);

  const duplicates = useMemo(() => {
    const duplicateKeys = new Set<string>();

    if (type === "MATCH") {
      const seen = new Set<string>();
      pairs.forEach((pair, index) => {
        const key = `${pair.leftText.trim().toLowerCase()}|||${pair.rightText.trim().toLowerCase()}`;
        if (pair.leftText.trim() && pair.rightText.trim() && seen.has(key)) duplicateKeys.add(`pair-${index}`);
        seen.add(key);
      });
    } else if (type === "FILL_SELECT") {
      blanks.forEach((blank) => {
        const seen = new Set<string>();
        blank.options.forEach((option, index) => {
          const key = option.text.trim().toLowerCase();
          if (key && seen.has(key)) duplicateKeys.add(`blank-${blank.index}-${index}`);
          seen.add(key);
        });
      });
    } else {
      const seen = new Set<string>();
      options.forEach((option, index) => {
        const key = option.text.trim().toLowerCase();
        if (key && seen.has(key)) duplicateKeys.add(`option-${index}`);
        seen.add(key);
      });
    }

    return duplicateKeys;
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

  const handleAddBlank = () => {
    const inserted = insertBlankIntoPromptAtCursor({
      prompt,
      blanks,
      selectionStart: promptSelection.start ?? prompt.length,
      selectionEnd: promptSelection.end ?? prompt.length,
    });

    setPrompt(inserted.prompt);
    setBlanks(inserted.blanks);
    setPromptSelection({
      start: inserted.caretPosition,
      end: inserted.caretPosition,
    });
  };

  const handleRemoveBlank = (index: number) => {
    const synced = removeBlankFromPrompt(prompt, blanks, index);
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
              : options.map((option, index) => ({ ...option, sortOrder: index })),
        matchPairs: type === "MATCH" ? pairs.map((pair, index) => ({ ...pair, sortOrder: index })) : [],
        blanks:
          type === "FILL_SELECT"
            ? blanks.map((blank) => ({
                ...blank,
                options: blank.options.map((option, index) => ({ ...option, sortOrder: index })),
              }))
            : [],
      };

      if (question) {
        await updateQuestion(restaurantId, question.id, payload);
      } else {
        await createQuestion(restaurantId, payload);
      }

      await onSaved();
      onClose();
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось сохранить вопрос."));
    } finally {
      setSaving(false);
    }
  };

  const editorByType: Record<TrainingQuestionType, ReactNode> = {
    SINGLE: (
      <SingleChoiceEditor options={options} duplicates={duplicates} onOptionsChange={setOptions} />
    ),
    MULTI: <MultiChoiceEditor options={options} duplicates={duplicates} onOptionsChange={setOptions} />,
    TRUE_FALSE: <TrueFalseEditor options={options} onChange={setOptions} />,
    FILL_SELECT: (
      <FillSelectEditor
        blanks={blanks}
        duplicates={duplicates}
        onBlanksChange={setBlanks}
        onRemoveBlank={handleRemoveBlank}
      />
    ),
    MATCH: <MatchQuestionEditor pairs={pairs} duplicates={duplicates} onPairsChange={setPairs} />,
  };

  const footer =
    step === "usage" ? (
      <>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => setStep("type")}>Далее</Button>
      </>
    ) : step === "type" ? (
      <>
        <Button variant="outline" onClick={() => setStep("usage")}>
          Назад
        </Button>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={() => setStep("editor")}>Далее</Button>
      </>
    ) : (
      <>
        <Button variant="outline" onClick={onClose}>
          Отмена
        </Button>
        <Button onClick={submit} isLoading={saving} disabled={!title.trim() || !prompt.trim()}>
          Сохранить
        </Button>
      </>
    );

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
      footer={footer}
    >
      {step === "usage" && (
        <QuestionEditorStepUsage value={questionGroup} onChange={setQuestionGroup} />
      )}

      {step === "type" && <QuestionEditorStepType value={type} onChange={setType} />}

      {step === "editor" && (
        <div className="space-y-4">
          <QuestionEditorCommonFields
            type={type}
            title={title}
            prompt={prompt}
            explanation={explanation}
            onTitleChange={setTitle}
            onPromptChange={applyPromptChange}
            onExplanationChange={setExplanation}
            onPromptSelectionChange={setPromptSelection}
            onAddBlank={handleAddBlank}
          />

          {editorByType[type]}

          {error && <div className="text-sm [overflow-wrap:anywhere] text-red-600">{error}</div>}
        </div>
      )}
    </Modal>
  );
}
