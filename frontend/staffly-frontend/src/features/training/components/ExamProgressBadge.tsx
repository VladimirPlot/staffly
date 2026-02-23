import type { ExamProgressDto } from "../api/types";

type Props = {
  progress?: ExamProgressDto;
};

export default function ExamProgressBadge({ progress }: Props) {
  if (!progress) {
    return <span className="rounded-full bg-zinc-100 px-2 py-1 text-xs text-zinc-700">Не проходили</span>;
  }

  if (progress.passed) {
    return <span className="rounded-full bg-emerald-100 px-2 py-1 text-xs text-emerald-700">Сдано</span>;
  }

  return <span className="rounded-full bg-amber-100 px-2 py-1 text-xs text-amber-700">Не сдано</span>;
}
