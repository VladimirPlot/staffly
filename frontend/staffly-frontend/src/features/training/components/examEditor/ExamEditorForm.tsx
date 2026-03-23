import type { TrainingExamMode } from "../../api/types";
import type { PositionDto } from "../../../dictionaries/api";
import ExamBasicsSection from "./sections/ExamBasicsSection";
import ExamRulesSection from "./sections/ExamRulesSection";
import ExamSourcesSection from "./sections/ExamSourcesSection";
import ExamSummarySection from "./sections/ExamSummarySection";
import ExamVisibilitySection from "./sections/ExamVisibilitySection";
import type { FlatTreeNode } from "./types";
import type { QuestionBankTreeNodeDto, TrainingQuestionDto } from "../../api/types";

type FolderSourceMap = Map<
  number,
  { folderId: number; pickMode: "ALL" | "RANDOM"; randomCount?: number | null }
>;

type Props = {
  mode: TrainingExamMode;
  title: string;
  description: string;
  passPercent: number;
  timeLimitSec: number | "";
  attemptLimit: number | "";
  positions: PositionDto[];
  visibilityPositionIds: number[];
  availabilityLabel: string;
  positionMenuOpen: boolean;
  tree: QuestionBankTreeNodeDto[];
  selectedFolderId: number | null;
  folderQuestions: TrainingQuestionDto[];
  folderSourceMap: FolderSourceMap;
  folderMetaMap: Map<number, FlatTreeNode>;
  query: string;
  sourceQuestionIds: number[];
  totalQuestions: number;
  onTitleChange: (value: string) => void;
  onDescriptionChange: (value: string) => void;
  onPassPercentChange: (value: number) => void;
  onTimeLimitChange: (value: number | "") => void;
  onAttemptLimitChange: (value: number | "") => void;
  onToggleMenu: () => void;
  onSelectAllPositions: () => void;
  onTogglePosition: (positionId: number) => void;
  onSelectFolder: (folderId: number) => void;
  onToggleFolder: (folderId: number) => void;
  onUpdateFolderPickMode: (folderId: number, value: "ALL" | "RANDOM") => void;
  onUpdateFolderRandomCount: (folderId: number, value: number) => void;
  onQueryChange: (value: string) => void;
  onToggleQuestion: (questionId: number) => void;
};

export default function ExamEditorForm(props: Props) {
  return (
    <div className="space-y-5">
      <ExamBasicsSection
        title={props.title}
        description={props.description}
        onTitleChange={props.onTitleChange}
        onDescriptionChange={props.onDescriptionChange}
      />

      <ExamRulesSection
        passPercent={props.passPercent}
        timeLimitSec={props.timeLimitSec}
        attemptLimit={props.attemptLimit}
        onPassPercentChange={props.onPassPercentChange}
        onTimeLimitChange={props.onTimeLimitChange}
        onAttemptLimitChange={props.onAttemptLimitChange}
      />

      <ExamVisibilitySection
        positions={props.positions}
        visibilityPositionIds={props.visibilityPositionIds}
        availabilityLabel={props.availabilityLabel}
        positionMenuOpen={props.positionMenuOpen}
        onToggleMenu={props.onToggleMenu}
        onSelectAll={props.onSelectAllPositions}
        onTogglePosition={props.onTogglePosition}
      />

      <ExamSourcesSection
        tree={props.tree}
        selectedFolderId={props.selectedFolderId}
        folderQuestions={props.folderQuestions}
        folderSourceMap={props.folderSourceMap}
        folderMetaMap={props.folderMetaMap}
        query={props.query}
        sourceQuestionIds={props.sourceQuestionIds}
        onSelectFolder={props.onSelectFolder}
        onToggleFolder={props.onToggleFolder}
        onUpdateFolderPickMode={props.onUpdateFolderPickMode}
        onUpdateFolderRandomCount={props.onUpdateFolderRandomCount}
        onQueryChange={props.onQueryChange}
        onToggleQuestion={props.onToggleQuestion}
      />

      <ExamSummarySection
        mode={props.mode}
        availabilityLabel={props.availabilityLabel}
        sourcesFolderCount={props.folderSourceMap.size}
        sourceQuestionCount={props.sourceQuestionIds.length}
        totalQuestions={props.totalQuestions}
      />
    </div>
  );
}
