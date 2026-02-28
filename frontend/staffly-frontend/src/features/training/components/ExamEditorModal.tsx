import { useEffect, useMemo, useState } from "react";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import SelectField from "../../../shared/ui/SelectField";
import type { ExamSourceFolderDto, QuestionBankTreeNodeDto, TrainingExamDto, TrainingExamMode, TrainingQuestionDto } from "../api/types";
import { createExam, listQuestionBankTree, listQuestions, updateExam } from "../api/trainingApi";
import { getTrainingErrorMessage } from "../utils/errors";

type Props = {
  open: boolean;
  restaurantId: number;
  mode: TrainingExamMode;
  exam?: TrainingExamDto | null;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function ExamEditorModal({ open, restaurantId, mode, exam, onClose, onSaved }: Props) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [questionCount, setQuestionCount] = useState(10);
  const [passPercent, setPassPercent] = useState(80);
  const [timeLimitSec, setTimeLimitSec] = useState<number | "">("");
  const [attemptLimit, setAttemptLimit] = useState<number | "">("");
  const [visibilityPositionIds, setVisibilityPositionIds] = useState<number[]>([]);
  const [sourcesFolders, setSourcesFolders] = useState<ExamSourceFolderDto[]>([]);
  const [sourceQuestionIds, setSourceQuestionIds] = useState<number[]>([]);
  const [tree, setTree] = useState<QuestionBankTreeNodeDto[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<number | null>(null);
  const [folderQuestions, setFolderQuestions] = useState<TrainingQuestionDto[]>([]);
  const [query, setQuery] = useState("");
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setTitle(exam?.title ?? "");
    setDescription(exam?.description ?? "");
    setQuestionCount(exam?.questionCount ?? 10);
    setPassPercent(exam?.passPercent ?? 80);
    setTimeLimitSec(exam?.timeLimitSec ?? "");
    setAttemptLimit(exam?.attemptLimit ?? "");
    setVisibilityPositionIds(exam?.visibilityPositionIds ?? []);
    setSourcesFolders(exam?.sourcesFolders ?? []);
    setSourceQuestionIds(exam?.sourceQuestionIds ?? []);
    setError(null);
  }, [open, exam]);

  useEffect(() => {
    if (!open) return;
    void listQuestionBankTree(restaurantId, mode, false).then(setTree).catch(() => setTree([]));
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [open, restaurantId, mode]);

  useEffect(() => {
    if (!open || !selectedFolderId) return;
    const group = mode === "PRACTICE" ? "PRACTICE" : "CERTIFICATION";
    void listQuestions(restaurantId, selectedFolderId, false, query || undefined, group).then(setFolderQuestions).catch(() => setFolderQuestions([]));
  }, [open, restaurantId, selectedFolderId, mode, query]);

  const folderSourceMap = useMemo(() => new Map(sourcesFolders.map((s) => [s.folderId, s])), [sourcesFolders]);
  const uniquePoolCount = useMemo(() => sourceQuestionIds.length + sourcesFolders.length, [sourceQuestionIds.length, sourcesFolders.length]);

  const toggleFolder = (folderId: number) => {
    if (folderSourceMap.has(folderId)) setSourcesFolders((prev) => prev.filter((s) => s.folderId !== folderId));
    else setSourcesFolders((prev) => [...prev, { folderId, pickMode: "ALL" }]);
    setSourceQuestionIds((prev) => prev.filter((id) => !folderQuestions.some((q) => q.id === id)));
  };

  const submit = async () => {
    if (!title.trim()) return setError("Название обязательно.");
    if (mode === "CERTIFICATION" && attemptLimit === "") return setError("Для аттестации лимит попыток обязателен.");
    if (sourcesFolders.length === 0 && sourceQuestionIds.length === 0) return setError("Выберите источники вопросов.");
    setSaving(true);
    setError(null);
    try {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        mode,
        questionCount,
        passPercent,
        timeLimitSec: timeLimitSec === "" ? null : Number(timeLimitSec),
        attemptLimit: attemptLimit === "" ? null : Number(attemptLimit),
        visibilityPositionIds,
        sourcesFolders,
        sourceQuestionIds,
      };
      if (exam) await updateExam(restaurantId, exam.id, { ...payload, active: exam.active });
      else await createExam(restaurantId, payload);
      await onSaved();
      onClose();
    } catch (e) {
      setError(getTrainingErrorMessage(e, "Не удалось сохранить тест."));
    } finally {
      setSaving(false);
    }
  };

  const renderNode = (node: QuestionBankTreeNodeDto, level = 0) => {
    const source = folderSourceMap.get(node.id);
    const disabledQuestions = !!source && selectedFolderId === node.id;
    return (
      <div key={node.id} className="space-y-1">
        <div className="flex items-center gap-2" style={{ paddingLeft: `${level * 12}px` }}>
          <button type="button" className="text-left text-sm" onClick={() => setSelectedFolderId(node.id)}>{node.name} ({node.questionCount})</button>
          <input type="checkbox" checked={!!source} onChange={() => toggleFolder(node.id)} />
          {source && (
            <>
              <select value={source.pickMode} onChange={(e) => setSourcesFolders((prev) => prev.map((x) => x.folderId === node.id ? { ...x, pickMode: e.target.value as "ALL" | "RANDOM", randomCount: e.target.value === "RANDOM" ? x.randomCount ?? 1 : null } : x))}>
                <option value="ALL">Все</option>
                <option value="RANDOM">Рандом N</option>
              </select>
              {source.pickMode === "RANDOM" && <input className="w-16" type="number" min={1} value={source.randomCount ?? 1} onChange={(e) => setSourcesFolders((prev) => prev.map((x) => x.folderId === node.id ? { ...x, randomCount: Number(e.target.value) } : x))} />}
            </>
          )}
          {disabledQuestions && <span className="text-xs text-muted">Папка уже добавлена целиком/рандомом</span>}
        </div>
        {node.children.map((child) => renderNode(child, level + 1))}
      </div>
    );
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию"}
      footer={<><Button variant="outline" onClick={onClose}>Отмена</Button><Button onClick={submit} isLoading={saving}>Сохранить</Button></>}
    >
      <div className="space-y-3">
        <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
        <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
        <div className="grid grid-cols-2 gap-2">
          <Input label="Кол-во вопросов" type="number" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} />
          <Input label="Проходной %" type="number" value={passPercent} onChange={(e) => setPassPercent(Number(e.target.value))} />
          <Input label="Таймер (сек)" type="number" value={timeLimitSec} onChange={(e) => setTimeLimitSec(e.target.value === "" ? "" : Number(e.target.value))} />
          <Input label="Лимит попыток" type="number" value={attemptLimit} onChange={(e) => setAttemptLimit(e.target.value === "" ? "" : Number(e.target.value))} />
        </div>
        <SelectField label="Видимость по должностям" value="" onChange={() => undefined}>
          <option value="">Выберите в списке ниже</option>
        </SelectField>
        <div className="flex flex-wrap gap-2">{positions.map((p) => <button key={p.id} type="button" className={`rounded-full border px-2 py-1 text-xs ${visibilityPositionIds.includes(p.id) ? "bg-zinc-900 text-white" : ""}`} onClick={() => setVisibilityPositionIds((prev) => prev.includes(p.id) ? prev.filter((x) => x !== p.id) : [...prev, p.id])}>{p.name}</button>)}</div>

        <div className="grid grid-cols-2 gap-3">
          <div className="max-h-72 overflow-auto rounded-xl border p-2">{tree.map((n) => renderNode(n))}</div>
          <div className="space-y-2 rounded-xl border p-2">
            <Input label="Поиск" value={query} onChange={(e) => setQuery(e.target.value)} />
            <div className="max-h-60 overflow-auto space-y-1">
              {folderQuestions.map((q) => {
                const disabled = !!selectedFolderId && folderSourceMap.has(selectedFolderId);
                return <label key={q.id} className="flex items-center gap-2 text-sm"><input type="checkbox" disabled={disabled} checked={sourceQuestionIds.includes(q.id)} onChange={() => setSourceQuestionIds((prev) => prev.includes(q.id) ? prev.filter((x) => x !== q.id) : [...prev, q.id])} />{q.title}<span className="text-xs text-muted">{q.type}</span></label>;
              })}
            </div>
          </div>
        </div>

        <div className="text-sm text-muted">Уникальных источников в пуле: {uniquePoolCount}</div>
        {error && <div className="text-sm text-red-600">{error}</div>}
      </div>
    </Modal>
  );
}
