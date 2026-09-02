import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ExamEditorForm from "./examEditor/ExamEditorForm";
import { useExamEditorState } from "./examEditor/useExamEditorState";
import type { ExamEditorProps } from "./examEditor/types";

export default function ExamEditorModal(props: ExamEditorProps) {
  const state = useExamEditorState(props);
  const title = props.mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию";
  const submitLabel = props.exam ? "Сохранить" : props.mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию";

  const currentVersion = state.newCycleConfirmation?.metadata.currentVersion;
  const proposedVersion = state.newCycleConfirmation?.metadata.proposedVersion;

  return (
    <>
      <Modal
        open={props.open}
        onClose={props.onClose}
        title={title}
        footer={
          <>
            <Button variant="outline" onClick={props.onClose}>
              Отмена
            </Button>
            {state.staleConflict ? (
              <Button onClick={state.refreshAfterConflict}>Обновить</Button>
            ) : (
              <Button onClick={state.submit} isLoading={state.saving}>
                {submitLabel}
              </Button>
            )}
          </>
        }
      >
        <ExamEditorForm
          mode={props.mode}
          title={state.form.title}
          description={state.form.description}
          passPercent={state.form.passPercent}
          timeLimitSec={state.form.timeLimitSec}
          attemptLimit={state.form.attemptLimit}
          positions={state.positions}
          manageablePositionIds={state.manageablePositionIds}
          visibilityPositionIds={state.form.visibilityPositionIds}
          availabilityLabel={state.availabilityLabel}
          positionMenuOpen={state.positionMenuOpen}
          tree={state.tree}
          selectedFolderId={state.form.selectedFolderId}
          folderQuestions={state.form.folderQuestions}
          folderSourceMap={state.folderSourceMap}
          folderMetaMap={state.folderMetaMap}
          query={state.form.query}
          sourceQuestionIds={state.form.sourceQuestionIds}
          totalQuestions={state.totalQuestions}
          sourceIssues={state.sourceIssues}
          sourcePreflightLoading={state.sourcePreflightLoading}
          onTitleChange={state.setTitle}
          onDescriptionChange={state.setDescription}
          onPassPercentChange={state.setPassPercent}
          onTimeLimitChange={state.setTimeLimitSec}
          onAttemptLimitChange={state.setAttemptLimit}
          onToggleMenu={() => state.setPositionMenuOpen(!state.positionMenuOpen)}
          onSelectAllPositions={state.handleSelectAllPositions}
          onTogglePosition={state.togglePosition}
          onSelectFolder={state.setSelectedFolderId}
          onToggleFolder={state.toggleFolder}
          onUpdateFolderPickMode={state.updateFolderPickMode}
          onUpdateFolderRandomCount={state.updateFolderRandomCount}
          onQueryChange={state.setQuery}
          onToggleQuestion={state.toggleQuestion}
        />

        {state.error && <div className="mt-5 text-sm text-red-600">{state.error}</div>}
      </Modal>
      <ConfirmDialog
        open={state.newCycleConfirmation != null}
        title="Создать новую версию аттестации?"
        description={
          <div className="space-y-2">
            <p>Изменения создадут новую версию аттестации.</p>
            <p>Результаты сотрудников, которые уже прошли тест, сохранятся.</p>
            <p>Сотрудники, которые ещё не начали тест или завершили попытки неуспешно и сейчас не проходят тест, будут переведены на новую версию.</p>
            <p>Уже начатые попытки можно будет завершить.</p>
            {typeof currentVersion === "number" && typeof proposedVersion === "number" && (
              <p className="text-slate-500">
                Версия {currentVersion} → {proposedVersion}
              </p>
            )}
          </div>
        }
        cancelText="Отмена"
        confirmText="Создать новую версию и сохранить"
        confirming={state.saving}
        onCancel={state.cancelNewCycleConfirmation}
        onConfirm={state.confirmNewVersion}
      />
    </>
  );
}
