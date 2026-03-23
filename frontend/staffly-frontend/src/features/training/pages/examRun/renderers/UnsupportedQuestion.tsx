import type { AttemptQuestionSnapshotDto } from "../../../api/types";

type Props = {
  question: AttemptQuestionSnapshotDto;
  index: number;
};

export default function UnsupportedQuestion({ question, index }: Props) {
  return (
    <div className="rounded-2xl border border-subtle bg-app p-3">
      <div className="font-medium text-default">
        {index + 1}. {question.prompt}
      </div>
      <div className="mt-1 text-sm text-amber-700">Этот тип вопроса пока не поддержан на фронте.</div>
    </div>
  );
}
