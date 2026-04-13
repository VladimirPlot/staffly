import { Plus } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { listPositions, type PositionDto } from "../../dictionaries/api";
import { resolveRestaurantAccess } from "../../../shared/utils/access";
import { useAuth } from "../../../shared/providers/AuthProvider";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import SelectField from "../../../shared/ui/SelectField";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamEditorModal from "../components/ExamEditorModal";
import LoadingState from "../components/LoadingState";
import CertificationManageExamCard from "../components/certification/CertificationManageExamCard";
import CertificationMyExamCard from "../components/certification/CertificationMyExamCard";
import { deleteExam, hideExam, listExams, restoreExam } from "../api/trainingApi";
import type { TrainingExamDto } from "../api/types";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { getTrainingErrorMessage } from "../utils/errors";
import { trainingRoutes } from "../utils/trainingRoutes";
import {
  examTargetsAllowedAudience,
  getManageableAudienceRoles,
  getManageablePositions,
  sortManageExams,
} from "../utils/certificationRoleScope";

export default function ExamsPage() {
  const { user } = useAuth();
  const { restaurantId, canManage, myRole, isTrainingExaminer } = useTrainingAccess();
  const [searchParams, setSearchParams] = useSearchParams();

  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [positions, setPositions] = useState<PositionDto[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [loadingPositions, setLoadingPositions] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [positionsError, setPositionsError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingExam, setEditingExam] = useState<TrainingExamDto | null>(null);
  const [loadingExamActionId, setLoadingExamActionId] = useState<number | null>(null);

  const includeInactive = searchParams.get("includeInactive") === "1";
  const positionFilter = Number(searchParams.get("position") ?? "0") || null;

  const restaurantAccess = resolveRestaurantAccess(user?.roles, myRole ?? undefined);
  const allowedAudienceRoles = getManageableAudienceRoles({
    isCreator: restaurantAccess.isCreator,
    isExaminer: isTrainingExaminer,
    membershipRole: myRole,
  });

  const showMySection = !restaurantAccess.isCreator && !isTrainingExaminer;
  const showManageSection = canManage;

  const loadExams = async () => {
    if (!restaurantId) {
      setExams([]);
      return;
    }

    setLoadingExams(true);
    setExamsError(null);
    try {
      const response = await listExams(restaurantId, includeInactive, true);
      setExams(response);
    } catch (error) {
      setExamsError(getTrainingErrorMessage(error, "Не удалось загрузить аттестации."));
    } finally {
      setLoadingExams(false);
    }
  };

  useEffect(() => {
    void loadExams();
  }, [restaurantId, includeInactive]);

  useEffect(() => {
    if (!restaurantId) {
      setPositions([]);
      return;
    }

    let cancelled = false;
    setLoadingPositions(true);
    setPositionsError(null);

    void (async () => {
      try {
        const response = await listPositions(restaurantId, { includeInactive: false });
        if (!cancelled) setPositions(response);
      } catch (error) {
        if (!cancelled) setPositionsError(getTrainingErrorMessage(error, "Не удалось загрузить должности."));
      } finally {
        if (!cancelled) setLoadingPositions(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [restaurantId]);

  const positionById = useMemo(() => new Map(positions.map((position) => [position.id, position])), [positions]);

  const myExams = useMemo(() => {
    if (!showMySection) return [];

    const all = exams.filter((exam) => exam.active);
    return [...all].sort((left, right) => right.id - left.id);
  }, [exams, showMySection]);

  const manageablePositions = useMemo(
    () => getManageablePositions(positions, allowedAudienceRoles),
    [positions, allowedAudienceRoles],
  );

  const manageableExams = useMemo(() => {
    if (!showManageSection) return [];

    const byAudience = exams.filter((exam) => examTargetsAllowedAudience(exam, positionById, allowedAudienceRoles));
    const byPosition = positionFilter == null ? byAudience : byAudience.filter((exam) => exam.visibilityPositionIds.includes(positionFilter));

    return sortManageExams(byPosition, positionById);
  }, [showManageSection, exams, positionById, allowedAudienceRoles, positionFilter]);

  const updateQuery = (next: { includeInactive?: boolean; position?: number | null }) => {
    const updated = new URLSearchParams(searchParams);

    if (typeof next.includeInactive === "boolean") {
      if (next.includeInactive) updated.set("includeInactive", "1");
      else updated.delete("includeInactive");
    }

    if (next.position !== undefined) {
      if (next.position == null) updated.delete("position");
      else updated.set("position", String(next.position));
    }

    setSearchParams(updated, { replace: true });
  };

  const runExamAction = async (examId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setLoadingExamActionId(examId);
    setExamsError(null);
    try {
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await loadExams();
    } catch (error) {
      setExamsError(getTrainingErrorMessage(error, "Не удалось выполнить действие с аттестацией."));
    } finally {
      setLoadingExamActionId(null);
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>

      {(loadingExams || loadingPositions) && <LoadingState label="Загрузка аттестаций..." />}
      {examsError && <ErrorState message={examsError} onRetry={loadExams} />}
      {positionsError && <ErrorState message={positionsError} onRetry={() => window.location.reload()} />}

      {showMySection && !loadingExams && (
        <section className="space-y-3 rounded-2xl border border-subtle bg-surface p-4">
          <h3 className="text-lg font-semibold">Мои аттестации</h3>
          {myExams.length === 0 ? (
            <div className="text-sm text-muted">Пока для вас аттестаций нет</div>
          ) : (
            <div className="space-y-3">
              {myExams.map((exam) => (
                <CertificationMyExamCard key={exam.id} exam={exam} />
              ))}
            </div>
          )}
        </section>
      )}

      {showManageSection && !loadingExams && (
        <section className="space-y-3 rounded-2xl border border-subtle bg-surface p-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h3 className="text-lg font-semibold">Управление аттестациями</h3>
            <Button variant="outline" onClick={() => { setEditingExam(null); setModalOpen(true); }}>
              <Plus className="mr-2 h-4 w-4" />Создать аттестацию
            </Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <SelectField label="Должность" value={positionFilter ?? ""} onChange={(event) => updateQuery({ position: event.target.value === "" ? null : Number(event.target.value) })}>
              <option value="">Все должности</option>
              {manageablePositions.map((position) => (
                <option key={position.id} value={position.id}>{position.name}</option>
              ))}
            </SelectField>
            <div className="pt-6">
              <Switch label="Показать скрытые" checked={includeInactive} onChange={(event) => updateQuery({ includeInactive: event.target.checked })} />
            </div>
          </div>

          {manageableExams.length === 0 ? (
            <EmptyState title="Нет управляемых аттестаций" description="Создайте первую аттестацию или измените фильтры." />
          ) : (
            <div className="space-y-3">
              {manageableExams.map((exam) => (
                <CertificationManageExamCard
                  key={exam.id}
                  exam={exam}
                  loading={loadingExamActionId === exam.id}
                  positionsById={positionById}
                  onEdit={(value) => {
                    setEditingExam(value);
                    setModalOpen(true);
                  }}
                  onAction={runExamAction}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {restaurantId && (
        <ExamEditorModal
          open={modalOpen}
          exam={editingExam}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          onClose={() => {
            setModalOpen(false);
            setEditingExam(null);
          }}
          onSaved={async () => {
            setModalOpen(false);
            setEditingExam(null);
            await loadExams();
          }}
        />
      )}
    </div>
  );
}
