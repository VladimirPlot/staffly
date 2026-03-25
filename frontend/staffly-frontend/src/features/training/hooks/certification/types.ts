import type {
  CertificationAssignmentStatus,
  CertificationExamAttemptHistoryDto,
  CertificationExamEmployeeRowDto,
  CertificationExamPositionBreakdownDto,
  CertificationExamSummaryDto,
} from "../../api/types";

export type CertificationStatusFilter = "ALL" | CertificationAssignmentStatus;

type AsyncBaseState = {
  loading: boolean;
  error: string | null;
};

type AsyncReloadState = {
  reload: () => Promise<void>;
};

export type CertificationSummaryState = AsyncBaseState & AsyncReloadState & {
  summary: CertificationExamSummaryDto | null;
};

export type CertificationPositionsState = AsyncBaseState & AsyncReloadState & {
  positions: CertificationExamPositionBreakdownDto[];
};

export type CertificationEmployeesState = AsyncBaseState & AsyncReloadState & {
  employees: CertificationExamEmployeeRowDto[];
};

export type CertificationEmployeeAttemptsState = AsyncBaseState & {
  attempts: CertificationExamAttemptHistoryDto[];
  load: () => Promise<void>;
};

export type CertificationManagerActionsState = {
  loadingActionKey: string | null;
  error: string | null;
  resetExamCycle: () => Promise<void>;
  resetEmployee: (userId: number) => Promise<void>;
  grantEmployeeAttempt: (userId: number, amount?: number) => Promise<void>;
};
