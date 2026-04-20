import type { CertificationAnalyticsStatus, CertificationAssignmentStatus } from "../api/types";

export function mapCertificationLifecycleToAnalyticsStatus(status: CertificationAssignmentStatus): CertificationAnalyticsStatus {
  if (status === "ASSIGNED" || status === "ARCHIVED") return "NOT_STARTED";
  if (status === "IN_PROGRESS") return "IN_PROGRESS";
  if (status === "PASSED") return "PASSED";
  return "FAILED";
}

export function getCertificationAssignmentStatusLabel(status: CertificationAssignmentStatus) {
  return getCertificationAnalyticsStatusLabel(mapCertificationLifecycleToAnalyticsStatus(status));
}

export function getCertificationAnalyticsStatusLabel(status: CertificationAnalyticsStatus) {
  if (status === "NOT_STARTED") return "Не начато";
  if (status === "IN_PROGRESS") return "В процессе";
  if (status === "PASSED") return "Сдано";
  return "Не сдано";
}
