import type { CertificationExamSummaryDto } from "../../api/types";

type Props = {
  summary: CertificationExamSummaryDto;
};

export default function CertificationSummaryCards({ summary }: Props) {
  const items = [
    ["Назначено", summary.totalAssigned],
    ["Сдано", summary.passedCount],
    ["Не сдано", summary.failedCount],
    ["В процессе", summary.inProgressCount],
    ["Не начато", summary.notStartedCount],
    ["Исчерпано", summary.exhaustedCount],
  ];

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="rounded-xl border border-subtle bg-app p-3">
          <div className="text-xs text-muted">{label}</div>
          <div className="text-lg font-semibold text-default">{value}</div>
        </div>
      ))}
      <div className="rounded-xl border border-subtle bg-app p-3">
        <div className="text-xs text-muted">Средний балл</div>
        <div className="text-lg font-semibold text-default">{summary.averageScore ?? "—"}</div>
      </div>
      <div className="rounded-xl border border-subtle bg-app p-3">
        <div className="text-xs text-muted">Проходимость</div>
        <div className="text-lg font-semibold text-default">{typeof summary.passRate === "number" ? `${summary.passRate}%` : "—"}</div>
      </div>
    </div>
  );
}
