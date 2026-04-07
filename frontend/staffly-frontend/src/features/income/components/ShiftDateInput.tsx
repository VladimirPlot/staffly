import React from "react";

import DateFieldInput from "../../../shared/ui/DateFieldInput";
import { formatShiftDateFromIso, formatShiftDateInput, toIsoShiftDate } from "../utils/shiftDate";

type ShiftDateInputProps = {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
};

export default function ShiftDateInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "ДД.ММ.ГГГГ",
}: ShiftDateInputProps) {
  return (
    <DateFieldInput
      label={label}
      value={value}
      onChange={(event) => onChange(formatShiftDateInput(event.target.value))}
      onBlur={onBlur}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      nativeValue={toIsoShiftDate(value) ?? ""}
      onNativeChange={(event) => onChange(formatShiftDateFromIso(event.target.value))}
    />
  );
}
