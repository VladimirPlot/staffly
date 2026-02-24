import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { type MouseEvent, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Modal from "../../../shared/ui/Modal";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamProgressBadge from "../components/ExamProgressBadge";
import LoadingState from "../components/LoadingState";
import type { TrainingExamDto } from "../api/types";
import { useExamProgress } from "../hooks/useExamProgress";
import { useExams } from "../hooks/useExams";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { trainingRoutes } from "../utils/trainingRoutes";

type CreateTarget = "exam" | null;

export default function ExamsPage() {
  const navigate = useNavigate();
  const { restaurantId, canManage } = useTrainingAccess();
  const examsState = useExams({ restaurantId, canManage });
  const progressState = useExamProgress(restaurantId);

  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TrainingExamDto | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  // click-away / escape handled inside shared DropdownMenu

  const stopAnd = (event: MouseEvent, callback: () => void) => {
    event.stopPropagation();
    callback();
  };

  const closeModal = () => {
    setCreateModalTarget(null);
    setEditingExam(null);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>

      {canManage && (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Switch
              label="Скрытые элементы"
              checked={examsState.includeInactive}
              onChange={(event) => examsState.setIncludeInactive(event.target.checked)}
            />

            <div className="hidden gap-2 sm:flex">
              <Button variant="outline" onClick={() => setCreateModalTarget("exam")}>
                Создать аттестацию
              </Button>
            </div>

            <div ref={createMenuRef} className="sm:hidden">
              <DropdownMenu
                trigger={(triggerProps) => (
                  <Button variant="outline" {...triggerProps}>
                    <span className="inline-flex items-center gap-2">
                      <Icon icon={Plus} size="sm" />
                      Создать
                    </span>
                  </Button>
                )}
              >
                {({ close }) => (
                  <button
                    type="button"
                    role="menuitem"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => {
                      close();
                      setCreateModalTarget("exam");
                    }}
                  >
                    Аттестацию
                  </button>
                )}
              </DropdownMenu>
            </div>
          </div>
        </div>
      )}

      {(examsState.loading || progressState.loading) && <LoadingState label="Загрузка аттестаций…" />}
      {examsState.error && <ErrorState message={examsState.error} onRetry={examsState.reload} />}
      {progressState.error && <ErrorState message={progressState.error} onRetry={progressState.reload} />}

      {!examsState.loading && !examsState.error && examsState.exams.length === 0 && (
        <EmptyState title="Аттестаций пока нет" description="Создайте первую аттестацию для сотрудников." />
      )}

      {!examsState.loading && !examsState.error && examsState.exams.length > 0 && (
        <div className="space-y-3">
          {examsState.exams.map((exam) => (
            <div
              key={exam.id}
              role="link"
              tabIndex={0}
              className="border-subtle bg-surface group flex items-center justify-between gap-3 rounded-2xl border p-3 transition hover:-translate-y-[1px] hover:shadow-md"
              onClick={() => navigate(trainingRoutes.exam(exam.id))}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") navigate(trainingRoutes.exam(exam.id));
              }}
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <div className="text-base font-semibold text-strong">{exam.title}</div>
                  {!exam.active && (
                    <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">Скрыт</span>
                  )}
                  <ExamProgressBadge progress={progressState.progressByExamId.get(exam.id) ?? null} />
                </div>
                {exam.description && <div className="text-sm text-muted">{exam.description}</div>}
              </div>

              {canManage && (
                <div className="flex items-center gap-1">
                  <IconButton
                    aria-label="Редактировать"
                    title="Редактировать"
                    onClick={(event) =>
                      stopAnd(event, () => {
                        setEditingExam(exam);
                        setCreateModalTarget("exam");
                      })
                    }
                    className="px-2 py-1.5"
                  >
                    <Icon icon={Pencil} size="sm" />
                  </IconButton>

                  {exam.active ? (
                    <IconButton
                      aria-label="Скрыть"
                      title="Скрыть"
                      onClick={(event) => stopAnd(event, () => examsState.hide(exam.id))}
                      className="px-2 py-1.5"
                    >
                      <Icon icon={EyeOff} size="sm" />
                    </IconButton>
                  ) : (
                    <IconButton
                      aria-label="Восстановить"
                      title="Восстановить"
                      onClick={(event) => stopAnd(event, () => examsState.restore(exam.id))}
                      className="px-2 py-1.5"
                    >
                      <Icon icon={Eye} size="sm" />
                    </IconButton>
                  )}

                  <IconButton
                    aria-label="Удалить"
                    title="Удалить"
                    onClick={(event) => stopAnd(event, () => setDeleteCandidate(exam))}
                    className="px-2 py-1.5"
                  >
                    <Icon icon={Trash2} size="sm" />
                  </IconButton>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      <Modal open={createModalTarget !== null} title="Создать / Редактировать аттестацию" onClose={closeModal}>
        <div className="text-sm text-muted">Заглушка модалки (логика не менялась).</div>
      </Modal>

      <ConfirmDialog
        open={deleteCandidate !== null}
        title="Удалить аттестацию?"
        description="Действие необратимо."
        confirmText="Удалить"
        confirming={examsState.actionLoadingId === deleteCandidate?.id}
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (!deleteCandidate) return;
          examsState.deleteForever(deleteCandidate.id);
          setDeleteCandidate(null);
        }}
      />
    </div>
  );
}
