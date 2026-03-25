import type { CertificationAssignmentStatus } from "../api/types";

export function getCertificationAssignmentStatusLabel(status: CertificationAssignmentStatus) {
  if (status === "ASSIGNED") return "Не начато";
  if (status === "IN_PROGRESS") return "В процессе";
  if (status === "PASSED") return "Сдано";
  if (status === "FAILED") return "Не сдано";
  if (status === "EXHAUSTED") return "Лимит исчерпан";
  return "Архив";
}
