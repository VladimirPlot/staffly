import Card from "../../../../shared/ui/Card";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";
import type { CertificationPositionsState } from "../../hooks/certification/types";

type Props = {
  hasSelectedExam: boolean;
  positionsState: CertificationPositionsState;
};

export default function CertificationPositionsSection({ hasSelectedExam, positionsState }: Props) {
  if (!hasSelectedExam) {
    return (
      <Card>
        <div className="text-sm text-muted">Выберите аттестацию, чтобы увидеть статистику по должностям.</div>
      </Card>
    );
  }

  return (
    <Card className="space-y-3">
      <div className="text-sm font-semibold">Статистика по должностям</div>
      {positionsState.loading && <LoadingState label="Загрузка статистики..." />}
      {positionsState.error && <ErrorState message={positionsState.error} onRetry={positionsState.reload} />}
      {!positionsState.loading && !positionsState.error && positionsState.positions.length === 0 && (
        <div className="text-sm text-muted">Нет данных по должностям.</div>
      )}
      {!positionsState.loading && positionsState.positions.length > 0 && (
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-muted">
              <tr>
                <th className="px-2 py-1 text-left">Должность</th>
                <th className="px-2 py-1 text-right">Назначено</th>
                <th className="px-2 py-1 text-right">Сдано</th>
                <th className="px-2 py-1 text-right">В процессе</th>
                <th className="px-2 py-1 text-right">Не сдано</th>
                <th className="px-2 py-1 text-right">Исчерпано</th>
                <th className="px-2 py-1 text-right">Не начато</th>
                <th className="px-2 py-1 text-right">Средний балл</th>
                <th className="px-2 py-1 text-right">% прохождения</th>
              </tr>
            </thead>
            <tbody>
              {positionsState.positions.map((position) => (
                <tr key={position.positionId} className="border-t border-subtle">
                  <td className="px-2 py-2">{position.positionName}</td>
                  <td className="px-2 py-2 text-right">{position.assignedCount}</td>
                  <td className="px-2 py-2 text-right">{position.passedCount}</td>
                  <td className="px-2 py-2 text-right">{position.inProgressCount}</td>
                  <td className="px-2 py-2 text-right">{position.failedCount}</td>
                  <td className="px-2 py-2 text-right">{position.exhaustedCount}</td>
                  <td className="px-2 py-2 text-right">{position.notStartedCount}</td>
                  <td className="px-2 py-2 text-right">{typeof position.averageScore === "number" ? `${position.averageScore}%` : "—"}</td>
                  <td className="px-2 py-2 text-right">{typeof position.passRate === "number" ? `${position.passRate}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
