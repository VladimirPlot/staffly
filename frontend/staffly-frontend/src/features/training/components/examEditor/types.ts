import type {
  ExamSourceFolderDto,
  QuestionBankTreeNodeDto,
  TrainingExamDto,
  TrainingExamMode,
  TrainingQuestionDto,
} from "../../api/types";
import type { PositionDto } from "../../../dictionaries/api";
import type { RestaurantRole } from "../../../../shared/types/restaurant";

export type ExamEditorProps = {
  open: boolean;
  restaurantId: number;
  mode: TrainingExamMode;
  exam?: TrainingExamDto | null;
  knowledgeFolderId?: number | null;
  initialFolderId?: number | null;
  certificationAllowedAudienceRoles?: RestaurantRole[];
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export type FlatTreeNode = {
  id: number;
  name: string;
  questionCount: number;
  parentId: number | null;
};

export type ExamEditorFormState = {
  title: string;
  description: string;
  passPercent: number;
  timeLimitSec: number | "";
  attemptLimit: number | "";
  visibilityPositionIds: number[];
  sourcesFolders: ExamSourceFolderDto[];
  sourceQuestionIds: number[];
  selectedFolderId: number | null;
  folderQuestions: TrainingQuestionDto[];
  query: string;
};

export type ExamEditorDataState = {
  tree: QuestionBankTreeNodeDto[];
  positions: PositionDto[];
  error: string | null;
  saving: boolean;
  positionMenuOpen: boolean;
  isDesktop: boolean;
};
