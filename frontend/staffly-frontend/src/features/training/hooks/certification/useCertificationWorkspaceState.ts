import { useCallback, useEffect, useMemo, useState } from "react";
import { mapExamsForUi } from "../../api/mappers";
import { deleteExam, hideExam, listExams, restoreExam } from "../../api/trainingApi";
import type { CertificationAssignmentStatus, TrainingExamDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import { useCertificationEmployeeAttempts } from "./useCertificationEmployeeAttempts";
import { useCertificationExamEmployees } from "./useCertificationExamEmployees";
import { useCertificationExamPositions } from "./useCertificationExamPositions";
import { useCertificationExamSummary } from "./useCertificationExamSummary";
import { useCertificationManagerActions } from "./useCertificationManagerActions";

type Params = {
  restaurantId: number | null;
  canManage: boolean;
};

export type CertificationStatusFilter = "ALL" | CertificationAssignmentStatus;

export function useCertificationWorkspaceState({ restaurantId, canManage }: Params) {
  const [includeInactive, setIncludeInactive] = useState(false);
  const [exams, setExams] = useState<TrainingExamDto[]>([]);
  const [loadingExams, setLoadingExams] = useState(false);
  const [examsError, setExamsError] = useState<string | null>(null);
  const [selectedExamId, setSelectedExamId] = useState<number | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [statusFilter, setStatusFilter] = useState<CertificationStatusFilter>("ALL");
  const [search, setSearch] = useState("");
  const [selectedEmployeeUserId, setSelectedEmployeeUserId] = useState<number | null>(null);
  const [loadingExamActionId, setLoadingExamActionId] = useState<number | null>(null);

  const selectedExam = useMemo(() => exams.find((exam) => exam.id === selectedExamId) ?? null, [exams, selectedExamId]);

  const loadExams = useCallback(async () => {
    if (!restaurantId) {
      setExams([]);
      setSelectedExamId(null);
      return;
    }

    setLoadingExams(true);
    setExamsError(null);
    try {
      const response = await listExams(restaurantId, canManage ? includeInactive : false, true);
      const normalized = mapExamsForUi(response);
      setExams(normalized);
      setSelectedExamId((current) => {
        if (current && normalized.some((exam) => exam.id === current)) return current;
        return normalized[0]?.id ?? null;
      });
    } catch (e) {
      setExamsError(getTrainingErrorMessage(e, "Не удалось загрузить аттестации."));
    } finally {
      setLoadingExams(false);
    }
  }, [restaurantId, canManage, includeInactive]);

  useEffect(() => {
    void loadExams();
  }, [loadExams]);

  const summaryState = useCertificationExamSummary(restaurantId, selectedExamId);
  const positionsState = useCertificationExamPositions(restaurantId, selectedExamId);
  const employeesState = useCertificationExamEmployees(restaurantId, selectedExamId, statusFilter, search);
  const attemptsState = useCertificationEmployeeAttempts(restaurantId, selectedExamId, selectedEmployeeUserId);

  const { reload: reloadSummary } = summaryState;
  const { reload: reloadPositions } = positionsState;
  const { reload: reloadEmployees } = employeesState;
  const { load: loadAttempts } = attemptsState;

  const refreshWorkspace = useCallback(async () => {
    await Promise.all([
      reloadSummary(),
      reloadPositions(),
      reloadEmployees(),
      loadAttempts(),
      loadExams(),
    ]);
  }, [reloadSummary, reloadPositions, reloadEmployees, loadAttempts, loadExams]);

  const managerActions = useCertificationManagerActions(restaurantId, selectedExamId, refreshWorkspace);

  const runExamAction = useCallback(async (examId: number, action: "hide" | "restore" | "delete") => {
    if (!restaurantId) return;
    setLoadingExamActionId(examId);
    setExamsError(null);
    try {
      if (action === "hide") await hideExam(restaurantId, examId);
      else if (action === "restore") await restoreExam(restaurantId, examId);
      else await deleteExam(restaurantId, examId);
      await loadExams();
    } catch (e) {
      setExamsError(getTrainingErrorMessage(e, "Не удалось выполнить действие с аттестацией."));
    } finally {
      setLoadingExamActionId(null);
    }
  }, [restaurantId, loadExams]);

  const selectedEmployeeFullName = useMemo(
    () => employeesState.employees.find((employee) => employee.userId === selectedEmployeeUserId)?.fullName ?? null,
    [employeesState.employees, selectedEmployeeUserId],
  );

  const selectExam = useCallback((examId: number) => {
    setSelectedExamId(examId);
    setSelectedEmployeeUserId(null);
  }, []);

  const handleEditorSaved = useCallback(async () => {
    await loadExams();
  }, [loadExams]);

  return {
    includeInactive,
    setIncludeInactive,
    exams,
    loadingExams,
    examsError,
    selectedExamId,
    selectedExam,
    modalOpen,
    setModalOpen,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    selectedEmployeeUserId,
    setSelectedEmployeeUserId,
    loadingExamActionId,
    loadExams,
    runExamAction,
    summaryState,
    positionsState,
    employeesState,
    attemptsState,
    managerActions,
    selectedEmployeeFullName,
    selectExam,
    handleEditorSaved,
  };
}
