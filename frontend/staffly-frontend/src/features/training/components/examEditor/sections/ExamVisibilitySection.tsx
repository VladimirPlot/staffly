import { ChevronDown } from "lucide-react";
import type { PositionDto } from "../../../../dictionaries/api";
import type { TrainingExamMode } from "../../../api/types";

type Props = {
  mode: TrainingExamMode;
  positions: PositionDto[];
  visibilityPositionIds: number[];
  availabilityLabel: string;
  positionMenuOpen: boolean;
  onToggleMenu: () => void;
  onSelectAll: () => void;
  onTogglePosition: (positionId: number) => void;
};

export default function ExamVisibilitySection({
  mode,
  positions,
  visibilityPositionIds,
  availabilityLabel,
  positionMenuOpen,
  onToggleMenu,
  onSelectAll,
  onTogglePosition,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="text-sm font-semibold text-default">Кому доступен тест</div>

      <div className="relative">
        <button
          type="button"
          onClick={onToggleMenu}
          className="flex h-11 w-full items-center justify-between rounded-2xl border border-subtle bg-surface px-3 text-left text-sm text-default shadow-[var(--staffly-shadow)] transition hover:bg-app"
        >
          <span>{availabilityLabel}</span>
          <ChevronDown className={`h-4 w-4 transition ${positionMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {positionMenuOpen && (
          <div className="absolute z-20 mt-2 w-full rounded-2xl border border-subtle bg-surface p-2 shadow-lg">
            <button
              type="button"
              onClick={onSelectAll}
              className={`flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition hover:bg-app ${(mode === "PRACTICE" ? visibilityPositionIds.length === 0 : visibilityPositionIds.length === positions.length) ? "bg-app font-medium" : ""}`}
            >
              <span>Всем сотрудникам</span>
              {(mode === "PRACTICE" ? visibilityPositionIds.length === 0 : visibilityPositionIds.length === positions.length) && <span>✓</span>}
            </button>

            <div className="my-2 border-t border-subtle" />

            <div className="max-h-56 space-y-1 overflow-auto">
              {positions.map((position) => {
                const checked = visibilityPositionIds.includes(position.id);

                return (
                  <label
                    key={position.id}
                    className="flex cursor-pointer items-center justify-between rounded-xl px-3 py-2 text-sm text-default transition hover:bg-app"
                  >
                    <span>{position.name}</span>
                    <input type="checkbox" checked={checked} onChange={() => onTogglePosition(position.id)} />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-xs text-muted">
        {mode === "CERTIFICATION"
          ? "Для аттестации нужно выбрать минимум одну должность. Выбор «Всем сотрудникам» отметит все должности."
          : "Если не ограничивать доступ по должностям, тест будет доступен всем сотрудникам."}
      </div>
    </section>
  );
}
