import { CHECKLIST_PROGRESS_CIRCUMFERENCE, CHECKLIST_PROGRESS_RADIUS } from "../constants";
import type { ChecklistWorkSummary } from "../types";

type ChecklistProgressIndicatorProps = {
  summary: ChecklistWorkSummary;
  doneCount: number;
  total: number;
};

export default function ChecklistProgressIndicator({ summary, doneCount, total }: ChecklistProgressIndicatorProps) {
  if (summary.status === "empty") {
    return (
      <svg className="text-muted/30 h-4 w-4" viewBox="0 0 20 20" fill="none">
        <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  if (summary.status === "completed") {
    return (
      <div className="relative flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <svg
          className="h-3 w-3"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="3 6 5 8 9 4" />
        </svg>
      </div>
    );
  }

  const progressPercent = total > 0 ? (doneCount / total) * 100 : 0;
  const strokeDashoffset =
    CHECKLIST_PROGRESS_CIRCUMFERENCE - (progressPercent / 100) * CHECKLIST_PROGRESS_CIRCUMFERENCE;
  const hasActiveProgress = summary.status === "reserved" || doneCount > 0;

  return (
    <div className="relative flex h-5 w-5 items-center justify-center">
      <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
        <circle
          cx="10"
          cy="10"
          r={CHECKLIST_PROGRESS_RADIUS}
          className="stroke-zinc-200 dark:stroke-zinc-800"
          strokeWidth="2"
          fill="none"
        />
        <circle
          cx="10"
          cy="10"
          r={CHECKLIST_PROGRESS_RADIUS}
          className={`${
            hasActiveProgress ? "stroke-amber-500 dark:stroke-amber-400" : "stroke-zinc-300 dark:stroke-zinc-600"
          } transition-all duration-300`}
          strokeWidth="2"
          fill="none"
          strokeDasharray={CHECKLIST_PROGRESS_CIRCUMFERENCE}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`absolute h-1.5 w-1.5 rounded-full ${
          hasActiveProgress ? "bg-amber-500 shadow-[0_0_8px_#f59e0b] dark:bg-amber-400" : "bg-zinc-400 dark:bg-zinc-500"
        }`}
      />
    </div>
  );
}
