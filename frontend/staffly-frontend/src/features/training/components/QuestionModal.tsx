import { ArrowDown, ArrowUp } from "lucide-react";
import { useEffect, useState } from "react";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { createQuestion, updateQuestion } from "../api/trainingApi";
import type { TrainingQuestionDto, TrainingQuestionMatchPairDto, TrainingQuestionOptionDto, TrainingQuestionType } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

type Props = { open: boolean; restaurantId: number; folderId: number; question?: TrainingQuestionDto | null; onClose: () => void; onSaved: () => Promise<void> | void; };
const TYPE_OPTIONS: TrainingQuestionType[] = ["SINGLE", "MULTI", "TRUE_FALSE", "FILL_SELECT", "MATCH"];

export default function QuestionModal({ open, restaurantId, folderId, question, onClose, onSaved }: Props) {
  const [type, setType] = useState<TrainingQuestionType>("SINGLE");
  const [prompt, setPrompt] = useState("");
  const [explanation, setExplanation] = useState("");
  const [options, setOptions] = useState<TrainingQuestionOptionDto[]>([{ text: "", correct: true, sortOrder: 0 }, { text: "", correct: false, sortOrder: 1 }]);
  const [pairs, setPairs] = useState<TrainingQuestionMatchPairDto[]>([{ leftText: "", rightText: "", sortOrder: 0 }, { leftText: "", rightText: "", sortOrder: 1 }]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setType(question?.type ?? "SINGLE"); setPrompt(question?.prompt ?? ""); setExplanation(question?.explanation ?? "");
    setOptions(question?.options?.length ? question.options : [{ text: "", correct: true, sortOrder: 0 }, { text: "", correct: false, sortOrder: 1 }]);
    setPairs(question?.matchPairs?.length ? question.matchPairs : [{ leftText: "", rightText: "", sortOrder: 0 }, { leftText: "", rightText: "", sortOrder: 1 }]);
    setError(null);
  }, [open, question]);

  const setSingleCorrect = (index: number) => setOptions((prev) => prev.map((o, i) => ({ ...o, correct: i === index })));
  const move = <T,>(arr: T[], i: number, dir: -1 | 1) => { const n = i + dir; if (n < 0 || n >= arr.length) return arr; const c = [...arr]; [c[i], c[n]] = [c[n], c[i]]; return c; };

  const submit = async () => {
    setSaving(true); setError(null);
    const payload = { folderId, type, prompt: prompt.trim(), explanation: explanation.trim() || null, sortOrder: 0,
      options: type === "MATCH" ? [] : options.map((o, i) => ({ ...o, sortOrder: i })),
      matchPairs: type === "MATCH" ? pairs.map((p, i) => ({ ...p, sortOrder: i })) : [],
    };
    try {
      if (question) await updateQuestion(restaurantId, question.id, payload);
      else await createQuestion(restaurantId, payload);
      await onSaved(); onClose();
    } catch (e) { setError(getTrainingErrorMessage(e, "Не удалось сохранить вопрос.")); }
    finally { setSaving(false); }
  };

  return <Modal open={open} title={question ? "Редактировать вопрос" : "Создать вопрос"} onClose={onClose} footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={submit} isLoading={saving} disabled={!prompt.trim()}>Сохранить</Button></>}>
    <div className="space-y-3"><Input label="Формулировка" value={prompt} onChange={(e) => setPrompt(e.target.value)} /><Input label="Пояснение" value={explanation} onChange={(e) => setExplanation(e.target.value)} />
      <select className="border-subtle rounded-xl border p-2 text-sm" value={type} onChange={(e) => setType(e.target.value as TrainingQuestionType)}>{TYPE_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}</select>
      {type !== "MATCH" ? <div className="space-y-2">{options.map((option, idx) => <div className="flex items-center gap-2" key={idx}><input type={type === "MULTI" ? "checkbox" : "radio"} checked={option.correct} onChange={() => type === "MULTI" ? setOptions((prev) => prev.map((o, i) => i === idx ? { ...o, correct: !o.correct } : o)) : setSingleCorrect(idx)} /><input className="border-subtle flex-1 rounded-xl border p-2 text-sm" value={option.text} onChange={(e) => setOptions((prev) => prev.map((o, i) => i === idx ? { ...o, text: e.target.value } : o))} /><Button type="button" variant="ghost" onClick={() => setOptions((prev) => move(prev, idx, -1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" onClick={() => setOptions((prev) => move(prev, idx, 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" onClick={() => setOptions((prev) => [...prev, { text: "", correct: false, sortOrder: prev.length }])}>Добавить вариант</Button></div>
      : <div className="space-y-2">{pairs.map((pair, idx) => <div className="grid grid-cols-[1fr_1fr_auto_auto] items-center gap-2" key={idx}><input className="border-subtle rounded-xl border p-2 text-sm" value={pair.leftText} onChange={(e) => setPairs((prev) => prev.map((p, i) => i === idx ? { ...p, leftText: e.target.value } : p))} /><input className="border-subtle rounded-xl border p-2 text-sm" value={pair.rightText} onChange={(e) => setPairs((prev) => prev.map((p, i) => i === idx ? { ...p, rightText: e.target.value } : p))} /><Button type="button" variant="ghost" onClick={() => setPairs((prev) => move(prev, idx, -1))}><ArrowUp className="h-4 w-4" /></Button><Button type="button" variant="ghost" onClick={() => setPairs((prev) => move(prev, idx, 1))}><ArrowDown className="h-4 w-4" /></Button></div>)}<Button type="button" variant="outline" onClick={() => setPairs((prev) => [...prev, { leftText: "", rightText: "", sortOrder: prev.length }])}>Добавить пару</Button></div>}
      {error && <div className="text-sm text-red-600">{error}</div>}</div>
  </Modal>;
}
