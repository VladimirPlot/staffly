import { Plus } from "lucide-react";
import Breadcrumbs from "../../../shared/ui/Breadcrumbs";
import Button from "../../../shared/ui/Button";
import Switch from "../../../shared/ui/Switch";
import EmptyState from "../components/EmptyState";
import ErrorState from "../components/ErrorState";
import ExamEditorModal from "../components/ExamEditorModal";
import LoadingState from "../components/LoadingState";
import CertificationAttemptsSection from "../components/certification/CertificationAttemptsSection";
import CertificationEmployeesSection from "../components/certification/CertificationEmployeesSection";
import CertificationExamSidebar from "../components/certification/CertificationExamSidebar";
import CertificationOverviewSection from "../components/certification/CertificationOverviewSection";
import CertificationPositionsSection from "../components/certification/CertificationPositionsSection";
import { useCertificationWorkspaceState } from "../hooks/certification/useCertificationWorkspaceState";
import { useTrainingAccess } from "../hooks/useTrainingAccess";
import { trainingRoutes } from "../utils/trainingRoutes";

export default function ExamsPage() {
  const { restaurantId, canManage } = useTrainingAccess();
  const workspace = useCertificationWorkspaceState({ restaurantId, canManage });

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <Breadcrumbs items={[{ label: "Тренинг", to: trainingRoutes.landing }, { label: "Аттестации" }]} />
      <h2 className="text-2xl font-semibold">Аттестации</h2>

      {canManage && (
        <div className="border-subtle bg-surface rounded-2xl border p-3 flex items-center justify-between gap-3">
          <Switch label="Скрытые элементы" checked={workspace.includeInactive} onChange={(event) => workspace.setIncludeInactive(event.target.checked)} />
          <Button variant="outline" onClick={() => workspace.setModalOpen(true)}><Plus className="mr-2 h-4 w-4" />Создать аттестацию</Button>
        </div>
      )}

      {workspace.loadingExams && <LoadingState label="Загрузка аттестаций..." />}
      {workspace.examsError && <ErrorState message={workspace.examsError} onRetry={workspace.loadExams} />}
      {!workspace.loadingExams && !workspace.examsError && workspace.exams.length === 0 && (
        <EmptyState title="Нет аттестаций" description="Создайте первую аттестацию." />
      )}

      {!workspace.loadingExams && workspace.exams.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-[320px_1fr]">
          <CertificationExamSidebar
            exams={workspace.exams}
            selectedExamId={workspace.selectedExamId}
            canManage={canManage}
            loadingExamActionId={workspace.loadingExamActionId}
            onSelectExam={workspace.selectExam}
            onExamAction={workspace.runExamAction}
          />

          <div className="space-y-4">
            <CertificationOverviewSection
              canManage={canManage}
              exam={workspace.selectedExam}
              summaryState={workspace.summaryState}
              managerActions={workspace.managerActions}
            />
            <CertificationPositionsSection positionsState={workspace.positionsState} />
            <CertificationEmployeesSection
              canManage={canManage}
              employeesState={workspace.employeesState}
              managerActions={workspace.managerActions}
              statusFilter={workspace.statusFilter}
              onStatusFilterChange={workspace.setStatusFilter}
              search={workspace.search}
              onSearchChange={workspace.setSearch}
              onShowAttempts={workspace.setSelectedEmployeeUserId}
            />
            <CertificationAttemptsSection
              selectedEmployeeFullName={workspace.selectedEmployeeFullName}
              attemptsState={workspace.attemptsState}
            />
          </div>
        </div>
      )}

      {restaurantId && (
        <ExamEditorModal
          open={workspace.modalOpen}
          restaurantId={restaurantId}
          mode="CERTIFICATION"
          onClose={() => workspace.setModalOpen(false)}
          onSaved={workspace.handleEditorSaved}
        />
      )}
    </div>
  );
}
