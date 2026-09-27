import React from "react";

import Button from "../../../shared/ui/Button";
import type { DayOfWeek } from "../api";
import { canonicalizeWeekdays, WEEKDAY_LABELS, WEEKDAYS } from "../utils/buildTemplateDraft";

type Props = {
  days: DayOfWeek[];
  disabled: boolean;
  onCommit: (days: DayOfWeek[]) => void;
};

const ScheduleBuildWeekdaySelector: React.FC<Props> = ({ days, disabled, onCommit }) => {
  const [open, setOpen] = React.useState(false);
  const [selection, setSelection] = React.useState<DayOfWeek[]>(days);
  const rootRef = React.useRef<HTMLDivElement>(null);

  const closeAndCommit = React.useCallback(() => {
    if (!open) return;
    setOpen(false);
    onCommit(canonicalizeWeekdays(selection.length ? selection : days));
  }, [days, onCommit, open, selection]);

  React.useEffect(() => {
    if (!open) setSelection(days);
  }, [days, open]);

  React.useEffect(() => {
    if (!open) return;
    const outside = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) closeAndCommit();
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, [closeAndCommit, open]);

  return (
    <div ref={rootRef} className="relative min-w-0">
      <button
        type="button"
        disabled={disabled}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={`Дни режима: ${days.map((day) => WEEKDAY_LABELS[day]).join(", ")}`}
        className="border-subtle hover:bg-muted/40 flex max-w-full flex-wrap gap-1 rounded-xl border px-2 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-60"
        onClick={() => {
          if (open) closeAndCommit();
          else {
            setSelection(days);
            setOpen(true);
          }
        }}
      >
        {canonicalizeWeekdays(days).map((day) => (
          <span key={day} className="bg-muted rounded-lg px-2 py-1">
            {WEEKDAY_LABELS[day]}
          </span>
        ))}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Выберите дни режима"
          className="border-subtle absolute left-0 z-30 mt-1 w-[min(19rem,calc(100vw-3rem))] rounded-xl border bg-white p-3 shadow-lg"
        >
          <div className="grid grid-cols-4 gap-1.5">
            {WEEKDAYS.map((day) => {
              const belongs = days.includes(day);
              const checked = selection.includes(day);
              return (
                <label
                  key={day}
                  className={`flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm ${belongs ? "bg-gray-50" : "text-gray-400"}`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={!belongs || (checked && selection.length === 1)}
                    aria-label={WEEKDAY_LABELS[day]}
                    onChange={() =>
                      setSelection((current) =>
                        checked ? current.filter((item) => item !== day) : canonicalizeWeekdays([...current, day]),
                      )
                    }
                  />
                  {WEEKDAY_LABELS[day]}
                </label>
              );
            })}
          </div>
          <div className="text-muted mt-2 text-xs">Можно отделить только дни этого режима.</div>
          <div className="mt-3 flex justify-end">
            <Button size="sm" onClick={closeAndCommit}>
              Готово
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ScheduleBuildWeekdaySelector;
