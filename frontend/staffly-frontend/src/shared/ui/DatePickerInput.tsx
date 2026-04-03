import React from "react";
import { CalendarDays } from "lucide-react";

import { cn } from "../lib/cn";

type DatePickerInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  labelClassName?: string;
};

type PickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

export default function DatePickerInput({
  label,
  value,
  onChange,
  error,
  labelClassName,
  className,
  disabled = false,
  placeholder = "ДД.ММ.ГГГГ",
  name,
  min,
  max,
  required,
  ...rest
}: DatePickerInputProps) {
  const pickerRef = React.useRef<PickerInput | null>(null);
  const [prefersNativeTouchPicker, setPrefersNativeTouchPicker] = React.useState(false);
  const displayValue = formatDateFromIso(value);

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
      onChange(event.target.value);
    },
    [onChange],
  );

  return (
    <label className="block min-w-0">
      <span className={cn("text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere]", labelClassName)}>
        {label}
      </span>

      <div className="relative">
        <input
          onClick={handleOpenPicker}
          className={cn(
            "bg-surface text-default w-full max-w-full min-w-0 rounded-2xl border p-3 pr-14 text-[16px]",
            "cursor-pointer",
            "focus:ring-default transition outline-none focus:ring-2",
            error ? "border-red-500 ring-red-200" : "border-subtle",
            className,
          )}
          type="text"
          name={name}
          value={displayValue}
          readOnly
          inputMode="numeric"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          required={required}
          {...rest}
        />

        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled}
          aria-label="Открыть календарь"
          className={cn(
            "absolute top-1/2 right-2 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl border",
            "border-subtle bg-surface text-icon shadow-sm transition hover:bg-[color:var(--staffly-control)]",
            "focus:ring-default focus:ring-2 focus:outline-none",
            disabled && "cursor-not-allowed opacity-60",
            prefersNativeTouchPicker && "pointer-events-none opacity-0",
          )}
        >
          <CalendarDays className="size-5" />
        </button>

        <input
          ref={pickerRef}
          type="date"
          value={value}
          onChange={handlePickerChange}
          min={min}
          max={max}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          className={
            prefersNativeTouchPicker
              ? "absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0"
              : "pointer-events-none absolute right-0 bottom-0 h-0 w-0 opacity-0"
          }
        />
      </div>

      {error ? <span className="mt-1 block min-w-0 text-xs [overflow-wrap:anywhere] text-red-600">{error}</span> : null}
    </label>
  );
}

function formatDateFromIso(value: string): string {
  const parts = value.trim().split("-");
  if (parts.length !== 3) return value.trim();

  const [year, month, day] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return value.trim();
  }

  return `${day}.${month}.${year}`;
}
