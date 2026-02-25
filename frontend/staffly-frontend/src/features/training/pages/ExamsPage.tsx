import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { type MouseEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamProgressBadge from "../components/ExamProgressBadge";
import LoadingState from "../components/LoadingState";
import { createExam, getExamResults, updateExam } from "../api/trainingApi";
import type { ExamResultRowDto, TrainingExamDto, TrainingExamMode } from "../api/types";
import { useExamProgress } from "../hooks/useExamProgress";
import { useExams } from "../hooks/useExams";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function ExamsPage() {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const examsState = useExams({ restaurantId, canManage, certificationOnly: true });
  const progressState = useExamProgress(restaurantId);
  const foldersState = useTrainingFolders({ restaurantId, canManage, type: "QUESTION_BANK" });

  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteCandidate, setDeleteCandidate] = useState<TrainingExamDto | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [resultsExamId, setResultsExamId] = useState<number | null>(null);
  const [results, setResults] = useState<ExamResultRowDto[]>([]);
  const [positionFilter, setPositionFilter] = useState<number | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [mode, setMode] = useState<TrainingExamMode>("CERTIFICATION");
  const [questionCount, setQuestionCount] = useState(10);
  const [passPercent, setPassPercent] = useState(80);
  const [timeLimitSec, setTimeLimitSec] = useState<number | "">("");
  const [attemptLimit, setAttemptLimit] = useState<number | "">("");
  const [folderIds, setFolderIds] = useState<number[]>([]);
  const [visibilityPositionIds, setVisibilityPositionIds] = useState<number[]>([]);

  useEffect(() => {
    if (!restaurantId) return;
    void listPositions(restaurantId, { includeInactive: false }).then(setPositions).catch(() => setPositions([]));
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId || !resultsExamId) return;
    void getExamResults(restaurantId, resultsExamId, positionFilter ?? undefined).then(setResults).catch(() => setResults([]));
  }, [restaurantId, resultsExamId, positionFilter]);

  const stopAnd = (event: MouseEvent, callback: () => void) => { event.stopPropagation(); callback(); };
  const resetForm = () => {
    setTitle(""); setDescription(""); setMode("CERTIFICATION"); setQuestionCount(10); setPassPercent(80);
    setTimeLimitSec(""); setAttemptLimit(""); setFolderIds([]); setVisibilityPositionIds([]); setFormError(null);
  };

  const openCreate = () => { setEditingExam(null); resetForm(); setModalOpen(true); };
  const openEdit = (exam: TrainingExamDto) => {
    setEditingExam(exam); setTitle(exam.title); setDescription(exam.description ?? ""); setMode(exam.mode);
    setQuestionCount(exam.questionCount); setPassPercent(exam.passPercent); setTimeLimitSec(exam.timeLimitSec ?? "");
    setAttemptLimit(exam.attemptLimit ?? ""); setFolderIds(exam.folderIds); setVisibilityPositionIds(exam.visibilityPositionIds); setModalOpen(true);
  };

  const submit = async () => {
    if (!restaurantId) return;
    setSaving(true); setFormError(null);
    const payload = {
      title: title.trim(), description: description.trim() || null, mode, questionCount, passPercent,
      timeLimitSec: timeLimitSec === "" ? null : Number(timeLimitSec),
      attemptLimit: attemptLimit === "" ? null : Number(attemptLimit), folderIds, visibilityPositionIds,
    };
    try {
      if (editingExam) await updateExam(restaurantId, editingExam.id, { ...payload, active: editingExam.active });
      else await createExam(restaurantId, payload);
      setModalOpen(false); await examsState.reload();
    } catch (e) { setFormError(getTrainingErrorMessage(e, "Не удалось сохранить тест.")); }
    finally { setSaving(false); }
  };

  const toggleArray = (id: number, values: number[], setter: (x: number[]) => void) => setter(values.includes(id) ? values.filter((x) => x !== id) : [...values, id]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>
      {canManage && <div className="border-subtle bg-surface rounded-2xl border p-3 flex items-center justify-between"><Switch label="Скрытые элементы" checked={examsState.includeInactive} onChange={(event) => examsState.setIncludeInactive(event.target.checked)} /><Button variant="outline" onClick={openCreate}><Plus className="mr-2 h-4 w-4"/>Создать аттестацию</Button></div>}

      {(examsState.loading || progressState.loading) && <LoadingState label="Загрузка аттестаций…" />}
      {examsState.error && <ErrorState message={examsState.error} onRetry={examsState.reload} />}
      {!examsState.loading && examsState.exams.length === 0 && <EmptyState title="Аттестаций пока нет" description="Создайте первую аттестацию для сотрудников." />}

      {examsState.exams.map((exam) => (
        <div key={exam.id} role="link" tabIndex={0} className="border-subtle bg-surface group flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:-translate-y-[1px] hover:shadow-md" onClick={() => navigate(trainingRoutes.examRun(exam.id))}>
          <div className="space-y-1"><div className="flex items-center gap-2"><div className="text-base font-semibold text-strong">{exam.title}</div>{!exam.active && <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">Скрыт</span>}<ExamProgressBadge progress={progressState.progressByExamId.get(exam.id)} /></div>{exam.description && <div className="text-sm text-muted">{exam.description}</div>}</div>
          {canManage && <div className="flex items-center gap-1"><Button variant="ghost" onClick={(event) => stopAnd(event, () => openEdit(exam))}><Pencil className="h-4 w-4" /></Button>{exam.active ? <Button variant="ghost" onClick={(event) => stopAnd(event, () => examsState.hide(exam.id))}><EyeOff className="h-4 w-4"/></Button> : <Button variant="ghost" onClick={(event) => stopAnd(event, () => examsState.restore(exam.id))}><Eye className="h-4 w-4"/></Button>}<Button variant="ghost" onClick={(event) => stopAnd(event, () => setDeleteCandidate(exam))}><Trash2 className="h-4 w-4"/></Button><Button variant="outline" onClick={(event) => stopAnd(event, () => setResultsExamId(exam.id))}>Отчёт</Button></div>}
        </div>
      ))}

      <Modal open={modalOpen} title={editingExam ? "Редактировать тест" : "Создать тест"} onClose={() => setModalOpen(false)} footer={<><Button variant="outline" onClick={() => setModalOpen(false)}>Отмена</Button><Button onClick={submit} isLoading={saving} disabled={!title.trim() || folderIds.length === 0}>Сохранить</Button></>}>
        <div className="space-y-3">
          <Input label="Название" value={title} onChange={(e) => setTitle(e.target.value)} required />
          <Input label="Описание" value={description} onChange={(e) => setDescription(e.target.value)} />
          <div className="grid grid-cols-2 gap-2"><Input label="Вопросов" type="number" value={questionCount} onChange={(e) => setQuestionCount(Number(e.target.value))} /><Input label="Проходной %" type="number" value={passPercent} onChange={(e) => setPassPercent(Number(e.target.value))} /></div>
          <div className="grid grid-cols-2 gap-2"><Input label="Таймер, сек" type="number" value={timeLimitSec} onChange={(e) => setTimeLimitSec(e.target.value === "" ? "" : Number(e.target.value))} /><Input label="Лимит попыток" type="number" value={attemptLimit} onChange={(e) => setAttemptLimit(e.target.value === "" ? "" : Number(e.target.value))} /></div>
          <div className="flex gap-2"><Button variant={mode === "CERTIFICATION" ? "primary" : "outline"} type="button" onClick={() => setMode("CERTIFICATION")}>Аттестация</Button><Button variant={mode === "PRACTICE" ? "primary" : "outline"} type="button" onClick={() => setMode("PRACTICE")}>Практика</Button></div>
          <div><div className="text-sm text-muted">Папки scope</div><div className="flex flex-wrap gap-2 mt-1">{foldersState.folders.map((f) => <button key={f.id} className={`rounded-full border px-3 py-1 text-xs ${folderIds.includes(f.id) ? "bg-zinc-900 text-white" : ""}`} onClick={() => toggleArray(f.id, folderIds, setFolderIds)} type="button">{f.name}</button>)}</div></div>
          <div><div className="text-sm text-muted">Видимость (пусто = всем)</div><div className="flex flex-wrap gap-2 mt-1">{positions.map((p) => <button key={p.id} className={`rounded-full border px-3 py-1 text-xs ${visibilityPositionIds.includes(p.id) ? "bg-zinc-900 text-white" : ""}`} onClick={() => toggleArray(p.id, visibilityPositionIds, setVisibilityPositionIds)} type="button">{p.name}</button>)}</div></div>
          {formError && <div className="text-sm text-red-600">{formError}</div>}
        </div>
      </Modal>

      <Modal open={resultsExamId !== null} title="Отчёт по аттестации" onClose={() => setResultsExamId(null)}>
        <div className="space-y-3"><select className="border-subtle rounded-xl border p-2 text-sm" value={positionFilter ?? ""} onChange={(e) => setPositionFilter(e.target.value ? Number(e.target.value) : null)}><option value="">Все должности</option>{positions.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select><div className="space-y-1">{results.map((row) => <div key={row.userId} className="border-subtle rounded-xl border p-2 text-sm flex justify-between"><span>{row.fullName}</span><span>{row.attemptsUsed} попыток / лучший {row.bestScore ?? "—"}% / {row.passed ? "Сдал" : "Не сдал"}</span></div>)}</div></div>
      </Modal>

      <ConfirmDialog open={deleteCandidate !== null} title="Удалить аттестацию?" description="Действие необратимо." confirmText="Удалить" confirming={examsState.actionLoadingId === deleteCandidate?.id} onCancel={() => setDeleteCandidate(null)} onConfirm={async () => { if (!deleteCandidate) return; await examsState.deleteForever(deleteCandidate.id); setDeleteCandidate(null); }} />
    </div>
  );
}
