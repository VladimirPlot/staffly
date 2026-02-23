import { Eye, EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { type MouseEvent, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
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

  const [createMenuOpen, setCreateMenuOpen] = useState(false);
  const [createModalTarget, setCreateModalTarget] = useState<CreateTarget>(null);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<TrainingExamDto | null>(null);
  const createMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!createMenuOpen) return;

    const onPointerDown = (event: PointerEvent) => {
      if (createMenuRef.current?.contains(event.target as Node)) return;
      setCreateMenuOpen(false);
    };

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setCreateMenuOpen(false);
    };

    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [createMenuOpen]);

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

            <div ref={createMenuRef} className="relative sm:hidden">
              <Button
                variant="outline"
                onClick={() => setCreateMenuOpen((prev) => !prev)}
                aria-expanded={createMenuOpen}
                aria-haspopup="menu"
              >
                <span className="inline-flex items-center gap-2">
                  <Icon icon={Plus} size="sm" />
                  Создать
                </span>
              </Button>
              {createMenuOpen && (
                <div className="border-subtle bg-surface absolute right-0 z-20 mt-2 w-56 rounded-2xl border p-1 shadow-[var(--staffly-shadow)]">
                  <button
                    type="button"
                    className="text-default hover:bg-app w-full rounded-xl px-3 py-2 text-left text-sm"
                    onClick={() => {
                      setCreateMenuOpen(false);
                      setCreateModalTarget("exam");
                    }}
                  >
                    Аттестацию
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {(examsState.loading || progressState.loading) && <LoadingState label="Загрузка аттестаций…" />}
      {examsState.error && <ErrorState message={examsState.error} onRetry={examsState.reload} />}
      {progressState.error && <ErrorState message={progressState.error} onRetry={progressState.reload} />}

      {!examsState.loading && !examsState.error && examsState.exams.length === 0 && (
        <EmptyState title="Аттестаций пока нет" description="Когда они появятся, их можно будет пройти здесь." />
      )}

      {examsState.exams.length > 0 && (
        <div className="border-subtle bg-surface space-y-3 rounded-2xl border p-3">
          {examsState.exams.map((exam) => {
            const isBusy = examsState.actionLoadingId === exam.id;
            const progress = progressState.progressByExamId.get(exam.id);
            return (
              <div
                key={exam.id}
                role="link"
                tabIndex={0}
                onClick={() => navigate(trainingRoutes.examRun(exam.id))}
                onKeyDown={(event) => {
                  if (event.currentTarget !== event.target) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(trainingRoutes.examRun(exam.id));
                  }
                }}
                className="group border-subtle bg-app relative flex flex-col gap-3 rounded-3xl border p-4 transition hover:-translate-y-[1px] hover:shadow-md focus-visible:-translate-y-[1px] focus-visible:shadow-md sm:gap-4 sm:p-6"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-base font-semibold text-strong sm:text-lg">{exam.title}</span>
                      <ExamProgressBadge progress={progress} />
                      {!exam.active && (
                        <span className="inline-flex rounded-full border border-amber-300 bg-amber-100 px-2 py-0.5 text-xs text-amber-700 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-300">
                          Скрыта
                        </span>
                      )}
                    </div>
                    {exam.description && <div className="text-sm text-muted">{exam.description}</div>}
                    <div className="text-sm text-muted">
                      Вопросов: {exam.questionCount} · Проходной балл: {exam.passPercent}%
                      {typeof progress?.scorePercent === "number"
                        ? ` · Последний результат: ${progress.scorePercent}%`
                        : ""}
                    </div>
                  </div>

                  {canManage && (
                    <div className="relative z-10 flex items-center gap-1">
                      <IconButton
                        aria-label="Редактировать аттестацию"
                        title="Редактировать"
                        onClick={(event) => stopAnd(event, () => setEditingExam(exam))}
                        disabled={isBusy}
                        className="px-2 py-1.5"
                      >
                        <Icon icon={Pencil} size="sm" />
                      </IconButton>

                      {exam.active ? (
                        <IconButton
                          aria-label="Скрыть аттестацию"
                          title="Скрыть"
                          onClick={(event) => stopAnd(event, () => examsState.hide(exam.id))}
                          disabled={isBusy}
                          className="px-2 py-1.5"
                        >
                          <Icon icon={EyeOff} size="sm" />
                        </IconButton>
                      ) : (
                        <IconButton
                          aria-label="Восстановить аттестацию"
                          title="Восстановить"
                          onClick={(event) => stopAnd(event, () => examsState.restore(exam.id))}
                          disabled={isBusy}
                          className="px-2 py-1.5"
                        >
                          <Icon icon={Eye} size="sm" />
                        </IconButton>
                      )}

                      <IconButton
                        aria-label={exam.active ? "Скрыть аттестацию" : "Удалить аттестацию навсегда"}
                        title={exam.active ? "Скрыть" : "Удалить навсегда"}
                        onClick={(event) =>
                          stopAnd(event, () => {
                            if (exam.active) {
                              examsState.hide(exam.id);
                              return;
                            }
                            setDeleteCandidate(exam);
                          })
                        }
                        disabled={isBusy}
                        className="px-2 py-1.5"
                      >
                        <Icon icon={Trash2} size="sm" />
                      </IconButton>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Modal
        open={createModalTarget !== null || editingExam !== null}
        title="В разработке"
        description={
          createModalTarget
            ? "Создание аттестации появится в следующих релизах."
            : "Редактирование аттестации появится в следующих релизах."
        }
        onClose={closeModal}
        footer={<Button onClick={closeModal}>Закрыть</Button>}
      />

      <ConfirmDialog
        open={deleteCandidate !== null}
        title="Удалить аттестацию навсегда?"
        description="Будут удалены все результаты и попытки, действие необратимо."
        confirmText="Удалить"
        confirming={
          deleteCandidate !== null && examsState.actionLoadingId === deleteCandidate.id
        }
        onCancel={() => setDeleteCandidate(null)}
        onConfirm={() => {
          if (!deleteCandidate) return;
          void examsState.remove(deleteCandidate.id);
          setDeleteCandidate(null);
        }}
      />
    </div>
  );
}
