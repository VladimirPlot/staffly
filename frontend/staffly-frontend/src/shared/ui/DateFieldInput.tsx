import React from "react";
import { CalendarDays } from "lucide-react";

import { cn } from "../lib/cn";

type PickerInput = HTMLInputElement & {
  showPicker?: () => void;
};

type DateFieldInputProps = {
  label: React.ReactNode;
  value: string;
  onChange: React.ChangeEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  labelClassName?: string;
  inputClassName?: string;
  buttonClassName?: string;
  inputProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "onBlur" | "disabled" | "placeholder" | "className"
  > &
    Record<string, unknown>;
  nativeValue: string;
  onNativeChange: React.ChangeEventHandler<HTMLInputElement>;
  nativeProps?: Omit<
    React.InputHTMLAttributes<HTMLInputElement>,
    "type" | "value" | "onChange" | "tabIndex" | "aria-hidden" | "disabled" | "className"
  > &
    Record<string, unknown>;
};

export default function DateFieldInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "DD.MM.YYYY",
  labelClassName,
  inputClassName,
  buttonClassName,
  inputProps,
  nativeValue,
  onNativeChange,
  nativeProps,
}: DateFieldInputProps) {
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

  return (
    <label className="block min-w-0">
      <span className={cn("text-muted mb-1 block min-w-0 text-sm [overflow-wrap:anywhere]", labelClassName)}>
        {label}
      </span>

      <div className="relative">
        <input
          className={cn(
            "bg-surface text-default w-full max-w-full min-w-0 rounded-2xl border p-3 pr-14 text-[16px]",
            "focus:ring-default transition outline-none focus:ring-2",
            "dark:[color-scheme:dark]",
            error ? "border-red-500 ring-red-200" : "border-subtle",
            inputClassName,
          )}
          type="text"
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          inputMode="numeric"
          autoCorrect="off"
          autoCapitalize="off"
          spellCheck={false}
          placeholder={placeholder}
          disabled={disabled}
          {...inputProps}
        />

        <button
          type="button"
          onClick={handleOpenPicker}
          disabled={disabled}
          aria-label="Открыть календарь"
          className={cn(
            "absolute top-1/2 right-2 z-20 inline-flex size-10 -translate-y-1/2 items-center justify-center rounded-xl border",
            "border-subtle bg-surface text-icon shadow-sm transition hover:bg-[color:var(--staffly-control)]",
            "focus:ring-default focus:ring-2 focus:outline-none",
            disabled && "cursor-not-allowed opacity-60",
            prefersNativeTouchPicker && "pointer-events-none opacity-0",
            buttonClassName,
          )}
        >
          <CalendarDays className="size-5" />
        </button>

        <input
          ref={pickerRef}
          type="date"
          value={nativeValue}
          onChange={onNativeChange}
          tabIndex={-1}
          aria-hidden="true"
          disabled={disabled}
          className={cn(
            "absolute inset-0 z-10 h-full w-full opacity-0",
            prefersNativeTouchPicker ? "cursor-pointer" : "pointer-events-none",
          )}
          {...nativeProps}
        />
      </div>

      {error ? <span className="mt-1 block min-w-0 text-xs [overflow-wrap:anywhere] text-red-600">{error}</span> : null}
    </label>
  );
}
