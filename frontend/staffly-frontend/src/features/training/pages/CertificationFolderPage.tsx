import { Eye, Folder, FolderPlus, Pencil, Plus, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { deleteExam, deleteFolder, hideExam, listExams, restoreExam } from "../api/trainingApi";
import type { TrainingExamDto, TrainingFolderDto } from "../api/types";
import CertificationManageExamCard from "../components/certification/CertificationManageExamCard";
import ChangeCertificationOwnerModal from "../components/certification/ChangeCertificationOwnerModal";
import ExamEditorModal from "../components/ExamEditorModal";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import TrainingBreadcrumbs from "../components/TrainingBreadcrumbs";
import TrainingFolderModal from "../components/TrainingFolderModal";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { buildTrainingFolderChain } from "../trainingFolderDnd";
import { getTrainingErrorMessage } from "../utils/errors";
import { buildTrainingExamsReturnTo, withReturnToParam } from "../utils/returnTo";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function CertificationFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const location = useLocation();
  const { restaurantId, canManage, loading: accessLoading } = useTrainingAccess();
  const foldersState = useTrainingFolders({ restaurantId, type: "CERTIFICATION", canManage });
  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [changeOwnerExam, setChangeOwnerExam] = useState<TrainingExamDto | null>(null);
  const [deleteFolderTarget, setDeleteFolderTarget] = useState<TrainingFolderDto | null>(null);
  const [folderActionLoadingId, setFolderActionLoadingId] = useState<number | null>(null);
  const [examActionLoadingId, setExamActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    if (!restaurantId || !canManage) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const [examResponse, positionResponse] = await Promise.all([
        listExams(restaurantId, false, true),
        listPositions(restaurantId, { includeInactive: false }),
      ]);
      setExams(examResponse);
      setPositions(positionResponse);
    } catch (error) {
      setContentError(getTrainingErrorMessage(error, "Не удалось загрузить содержимое папки."));
    } finally {
      setContentLoading(false);
    }
  }, [canManage, restaurantId]);

  useEffect(() => {
    void loadContent();
  }, [loadContent]);

  const folderMap = useMemo(
    () => new Map(foldersState.folders.map((folder) => [folder.id, folder])),
    [foldersState.folders],
  );
  const currentFolder = folderMap.get(currentFolderId) ?? null;
  const folderChain = useMemo(() => buildTrainingFolderChain(currentFolder, folderMap), [currentFolder, folderMap]);
  const childFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === currentFolderId).sort(bySortOrderAndName),
    [currentFolderId, foldersState.folders],
  );
  const currentExams = useMemo(
    () =>
      exams
        .filter((exam) => exam.mode === "CERTIFICATION" && exam.folderId === currentFolderId)
        .sort(bySortOrderAndName),
    [currentFolderId, exams],
  );
  const positionsById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const returnTo = buildTrainingExamsReturnTo(location.pathname, location.search);
  const invalidFolderId = !folderId || !Number.isInteger(currentFolderId) || currentFolderId <= 0;
  const loading = foldersState.loading || contentLoading;

  const openFolder = (id: number) => navigate(trainingRoutes.certificationFolder(id));
  const handleFolderKeyDown = (event: KeyboardEvent<HTMLElement>, id: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openFolder(id);
    }
  };

  const reloadFolderContents = async () => {
    await Promise.all([foldersState.reload(), loadContent()]);
  };

  const handleHideFolder = async (folder: TrainingFolderDto) => {
    setFolderActionLoadingId(folder.id);
    setActionError(null);
    try {
      await foldersState.hide(folder.id);
      await loadContent();
    } catch (error) {
      setActionError(getTrainingErrorMessage(error, "Не удалось скрыть папку."));
    } finally {
      setFolderActionLoadingId(null);
    }
  };

  const handleDeleteFolder = async () => {
    if (!restaurantId || !deleteFolderTarget) return;
    setFolderActionLoadingId(deleteFolderTarget.id);
    setActionError(null);
    try {
      await deleteFolder(restaurantId, deleteFolderTarget.id);
      setDeleteFolderTarget(null);
      await reloadFolderContents();
    } catch (error) {
      setActionError(getTrainingErrorMessage(error, "Не удалось удалить папку."));
    } finally {
      setFolderActionLoadingId(null);
    }
  };

  const runExamAction = async (examId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setExamActionLoadingId(examId);
    setActionError(null);
    try {
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await loadContent();
    } catch (error) {
      setActionError(getTrainingErrorMessage(error, "Не удалось выполнить действие с аттестацией."));
    } finally {
      setExamActionLoadingId(null);
    }
  };

  if (accessLoading) {
    return <LoadingState label="Проверка доступа..." />;
  }

  if (!canManage) {
    return <ErrorState message="Недостаточно прав для просмотра папки" />;
  }

  if (invalidFolderId || (!foldersState.loading && !foldersState.error && !currentFolder)) {
    return <ErrorState message="Папка не найдена" />;
  }

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <TrainingBreadcrumbs
        rootLabel="Аттестации"
        currentFolderId={currentFolderId}
        folderChain={folderChain}
        activeObjectId={null}
        blockedFolderIds={new Set<number>()}
        onOpenRoot={() => navigate(trainingRoutes.exams)}
        onOpenFolder={openFolder}
      />

      {currentFolder && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <h2 className="text-2xl font-semibold">{currentFolder.name}</h2>
          {canManage && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button
                variant="outline"
                leftIcon={<FolderPlus className="h-4 w-4" />}
                onClick={() => setFolderModalOpen(true)}
              >
                Создать папку
              </Button>
              <Button
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => setExamModalOpen(true)}
              >
                Создать аттестацию
              </Button>
            </div>
          )}
        </div>
      )}
      {loading && <LoadingState label="Загрузка папки..." />}
      {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
      {contentError && <ErrorState message={contentError} onRetry={loadContent} />}
      {actionError && <ErrorState message={actionError} />}

      {!loading && !foldersState.error && !contentError && currentFolder && (
        <>
          {childFolders.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Папки</h3>
              <div className="space-y-3" role="list">
                {childFolders.map((folder) => (
                  <Card
                    key={folder.id}
                    role="link"
                    tabIndex={0}
                    className="cursor-pointer rounded-2xl p-4 transition hover:bg-[var(--staffly-control-hover)] focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:outline-none"
                    onClick={() => openFolder(folder.id)}
                    onDoubleClick={() => openFolder(folder.id)}
                    onKeyDown={(event) => handleFolderKeyDown(event, folder.id)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)]">
                        <Icon icon={Folder} size="sm" decorative />
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="font-semibold [overflow-wrap:anywhere]">{folder.name}</div>
                        {folder.description && <div className="text-muted mt-1 text-sm">{folder.description}</div>}
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <IconButton
                          aria-label="Редактировать папку"
                          title="Редактировать"
                          disabled={folderActionLoadingId === folder.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setEditingFolder(folder);
                          }}
                        >
                          <Pencil className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          aria-label="Скрыть папку"
                          title="Скрыть"
                          disabled={folderActionLoadingId === folder.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            void handleHideFolder(folder);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                        </IconButton>
                        <IconButton
                          aria-label="Удалить папку"
                          title="Удалить"
                          disabled={folderActionLoadingId === folder.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setDeleteFolderTarget(folder);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </IconButton>
                      </div>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          )}

          {currentExams.length > 0 && (
            <section className="space-y-3">
              <h3 className="text-lg font-semibold">Аттестационные тесты</h3>
              <div className="space-y-3">
                {currentExams.map((exam) => (
                  <CertificationManageExamCard
                    key={exam.id}
                    exam={exam}
                    analyticsHref={withReturnToParam(trainingRoutes.examAnalytics(exam.id), returnTo)}
                    loading={examActionLoadingId === exam.id}
                    positionsById={positionsById}
                    onEdit={(value) => {
                      setEditingExam(value);
                      setExamModalOpen(true);
                    }}
                    onChangeOwner={setChangeOwnerExam}
                    onAction={runExamAction}
                  />
                ))}
              </div>
            </section>
          )}

          {childFolders.length === 0 && currentExams.length === 0 && (
            <EmptyState title="Папка пуста" description="В этой папке пока нет папок и аттестационных тестов." />
          )}
        </>
      )}

      {restaurantId && currentFolder && (
        <TrainingFolderModal
          open={folderModalOpen}
          mode="create"
          restaurantId={restaurantId}
          type="CERTIFICATION"
          parentFolder={currentFolder}
          onClose={() => setFolderModalOpen(false)}
          onSaved={foldersState.reload}
        />
      )}

      {restaurantId && editingFolder && (
        <TrainingFolderModal
          open
          mode="edit"
          restaurantId={restaurantId}
          type="CERTIFICATION"
          parentFolder={editingFolder.parentId ? (folderMap.get(editingFolder.parentId) ?? null) : null}
          initialFolder={editingFolder}
          onClose={() => setEditingFolder(null)}
          onSaved={foldersState.reload}
        />
      )}

      {restaurantId && currentFolder && (
        <ExamEditorModal
          open={examModalOpen}
          exam={editingExam}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          initialFolderId={currentFolderId}
          onClose={() => {
            setExamModalOpen(false);
            setEditingExam(null);
          }}
          onSaved={async () => {
            setExamModalOpen(false);
            setEditingExam(null);
            await loadContent();
          }}
        />
      )}

      {restaurantId && (
        <ChangeCertificationOwnerModal
          open={Boolean(changeOwnerExam)}
          exam={changeOwnerExam}
          restaurantId={restaurantId}
          onClose={() => setChangeOwnerExam(null)}
          onSaved={loadContent}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteFolderTarget)}
        title="Удалить папку навсегда"
        description="Папка, все вложенные папки и все аттестации внутри будут удалены безвозвратно. Активную папку необходимо сначала скрыть."
        confirmText="Удалить навсегда"
        tone="danger"
        confirming={Boolean(deleteFolderTarget && folderActionLoadingId === deleteFolderTarget.id)}
        onCancel={() => setDeleteFolderTarget(null)}
        onConfirm={() => void handleDeleteFolder()}
      />
    </div>
  );
}
