import { ChevronDown } from "lucide-react";
import type { PositionDto } from "../../../../dictionaries/api";
import type { TrainingExamMode } from "../../../api/types";

type Props = {
  mode: TrainingExamMode;
  positions: PositionDto[];
  manageablePositionIds: Set<number>;
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
  manageablePositionIds,
  visibilityPositionIds,
  availabilityLabel,
  positionMenuOpen,
  onToggleMenu,
  onSelectAll,
  onTogglePosition,
}: Props) {
  return (
    <section className="space-y-3">
      <div className="text-default text-sm font-semibold">Кому доступен тест</div>

      <div className="relative">
        <button
          type="button"
          onClick={onToggleMenu}
          className="border-subtle bg-surface text-default hover:bg-app flex h-11 w-full items-center justify-between rounded-2xl border px-3 text-left text-sm shadow-[var(--staffly-shadow)] transition"
        >
          <span>{availabilityLabel}</span>
          <ChevronDown className={`h-4 w-4 transition ${positionMenuOpen ? "rotate-180" : ""}`} />
        </button>

        {positionMenuOpen && (
          <div className="border-subtle bg-surface absolute z-20 mt-2 w-full rounded-2xl border p-2 shadow-lg">
            <button
              type="button"
              onClick={onSelectAll}
              className={`hover:bg-app flex w-full items-center justify-between rounded-xl px-3 py-2 text-left text-sm transition ${(mode === "PRACTICE" ? visibilityPositionIds.length === 0 : positions.length > 0 && visibilityPositionIds.length === positions.length) ? "bg-app font-medium" : ""}`}
            >
              <span>Всем сотрудникам</span>
              {(mode === "PRACTICE"
                ? visibilityPositionIds.length === 0
                : positions.length > 0 && visibilityPositionIds.length === positions.length) && <span>✓</span>}
            </button>

            <div className="border-subtle my-2 border-t" />

            <div className="max-h-56 space-y-1 overflow-auto">
              {positions.map((position) => {
                const checked = visibilityPositionIds.includes(position.id);
                const canChange = manageablePositionIds.has(position.id) && (position.active || checked);

                return (
                  <label
                    key={position.id}
                    className={`flex items-center justify-between rounded-xl px-3 py-2 text-sm transition ${canChange ? "text-default hover:bg-app cursor-pointer" : "text-muted cursor-not-allowed"}`}
                  >
                    <span className="flex items-center gap-2">
                      {position.name}
                      {!position.active && (
                        <span className="bg-app text-muted rounded-full px-2 py-0.5 text-[10px] font-medium">
                          Неактивна
                        </span>
                      )}
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!canChange}
                      onChange={() => onTogglePosition(position.id)}
                    />
                  </label>
                );
              })}
            </div>
          </div>
        )}
      </div>

      <div className="text-muted text-xs">
        {mode === "CERTIFICATION"
          ? "Для аттестации нужно выбрать минимум одну должность. Выбор «Всем сотрудникам» отметит все должности."
          : "Если не ограничивать доступ по должностям, тест будет доступен всем сотрудникам."}
      </div>
    </section>
  );
}
