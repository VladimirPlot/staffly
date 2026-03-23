import React from "react";

import Input from "./Input";

type EmailInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  error?: string;
  disabled?: boolean;
  placeholder?: string;
  autoComplete?: string;
};

export default function EmailInput({
  label,
  value,
  onChange,
  onBlur,
  error,
  disabled = false,
  placeholder = "name@example.com",
  autoComplete = "email",
}: EmailInputProps) {
  return (
    <Input
      label={label}
      type="email"
      value={value}
      onChange={(event) => onChange(event.target.value)}
      onBlur={onBlur}
      placeholder={placeholder}
      autoComplete={autoComplete}
      disabled={disabled}
      error={error}
    />
  );
}
