import React from "react";
import { CalendarDays } from "lucide-react";

import {
  formatBirthDateFromIso,
  formatBirthDateInput,
  isBirthDateValid,
  normalizeBirthDateForSubmit,
} from "../utils/birthDate";

type BirthDateInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
};

type PickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

export default function BirthDateInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "DD-MM-YYYY",
}: BirthDateInputProps) {
  const pickerRef = React.useRef<PickerInput | null>(null);
  const [prefersNativeTouchPicker, setPrefersNativeTouchPicker] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }

    const coarsePointerQuery = window.matchMedia("(pointer: coarse)");
    const updatePreference = () => {
      setPrefersNativeTouchPicker(coarsePointerQuery.matches);
    };

    updatePreference();
    coarsePointerQuery.addEventListener("change", updatePreference);
    return () => coarsePointerQuery.removeEventListener("change", updatePreference);
  }, []);

  const handleOpenPicker = React.useCallback(() => {
    if (disabled || prefersNativeTouchPicker) {
      return;
    }

    const picker = pickerRef.current;
    if (!picker) {
      return;
    }

    if (typeof picker.showPicker === "function") {
      picker.showPicker();
      return;
    }

    picker.focus();
    picker.click();
  }, [disabled, prefersNativeTouchPicker]);

  const handlePickerChange = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      onChange(formatBirthDateFromIso(event.target.value));
    },
    [onChange],
  );

  const isoValue = isBirthDateValid(value) ? normalizeBirthDateForSubmit(value) : "";

  return (
    <label className="block min-w-0">
      <span className="text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere]">
        {label}
      </span>

      <div className="relative">
        <input
          className={[
            "bg-surface text-default w-full max-w-full min-w-0 rounded-2xl border p-3 pr-14 text-[16px]",
            "focus:ring-default transition outline-none focus:ring-2",
            "dark:[color-scheme:dark]",
            error ? "border-red-500 ring-red-200" : "border-subtle",
          ].join(" ")}
          type="text"
          value={value}
          onChange={(event) => onChange(formatBirthDateInput(event.target.value))}
          onBlur={onBlur}
          inputMode="numeric"
          autoComplete="bday"
          maxLength={10}
          placeholder={placeholder}
          disabled={disabled}
        />

        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled}
          aria-label="Открыть календарь"
          className={[
            "absolute right-2 top-1/2 inline-flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl border",
            "border-subtle bg-[linear-gradient(180deg,var(--staffly-surface),var(--staffly-control))] text-icon",
            "shadow-[var(--staffly-shadow)] transition hover:scale-[1.02] hover:bg-app",
            "focus:outline-none focus:ring-2 focus:ring-default",
            disabled ? "cursor-not-allowed opacity-60" : "",
          ].join(" ")}
        >
          <CalendarDays className="h-5 w-5" />
        </button>

        <input
          ref={pickerRef}
          type="date"
          value={isoValue}
          onChange={handlePickerChange}
          tabIndex={-1}
          aria-hidden="true"
          className={
            prefersNativeTouchPicker
              ? "absolute right-2 top-1/2 h-10 w-10 -translate-y-1/2 cursor-pointer opacity-0"
              : "pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
          }
        />
      </div>

      {error && (
        <span className="mt-1 block min-w-0 text-xs [overflow-wrap:anywhere] text-red-600">
          {error}
        </span>
      )}
    </label>
  );
}
