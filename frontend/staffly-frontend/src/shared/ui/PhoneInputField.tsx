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
  const inputClassName = `w-full rounded-2xl border p-3 outline-none transition focus:ring-2 ${
    error ? "border-red-500 ring-red-200" : "border-zinc-300 focus:ring-zinc-300"
  }`;

  return (
    <label className="block text-sm">
      <span className="mb-1 block text-zinc-600">{label}</span>

      <PhoneInput
        value={value}
        onChange={onChange}
        defaultCountry={defaultCountry}
        autoComplete={autoComplete}
        disabled={disabled}
        className="w-full staffly-phone"
        inputClassName={inputClassName}
        numberInputProps={{ placeholder: "999 888-77-66" }}
      />

      {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
    </label>
  );
}
