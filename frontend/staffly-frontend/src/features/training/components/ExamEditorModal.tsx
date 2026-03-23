import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import ExamEditorForm from "./examEditor/ExamEditorForm";
import { useExamEditorState } from "./examEditor/useExamEditorState";
import type { ExamEditorProps } from "./examEditor/types";

export default function ExamEditorModal(props: ExamEditorProps) {
  const state = useExamEditorState(props);
  const title = props.mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию";
  const submitLabel = props.exam
    ? "Сохранить"
    : props.mode === "PRACTICE"
      ? "Создать тест"
      : "Создать аттестацию";

  return (
    <Modal
      open={props.open}
      onClose={props.onClose}
      title={title}
      footer={
        <>
          <Button variant="outline" onClick={props.onClose}>
            Отмена
          </Button>
          <Button onClick={state.submit} isLoading={state.saving}>
            {submitLabel}
          </Button>
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
  );
}
