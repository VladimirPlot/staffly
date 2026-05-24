import React from "react";

import DateFieldInput from "./DateFieldInput";
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
  preventAutofill?: boolean;
};

export default function BirthDateInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "DD.MM.YYYY",
  preventAutofill = false,
}: BirthDateInputProps) {
  const isoValue = isBirthDateValid(value) ? normalizeBirthDateForSubmit(value) : "";

  return (
    <DateFieldInput
      label={label}
      value={value}
      onChange={(event) => onChange(formatBirthDateInput(event.target.value))}
      onBlur={onBlur}
      error={error}
      disabled={disabled}
      placeholder={placeholder}
      inputProps={{
        name: preventAutofill ? "profile_birth_date_manual" : "birthDate",
        autoComplete: preventAutofill ? "off" : "bday",
        "data-lpignore": preventAutofill ? "true" : undefined,
        "data-1p-ignore": preventAutofill ? "true" : undefined,
        "data-form-type": preventAutofill ? "other" : undefined,
        maxLength: 10,
      }}
      nativeValue={isoValue}
      onNativeChange={(event) => onChange(formatBirthDateFromIso(event.target.value))}
      nativeProps={{
        autoComplete: preventAutofill ? "off" : undefined,
      }}
    />
  );
}
