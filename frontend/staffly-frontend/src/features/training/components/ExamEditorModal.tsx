import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ExamEditorForm from "./examEditor/ExamEditorForm";
import { useExamEditorState } from "./examEditor/useExamEditorState";
import type { ExamEditorProps } from "./examEditor/types";
import { useTrainingEditorGuard } from "../hooks/useTrainingEditorGuard";
import ErrorState from "./ErrorState";
import LoadingState from "./LoadingState";

export default function ExamEditorModal(props: ExamEditorProps) {
  const state = useExamEditorState(props);
  const guard = useTrainingEditorGuard(props.open, state.saving, props.onClose);
  const title = props.exam
    ? props.mode === "PRACTICE"
      ? "Редактировать тест"
      : "Редактировать аттестацию"
    : props.mode === "PRACTICE"
      ? "Создать тест"
      : "Создать аттестацию";
  const submitLabel = props.exam ? "Сохранить" : props.mode === "PRACTICE" ? "Создать тест" : "Создать аттестацию";

  const currentVersion = state.newCycleConfirmation?.metadata.currentVersion;
  const proposedVersion = state.newCycleConfirmation?.metadata.proposedVersion;

  return (
    <>
      <Modal
        className="lg:max-w-5xl"
        open={props.open}
        onClose={guard.requestClose}
        title={title}
        footer={
          <>
            <Button variant="outline" onClick={guard.requestClose} disabled={state.saving}>
              Отмена
            </Button>
            {state.staleConflict ? (
              <Button onClick={state.refreshAfterConflict}>Обновить</Button>
            ) : (
              <Button
                onClick={state.submit}
                isLoading={state.saving}
                disabled={
                  state.positionsLoading ||
                  Boolean(state.positionsError) ||
                  (!state.sourcesReadOnly && (state.treeLoading || Boolean(state.treeError)))
                }
              >
                {submitLabel}
              </Button>
            )}
          </>
        }
      >
        {state.positionsLoading && <LoadingState label="Загружаем должности…" />}
        {!state.positionsLoading && state.positionsError && (
          <ErrorState message={state.positionsError} onRetry={state.retryEditorData} />
        )}
        <fieldset disabled={state.saving} className="min-w-0" onChangeCapture={guard.markDirty}>
          {props.exam && props.mode === "CERTIFICATION" && (
            <div className="border-subtle mb-4 space-y-2 rounded-xl border p-3 text-sm">
              <p>
                Опубликованная версия {props.exam.version}: {props.exam.questionCount} вопросов. Переносы и изменения в
                банке не меняют её состав.
              </p>
              {state.sourcesReadOnly ? (
                <Button
                  variant="outline"
                  onClick={() => {
                    guard.markDirty();
                    state.enableQuestionBankRefresh();
                  }}
                >
                  Обновить вопросы из банка
                </Button>
              ) : (
                <>
                  <p>
                    Вы выбираете актуальные вопросы для новой версии. До подтверждения сохранения опубликованная
                    аттестация продолжает работать.
                  </p>
                  <Button variant="outline" onClick={state.keepPublishedSources}>
                    Оставить опубликованные вопросы
                  </Button>
                </>
              )}
            </div>
          )}
          <ExamEditorForm
            sourcesReadOnly={state.sourcesReadOnly}
            publishedVersion={props.mode === "CERTIFICATION" ? props.exam?.version : undefined}
            publishedQuestionCount={props.mode === "CERTIFICATION" ? props.exam?.questionCount : undefined}
            onUpdateFolderScope={state.updateFolderScope}
            treeLoading={state.treeLoading}
            treeError={state.treeError}
            questionsLoading={state.questionsLoading}
            questionsError={state.questionsError}
            onRetryTree={state.retryEditorData}
            onRetryQuestions={state.retryQuestions}
            mode={props.mode}
            title={state.form.title}
            description={state.form.description}
            passPercent={state.form.passPercent}
            timeLimitSec={state.form.timeLimitSec}
            attemptLimit={state.form.attemptLimit}
            positions={state.positions}
            manageablePositionIds={state.manageablePositionIds}
            visibilityPositionIds={state.form.visibilityPositionIds}
            allPositionsSelected={state.allPositionsSelected}
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
            onSelectAllPositions={() => {
              guard.markDirty();
              state.handleSelectAllPositions();
            }}
            onTogglePosition={(positionId) => {
              if (state.saving) return;
              guard.markDirty();
              state.togglePosition(positionId);
            }}
            onSelectFolder={state.setSelectedFolderId}
            onToggleFolder={(id) => {
              guard.markDirty();
              state.toggleFolder(id);
            }}
            onUpdateFolderPickMode={state.updateFolderPickMode}
            onUpdateFolderRandomCount={state.updateFolderRandomCount}
            onQueryChange={state.setQuery}
            onToggleQuestion={(id) => {
              guard.markDirty();
              state.toggleQuestion(id);
            }}
          />
        </fieldset>

        {state.error && <div className="mt-5 text-sm text-red-600">{state.error}</div>}
      </Modal>
      {guard.discardDialog}
      <ConfirmDialog
        open={state.folderVisibilityConfirmation != null}
        title="Аудитория теста шире видимости папки"
        description={
          <div className="max-h-[40dvh] space-y-3 overflow-y-auto pr-1">
            {state.folderVisibilityConfirmation?.warnings.map((warning) => (
              <p key={warning}>{warning}</p>
            ))}
          </div>
        }
        confirmText="Сохранить"
        cancelText="Вернуться"
        confirming={state.saving}
        onCancel={state.cancelFolderVisibilityConfirmation}
        onConfirm={state.confirmFolderVisibility}
      />
      <ConfirmDialog
        open={state.newCycleConfirmation != null}
        title="Создать новую версию аттестации?"
        description={
          <div className="space-y-2">
            <p>Изменения создадут новую версию аттестации.</p>
            <p>
              {state.newCycleConfirmation?.payload.refreshQuestionBank
                ? "Актуальные вопросы и правильные ответы из банка будут зафиксированы в новой версии."
                : "Состав вопросов и правильные ответы сохранятся из опубликованной версии. Новая версия применит изменения правил."}
            </p>
            <label className="flex items-start gap-2">
              <input
                type="checkbox"
                checked={state.requireRecertification}
                disabled={state.saving}
                onChange={(event) => state.setRequireRecertification(event.target.checked)}
                className="mt-1"
              />
              <span>Назначить повторное прохождение всем сотрудникам</span>
            </label>
            {state.requireRecertification ? (
              <p>
                Все сотрудники получат новое назначение, включая уже прошедших аттестацию. Прошлые результаты сохранятся
                в истории; начатые попытки останутся в прежнем назначении и не заменят новое прохождение.
              </p>
            ) : (
              <>
                <p>Результаты уже прошедших сохранятся. Начатые попытки можно будет завершить по прежней версии.</p>
                <p>
                  Сотрудники, которые ещё не начали или завершили попытки неуспешно и сейчас не проходят тест, перейдут
                  на новую версию.
                </p>
              </>
            )}
            {typeof currentVersion === "number" && typeof proposedVersion === "number" && (
              <p className="text-slate-500">
                Версия {currentVersion} → {proposedVersion}
              </p>
            )}
          </div>
        }
        cancelText="Отмена"
        confirmText="Создать версию"
        confirming={state.saving}
        onCancel={state.cancelNewCycleConfirmation}
        onConfirm={state.confirmNewVersion}
      />
    </>
  );
}
