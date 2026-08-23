import { Archive, Eye, Folder, FolderPlus, MoveRight, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";

import { useAuth } from "../../../shared/providers/AuthProvider";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import {
  deleteExam,
  deleteFolder,
  hideExam,
  listExams,
  moveCertificationExam,
  moveFolder,
  restoreExam,
} from "../api/trainingApi";
import type { TrainingExamDto, TrainingFolderDto } from "../api/types";
import CertificationManageExamCard from "../components/certification/CertificationManageExamCard";
import ChangeCertificationOwnerModal from "../components/certification/ChangeCertificationOwnerModal";
import ExamEditorModal from "../components/ExamEditorModal";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import LoadingState from "../components/LoadingState";
import TrainingBreadcrumbs from "../components/TrainingBreadcrumbs";
import TrainingFolderModal from "../components/TrainingFolderModal";
import TrainingMoveModal from "../components/TrainingMoveModal";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { buildTrainingFolderChain } from "../trainingFolderDnd";
import type { TrainingMoveTarget } from "../trainingFolderObjects";
import { getTrainingErrorMessage } from "../utils/errors";
import { buildTrainingExamsReturnTo, withReturnToParam } from "../utils/returnTo";
import { bySortOrderAndName } from "../utils/sort";
import { trainingRoutes } from "../utils/trainingRoutes";
import { examTargetsAllowedAudience, getManageableAudienceRoles } from "../utils/certificationRoleScope";

export default function CertificationFolderPage() {
  const { folderId } = useParams();
  const currentFolderId = Number(folderId);
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { restaurantId, canManage, myRole, isTrainingExaminer, loading: accessLoading } = useTrainingAccess();
  const restaurantAccess = resolveRestaurantAccess(user?.roles, myRole ?? undefined);
  const allowedAudienceRoles = useMemo(
    () =>
      getManageableAudienceRoles({
        isCreator: restaurantAccess.isCreator,
        isExaminer: isTrainingExaminer,
        membershipRole: myRole,
      }),
    [isTrainingExaminer, myRole, restaurantAccess.isCreator],
  );
  const foldersState = useTrainingFolders({
    restaurantId,
    type: "CERTIFICATION",
    canManage,
    initialIncludeInactive: true,
  });
  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [contentLoading, setContentLoading] = useState(false);
  const [contentError, setContentError] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [examModalOpen, setExamModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [changeOwnerExam, setChangeOwnerExam] = useState<TrainingExamDto | null>(null);
  const [moveTarget, setMoveTarget] = useState<TrainingMoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveDeleteTarget, setArchiveDeleteTarget] = useState<ArchivedTrainingObject | null>(null);
  const [archiveActionLoading, setArchiveActionLoading] = useState<string | null>(null);
  const [folderActionLoadingId, setFolderActionLoadingId] = useState<number | null>(null);
  const [examActionLoadingId, setExamActionLoadingId] = useState<number | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const loadContent = useCallback(async () => {
    if (!restaurantId || !canManage) return;
    setContentLoading(true);
    setContentError(null);
    try {
      const [examResponse, positionResponse] = await Promise.all([
        listExams(restaurantId, true, true),
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
    () =>
      foldersState.folders
        .filter((folder) => folder.parentId === currentFolderId && folder.active)
        .sort(bySortOrderAndName),
    [currentFolderId, foldersState.folders],
  );
  const positionsById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);
  const currentExams = useMemo(
    () =>
      exams
        .filter(
          (exam) =>
            exam.mode === "CERTIFICATION" &&
            exam.folderId === currentFolderId &&
            exam.active &&
            examTargetsAllowedAudience(exam, positionsById, allowedAudienceRoles),
        )
        .sort(bySortOrderAndName),
    [allowedAudienceRoles, currentFolderId, exams, positionsById],
  );
  const hiddenChildFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId === currentFolderId && !folder.active),
    [currentFolderId, foldersState.folders],
  );
  const hiddenCurrentExams = useMemo(
    () => exams.filter((exam) => exam.mode === "CERTIFICATION" && exam.folderId === currentFolderId && !exam.active),
    [currentFolderId, exams],
  );
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

  const submitMove = async (targetFolderId: number | null) => {
    if (!restaurantId || !moveTarget) return;
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      if (moveTarget.kind === "folder") {
        await moveFolder(restaurantId, moveTarget.id, { parentId: targetFolderId });
        await reloadFolderContents();
      } else if (moveTarget.kind === "certificationExam") {
        await moveCertificationExam(restaurantId, moveTarget.id, { folderId: targetFolderId });
        await loadContent();
      }
      setMoveTarget(null);
    } catch (error) {
      setMoveError(getTrainingErrorMessage(error, "Не удалось переместить."));
    } finally {
      setMoveSubmitting(false);
    }
  };

  const restoreArchivedObject = async (object: ArchivedTrainingObject) => {
    if (!restaurantId) return;
    const actionKey = `restore-${object.kind}-${object.id}`;
    setArchiveActionLoading(actionKey);
    setActionError(null);
    try {
      if (object.kind === "folder") await foldersState.restore(object.id);
      else if (object.kind === "certificationExam") await restoreExam(restaurantId, object.id);
      await reloadFolderContents();
    } catch (error) {
      setActionError(getTrainingErrorMessage(error, "Не удалось восстановить объект."));
    } finally {
      setArchiveActionLoading(null);
    }
  };

  const deleteArchivedObject = async () => {
    if (!restaurantId || !archiveDeleteTarget) return;
    const target = archiveDeleteTarget;
    setArchiveActionLoading(`delete-${target.kind}-${target.id}`);
    setActionError(null);
    try {
      if (target.kind === "folder") await deleteFolder(restaurantId, target.id);
      else if (target.kind === "certificationExam") await deleteExam(restaurantId, target.id);
      setArchiveDeleteTarget(null);
      await reloadFolderContents();
    } catch (error) {
      setActionError(getTrainingErrorMessage(error, "Не удалось удалить объект."));
    } finally {
      setArchiveActionLoading(null);
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
              <Button variant="outline" leftIcon={<Archive className="h-4 w-4" />} onClick={() => setArchiveOpen(true)}>
                Скрытые
              </Button>
              <Button
                variant="outline"
                leftIcon={<FolderPlus className="h-4 w-4" />}
                onClick={() => setFolderModalOpen(true)}
              >
                Создать папку
              </Button>
              <Button variant="outline" leftIcon={<Plus className="h-4 w-4" />} onClick={() => setExamModalOpen(true)}>
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
                          aria-label="Переместить папку"
                          title="Переместить"
                          disabled={folderActionLoadingId === folder.id}
                          onClick={(event) => {
                            event.stopPropagation();
                            setMoveError(null);
                            setMoveTarget({ kind: "folder", id: folder.id, title: folder.name });
                          }}
                        >
                          <MoveRight className="h-4 w-4" />
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
                    onMove={(value) => {
                      setMoveError(null);
                      setMoveTarget({ kind: "certificationExam", id: value.id, title: value.title });
                    }}
                    onAction={runExamAction}
                    showDeleteAction={false}
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
          certificationAllowedAudienceRoles={allowedAudienceRoles}
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

      <TrainingMoveModal
        target={moveTarget}
        type="CERTIFICATION"
        folders={foldersState.folders}
        currentFolderId={currentFolderId}
        submitting={moveSubmitting}
        error={moveError}
        onClose={() => {
          if (moveSubmitting) return;
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={(targetFolderId) => void submitMove(targetFolderId)}
      />

      <TrainingArchiveModal
        open={archiveOpen}
        title="Скрытые"
        emptyText="В этой папке нет скрытых объектов."
        folders={hiddenChildFolders}
        certificationExams={hiddenCurrentExams}
        loading={loading}
        error={foldersState.error ?? contentError}
        actionLoading={archiveActionLoading}
        onClose={() => setArchiveOpen(false)}
        onRestore={(object) => void restoreArchivedObject(object)}
        onDelete={setArchiveDeleteTarget}
        onDeleteAll={() => undefined}
        showDeleteAll={false}
      />
      <ConfirmDialog
        open={Boolean(archiveDeleteTarget)}
        title="Удалить навсегда"
        description={
          archiveDeleteTarget?.kind === "folder"
            ? "Папка, все вложенные папки и все аттестации внутри будут удалены безвозвратно."
            : "Аттестация будет удалена безвозвратно."
        }
        confirmText="Удалить навсегда"
        tone="danger"
        confirming={Boolean(archiveActionLoading?.startsWith("delete-"))}
        onCancel={() => setArchiveDeleteTarget(null)}
        onConfirm={() => void deleteArchivedObject()}
      />
    </div>
  );
}
