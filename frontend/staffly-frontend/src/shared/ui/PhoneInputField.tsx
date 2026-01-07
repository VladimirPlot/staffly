import React from "react";
import PhoneInput from "react-phone-number-input";
import type { CountryCode } from "react-phone-number-input";

type Props = {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  error?: string;
  defaultCountry?: CountryCode;
  autoComplete?: string;
  disabled?: boolean;
  placeholder?: string;
};

export default function PhoneInputField({
  label,
  value,
  onChange,
  error,
  defaultCountry = "RU",
  autoComplete,
  disabled,
  placeholder = "999 888-77-66",
}: Props) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>

      <PhoneInput
        value={value}
        onChange={onChange}
        defaultCountry={defaultCountry}
        disabled={disabled}
        international
        withCountryCallingCode
        countryCallingCodeEditable={false}
        className={`staffly-phone ${error ? "is-error" : ""}`}
        numberInputProps={{
          autoComplete,
          inputMode: "tel",
          placeholder,
        }}
      />

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
