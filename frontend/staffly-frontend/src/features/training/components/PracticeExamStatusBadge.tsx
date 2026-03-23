import type { PracticeExamStatus } from "../utils/practiceExamStatus";
import HiddenStatusBadge from "./common/HiddenStatusBadge";

type Props = {
  status: PracticeExamStatus;
  isHidden: boolean;
};

export default function PracticeExamStatusBadge({ status, isHidden }: Props) {
  return (
    <>
      {status === "PASSED" && (
        <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">
          Пройден
        </span>
      )}
      {status === "FAILED" && (
        <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">
          Не пройден
        </span>
      )}
      {status === "IN_PROGRESS" && (
        <span className="rounded-full bg-sky-100 px-2 py-1 text-xs text-sky-700">
          Запущен
        </span>
      )}
      {isHidden && <HiddenStatusBadge />}
    </>
  );
}
