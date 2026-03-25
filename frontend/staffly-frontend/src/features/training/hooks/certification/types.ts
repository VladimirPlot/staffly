import type {
  CertificationAssignmentStatus,
  CertificationExamAttemptHistoryDto,
  CertificationExamEmployeeRowDto,
  CertificationExamPositionBreakdownDto,
  CertificationExamSummaryDto,
} from "../../api/types";

export type CertificationStatusFilter = "ALL" | CertificationAssignmentStatus;

export type CertificationSummaryState = {
  summary: CertificationExamSummaryDto | null;
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export type CertificationPositionsState = {
  positions: CertificationExamPositionBreakdownDto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export type CertificationEmployeesState = {
  employees: CertificationExamEmployeeRowDto[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
};

export type CertificationEmployeeAttemptsState = {
  attempts: CertificationExamAttemptHistoryDto[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
};

export type CertificationManagerActionsState = {
  loadingActionKey: string | null;
  error: string | null;
  resetExamCycle: () => Promise<void>;
  resetEmployee: (userId: number) => Promise<void>;
  grantEmployeeAttempt: (userId: number, amount?: number) => Promise<void>;
};
