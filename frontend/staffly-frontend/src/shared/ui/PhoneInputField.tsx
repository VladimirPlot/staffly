import PhoneInput from "react-phone-number-input";
import type { CountryCode } from "libphonenumber-js";

type Props = {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  error?: string;
  defaultCountry?: CountryCode;
  autoComplete?: string;
  disabled?: boolean;
};

export default function PhoneInputField({
  label,
  value,
  onChange,
  error,
  defaultCountry,
  autoComplete,
  disabled,
}: Props) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>

      <PhoneInput
        value={value}
        onChange={onChange}
        defaultCountry={defaultCountry}
        autoComplete={autoComplete}
        disabled={disabled}
        className={`w-full staffly-phone ${error ? "is-error" : ""}`}
        numberInputProps={{ placeholder: "999 888-77-66" }}
      />

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
