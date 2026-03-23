type Props = {
  mode: "PRACTICE" | "CERTIFICATION";
  availabilityLabel: string;
  sourcesFolderCount: number;
  sourceQuestionCount: number;
  totalQuestions: number;
};

export default function ExamSummarySection({
  mode,
  availabilityLabel,
  sourcesFolderCount,
  sourceQuestionCount,
  totalQuestions,
}: Props) {
  return (
    <section className="rounded-2xl border border-subtle bg-app p-3">
      <div className="text-sm font-semibold text-default">Сводка</div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <div className="text-xs text-muted">Режим</div>
          <div className="text-sm text-default">{mode === "PRACTICE" ? "Учебный тест" : "Аттестация"}</div>
        </div>

        <div>
          <div className="text-xs text-muted">Доступ</div>
          <div className="text-sm text-default">{availabilityLabel}</div>
        </div>

        <div>
          <div className="text-xs text-muted">Источники</div>
          <div className="text-sm text-default">{sourcesFolderCount} папок · {sourceQuestionCount} отдельных вопросов</div>
        </div>

        <div>
          <div className="text-xs text-muted">Итого вопросов в тесте</div>
          <div className="text-sm font-semibold text-default">{totalQuestions}</div>
        </div>
      </div>
    </section>
  );
}
