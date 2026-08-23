import { Archive, Eye, Folder, FolderPlus, MoveRight, Pencil, Plus } from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type KeyboardEvent } from "react";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { useAuth } from "../../../shared/providers/AuthProvider";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import SelectField from "../../../shared/ui/SelectField";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamEditorModal from "../components/ExamEditorModal";
import LoadingState from "../components/LoadingState";
import TrainingFolderModal from "../components/TrainingFolderModal";
import TrainingMoveModal from "../components/TrainingMoveModal";
import TrainingArchiveModal, { type ArchivedTrainingObject } from "../components/TrainingArchiveModal";
import CertificationManageExamCard from "../components/certification/CertificationManageExamCard";
import CertificationMyExamCard from "../components/certification/CertificationMyExamCard";
import CertificationEmployeeStatisticsSection from "../components/certification/CertificationEmployeeStatisticsSection";
import ChangeCertificationOwnerModal from "../components/certification/ChangeCertificationOwnerModal";
import {
  deleteExam,
  deleteFolder,
  hideExam,
  listExams,
  listMyCertificationExams,
  moveCertificationExam,
  moveFolder,
  restoreExam,
} from "../api/trainingApi";
import type { CurrentUserCertificationExamDto, TrainingExamDto, TrainingFolderDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { useTrainingFolders } from "../hooks/useTrainingFolders";
import { useCertificationEmployeeSearch } from "../hooks/certification/useCertificationEmployeeSearch";
import { getTrainingErrorMessage } from "../utils/errors";
import { buildTrainingExamsReturnTo, withReturnToParam } from "../utils/returnTo";
import { trainingRoutes } from "../utils/trainingRoutes";
import { bySortOrderAndName } from "../utils/sort";
import type { TrainingMoveTarget } from "../trainingFolderObjects";
import {
  examTargetsAllowedAudience,
  getManageableAudienceRoles,
  getManageablePositions,
  sortManageExams,
} from "../utils/certificationRoleScope";

export default function ExamsPage() {
  const { user } = useAuth();
  const { restaurantId, canManage, myRole, isTrainingExaminer } = useTrainingAccess();
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const foldersState = useTrainingFolders({
    restaurantId,
    type: "CERTIFICATION",
    canManage,
    initialIncludeInactive: true,
  });

  const [manageExams, setManageExams] = useState<TrainingExamDto[]>([]);
  const [myExams, setMyExams] = useState<CurrentUserCertificationExamDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);

  const [loadingManageExams, setLoadingManageExams] = useState(false);
  const [loadingMyExams, setLoadingMyExams] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);

  const [manageExamsError, setManageExamsError] = useState<string | null>(null);
  const [myExamsError, setMyExamsError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<TrainingFolderDto | null>(null);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [loadingExamActionId, setLoadingExamActionId] = useState<number | null>(null);
  const [changeOwnerExam, setChangeOwnerExam] = useState<TrainingExamDto | null>(null);
  const [moveTarget, setMoveTarget] = useState<TrainingMoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [archiveDeleteTarget, setArchiveDeleteTarget] = useState<ArchivedTrainingObject | null>(null);
  const [archiveActionLoading, setArchiveActionLoading] = useState<string | null>(null);
  const [folderActionLoadingId, setFolderActionLoadingId] = useState<number | null>(null);
  const [employeePositionFilter, setEmployeePositionFilter] = useState<number | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [debouncedEmployeeSearch, setDebouncedEmployeeSearch] = useState("");

  const positionFilter = Number(searchParams.get("position") ?? "0") || null;

  useEffect(() => {
    if (!searchParams.has("includeInactive")) return;
    const updated = new URLSearchParams(searchParams);
    updated.delete("includeInactive");
    setSearchParams(updated, { replace: true });
  }, [searchParams, setSearchParams]);

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

  const showMySection = !restaurantAccess.isCreator;
  const showManageSection = canManage;
  const showEmployeeStatsSection = canManage;

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      setDebouncedEmployeeSearch(employeeSearch);
    }, 350);

    return () => clearTimeout(timeoutId);
  }, [employeeSearch]);

  const loadManageExams = useCallback(async () => {
    if (!restaurantId || !showManageSection) {
      setManageExams([]);
      return;
    }

    setLoadingManageExams(true);
    setManageExamsError(null);
    try {
      const response = await listExams(restaurantId, true, true);
      setManageExams(response);
    } catch (error) {
      setManageExamsError(getTrainingErrorMessage(error, "Не удалось загрузить управляемые аттестации."));
    } finally {
      setLoadingManageExams(false);
    }
  }, [restaurantId, showManageSection]);

  const loadMyExams = useCallback(async () => {
    if (!restaurantId || !showMySection) {
      setMyExams([]);
      return;
    }

    setLoadingMyExams(true);
    setMyExamsError(null);
    try {
      const response = await listMyCertificationExams(restaurantId);
      setMyExams(response);
    } catch (error) {
      setMyExamsError(getTrainingErrorMessage(error, "Не удалось загрузить мои аттестации."));
    } finally {
      setLoadingMyExams(false);
    }
  }, [restaurantId, showMySection]);

  const loadPositions = useCallback(async () => {
    if (!restaurantId || !showManageSection) {
      setPositions([]);
      return;
    }

    setLoadingPositions(true);
    setPositionsError(null);
    try {
      const response = await listPositions(restaurantId, { includeInactive: false });
      setPositions(response);
    } catch (error) {
      setPositionsError(getTrainingErrorMessage(error, "Не удалось загрузить должности."));
    } finally {
      setLoadingPositions(false);
    }
  }, [restaurantId, showManageSection]);

  useEffect(() => {
    void loadManageExams();
  }, [loadManageExams]);

  useEffect(() => {
    void loadMyExams();
  }, [loadMyExams]);

  useEffect(() => {
    void loadPositions();
  }, [loadPositions]);

  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);

  const manageablePositions = useMemo(
    () => getManageablePositions(positions, allowedAudienceRoles),
    [positions, allowedAudienceRoles],
  );

  const employeeSearchState = useCertificationEmployeeSearch(
    showEmployeeStatsSection ? restaurantId : null,
    employeePositionFilter,
    debouncedEmployeeSearch,
  );

  const manageableExams = useMemo(() => {
    if (!showManageSection) return [];

    const rootCertificationExams = manageExams.filter(
      (exam) => exam.mode === "CERTIFICATION" && exam.folderId == null && exam.active,
    );
    const byAudience = rootCertificationExams.filter((exam) =>
      examTargetsAllowedAudience(exam, positionById, allowedAudienceRoles),
    );
    const byPosition =
      positionFilter == null
        ? byAudience
        : byAudience.filter((exam) => exam.visibilityPositionIds.includes(positionFilter));

    return sortManageExams(byPosition, positionById);
  }, [showManageSection, manageExams, positionById, allowedAudienceRoles, positionFilter]);

  const rootFolders = useMemo(() => {
    const activeRootFolders = foldersState.folders.filter((folder) => folder.parentId == null && folder.active);
    const filtered =
      positionFilter == null
        ? activeRootFolders
        : activeRootFolders.filter(
            (folder) =>
              folder.visibilityPositionIds.length === 0 || folder.visibilityPositionIds.includes(positionFilter),
          );
    return filtered.sort(bySortOrderAndName);
  }, [foldersState.folders, positionFilter]);
  const hiddenRootFolders = useMemo(
    () => foldersState.folders.filter((folder) => folder.parentId == null && !folder.active),
    [foldersState.folders],
  );
  const hiddenRootExams = useMemo(
    () => manageExams.filter((exam) => exam.mode === "CERTIFICATION" && exam.folderId == null && !exam.active),
    [manageExams],
  );
  const folderMap = useMemo(
    () => new Map(foldersState.folders.map((folder) => [folder.id, folder])),
    [foldersState.folders],
  );

  const openFolder = (folderId: number) => navigate(trainingRoutes.certificationFolder(folderId));
  const handleFolderKeyDown = (event: KeyboardEvent<HTMLElement>, folderId: number) => {
    if (event.key === "Enter") {
      event.preventDefault();
      openFolder(folderId);
    }
  };

  const updateQuery = (next: { position?: number | null }) => {
    const updated = new URLSearchParams(searchParams);

    if (next.position !== undefined) {
      if (next.position == null) updated.delete("position");
      else updated.set("position", String(next.position));
    }

    setSearchParams(updated, { replace: true });
  };

  const reloadRootContents = async () => {
    await Promise.all([foldersState.reload(), loadManageExams()]);
  };

  const handleHideFolder = async (folder: TrainingFolderDto) => {
    setFolderActionLoadingId(folder.id);
    setManageExamsError(null);
    try {
      await foldersState.hide(folder.id);
      await loadManageExams();
    } catch (error) {
      setManageExamsError(getTrainingErrorMessage(error, "Не удалось скрыть папку."));
    } finally {
      setFolderActionLoadingId(null);
    }
  };

  const submitMove = async (targetFolderId: number | null) => {
    if (!restaurantId || !moveTarget) return;
    setMoveSubmitting(true);
    setMoveError(null);
    try {
      if (moveTarget.kind === "folder") await moveFolder(restaurantId, moveTarget.id, { parentId: targetFolderId });
      else if (moveTarget.kind === "certificationExam") {
        await moveCertificationExam(restaurantId, moveTarget.id, { folderId: targetFolderId });
      }
      setMoveTarget(null);
      await reloadRootContents();
    } catch (error) {
      setMoveError(getTrainingErrorMessage(error, "Не удалось переместить."));
    } finally {
      setMoveSubmitting(false);
    }
  };

  const restoreArchivedObject = async (object: ArchivedTrainingObject) => {
    if (!restaurantId) return;
    setArchiveActionLoading(`restore-${object.kind}-${object.id}`);
    setManageExamsError(null);
    try {
      if (object.kind === "folder") await foldersState.restore(object.id);
      else if (object.kind === "certificationExam") await restoreExam(restaurantId, object.id);
      await reloadRootContents();
    } catch (error) {
      setManageExamsError(getTrainingErrorMessage(error, "Не удалось восстановить объект."));
    } finally {
      setArchiveActionLoading(null);
    }
  };

  const deleteArchivedObject = async () => {
    if (!restaurantId || !archiveDeleteTarget) return;
    const target = archiveDeleteTarget;
    setArchiveActionLoading(`delete-${target.kind}-${target.id}`);
    setManageExamsError(null);
    try {
      if (target.kind === "folder") await deleteFolder(restaurantId, target.id);
      else if (target.kind === "certificationExam") await deleteExam(restaurantId, target.id);
      setArchiveDeleteTarget(null);
      await reloadRootContents();
    } catch (error) {
      setManageExamsError(getTrainingErrorMessage(error, "Не удалось удалить объект."));
    } finally {
      setArchiveActionLoading(null);
    }
  };

  const runExamAction = async (examId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setLoadingExamActionId(examId);
    setManageExamsError(null);
    try {
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await loadManageExams();
    } catch (error) {
      setManageExamsError(getTrainingErrorMessage(error, "Не удалось выполнить действие с аттестацией."));
    } finally {
      setLoadingExamActionId(null);
    }
  };

  const examsReturnTo = buildTrainingExamsReturnTo(trainingRoutes.exams, location.search);

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>

      {showMySection && (
        <section className="border-subtle bg-surface space-y-3 rounded-2xl border p-4">
          <h3 className="text-lg font-semibold">Мои аттестации</h3>
          {loadingMyExams && <LoadingState label="Загрузка моих аттестаций..." />}
          {myExamsError && <ErrorState message={myExamsError} onRetry={loadMyExams} />}

          {!loadingMyExams &&
            !myExamsError &&
            (myExams.length === 0 ? (
              <div className="text-muted text-sm">Пока для вас аттестаций нет</div>
            ) : (
              <div className="space-y-3">
                {myExams.map((exam) => (
                  <CertificationMyExamCard key={exam.assignmentId} exam={exam} />
                ))}
              </div>
            ))}
        </section>
      )}

      {showManageSection && (
        <section className="border-subtle bg-surface space-y-4 rounded-2xl border p-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
            <h3 className="text-lg font-semibold text-balance">Управление аттестациями</h3>
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
              <Button
                variant="outline"
                leftIcon={<Plus className="h-4 w-4" />}
                onClick={() => {
                  setEditingExam(null);
                  setModalOpen(true);
                }}
              >
                Создать аттестацию
              </Button>
            </div>
          </div>

          <div className="min-w-0 md:max-w-xl">
            <SelectField
              label="Должность"
              value={positionFilter ?? ""}
              onChange={(event) =>
                updateQuery({ position: event.target.value === "" ? null : Number(event.target.value) })
              }
            >
              <option value="">Все должности</option>
              {manageablePositions.map((position) => (
                <option key={position.id} value={position.id}>
                  {position.name}
                </option>
              ))}
            </SelectField>
          </div>

          {loadingManageExams && <LoadingState label="Загрузка управляемых аттестаций..." />}
          {foldersState.loading && <LoadingState label="Загрузка папок..." />}
          {manageExamsError && <ErrorState message={manageExamsError} onRetry={loadManageExams} />}
          {foldersState.error && <ErrorState message={foldersState.error} onRetry={foldersState.reload} />}
          {positionsError && <ErrorState message={positionsError} onRetry={loadPositions} />}
          {loadingPositions && <LoadingState label="Загрузка должностей..." />}

          {!loadingManageExams &&
            !foldersState.loading &&
            !loadingPositions &&
            !manageExamsError &&
            !foldersState.error &&
            !positionsError && (
              <div className="space-y-6">
                <section className="space-y-3">
                  <h4 className="text-lg font-semibold">Папки</h4>
                  {rootFolders.length > 0 && (
                    <div className="space-y-3" role="list">
                      {rootFolders.map((folder) => (
                        <Card
                          key={folder.id}
                          role="link"
                          tabIndex={0}
                          className="cursor-pointer rounded-2xl p-4 transition hover:bg-[var(--staffly-control-hover)] focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)] focus-visible:outline-none"
                          onClick={() => openFolder(folder.id)}
                          onKeyDown={(event) => handleFolderKeyDown(event, folder.id)}
                        >
                          <div className="flex items-center gap-3">
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)]">
                              <Icon icon={Folder} size="sm" decorative />
                            </span>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold [overflow-wrap:anywhere]">{folder.name}</div>
                              {folder.description && (
                                <div className="text-muted mt-1 text-sm">{folder.description}</div>
                              )}
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
                  )}
                  {rootFolders.length === 0 && (
                    <EmptyState title="Нет папок" description="Создайте папку или измените фильтр должности." />
                  )}
                </section>

                <section className="space-y-3">
                  <h4 className="text-lg font-semibold">Аттестационные тесты</h4>
                  {manageableExams.length > 0 && (
                    <div className="space-y-3">
                      {manageableExams.map((exam) => (
                        <CertificationManageExamCard
                          key={exam.id}
                          exam={exam}
                          analyticsHref={withReturnToParam(trainingRoutes.examAnalytics(exam.id), examsReturnTo)}
                          loading={loadingExamActionId === exam.id}
                          positionsById={positionById}
                          onEdit={(value) => {
                            setEditingExam(value);
                            setModalOpen(true);
                          }}
                          onChangeOwner={(value) => {
                            setChangeOwnerExam(value);
                          }}
                          onMove={(value) => {
                            setMoveError(null);
                            setMoveTarget({ kind: "certificationExam", id: value.id, title: value.title });
                          }}
                          onAction={runExamAction}
                          showDeleteAction={false}
                        />
                      ))}
                    </div>
                  )}
                  {manageableExams.length === 0 && (
                    <EmptyState
                      title="Нет аттестационных тестов"
                      description="Создайте аттестацию или измените фильтр должности."
                    />
                  )}
                </section>
              </div>
            )}
        </section>
      )}

      {showEmployeeStatsSection && (
        <CertificationEmployeeStatisticsSection
          positions={positions}
          employees={employeeSearchState.employees}
          loading={employeeSearchState.loading}
          error={employeeSearchState.error}
          positionsLoading={loadingPositions}
          positionsError={positionsError}
          allowedRoles={allowedAudienceRoles}
          positionFilter={employeePositionFilter}
          search={employeeSearch}
          hasFilters={employeeSearchState.hasFilters}
          returnTo={examsReturnTo}
          onPositionFilterChange={setEmployeePositionFilter}
          onSearchChange={setEmployeeSearch}
          onRetry={() => void employeeSearchState.reload()}
          onRetryPositions={loadPositions}
        />
      )}

      {restaurantId && (
        <TrainingFolderModal
          open={folderModalOpen}
          mode="create"
          restaurantId={restaurantId}
          type="CERTIFICATION"
          parentFolder={null}
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

      {restaurantId && (
        <ExamEditorModal
          open={modalOpen}
          exam={editingExam}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          certificationAllowedAudienceRoles={allowedAudienceRoles}
          onClose={() => {
            setModalOpen(false);
            setEditingExam(null);
          }}
          onSaved={async () => {
            setModalOpen(false);
            setEditingExam(null);
            await loadManageExams();
          }}
        />
      )}

      {restaurantId && (
        <ChangeCertificationOwnerModal
          open={Boolean(changeOwnerExam)}
          exam={changeOwnerExam}
          restaurantId={restaurantId}
          onClose={() => setChangeOwnerExam(null)}
          onSaved={loadManageExams}
        />
      )}

      <TrainingMoveModal
        target={moveTarget}
        type="CERTIFICATION"
        folders={foldersState.folders}
        currentFolderId={null}
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
        emptyText="В корне нет скрытых объектов."
        folders={hiddenRootFolders}
        certificationExams={hiddenRootExams}
        loading={loadingManageExams || foldersState.loading}
        error={foldersState.error ?? manageExamsError}
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
            ? "Папка, все вложенные папки и все аттестации внутри будут удалены безвозвратно. История прохождений сотрудников сохранится."
            : "Аттестация будет удалена безвозвратно. История прохождений сотрудников сохранится."
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
