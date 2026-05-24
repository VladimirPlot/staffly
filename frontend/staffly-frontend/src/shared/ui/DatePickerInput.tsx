import React from "react";

import DateFieldInput from "./DateFieldInput";
import { formatDateFromIso, isValidIsoDate, toIsoDate } from "../utils/date";

type DatePickerInputProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type" | "value" | "onChange"> & {
  label: React.ReactNode;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  labelClassName?: string;
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
  const displayValue = formatDateFromIso(value);
  const nativeValue = isValidIsoDate(value) ? value : toIsoDate(value) ?? "";

  return (
    <DateFieldInput
      label={label}
      value={displayValue}
      onChange={(event) => onChange(event.target.value)}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      labelClassName={labelClassName}
      inputClassName={className}
      inputProps={{
        name,
        required,
        ...rest,
      }}
      nativeValue={nativeValue}
      onNativeChange={(event) => onChange(event.target.value)}
      nativeProps={{
        min,
        max,
      }}
    />
  );
}
