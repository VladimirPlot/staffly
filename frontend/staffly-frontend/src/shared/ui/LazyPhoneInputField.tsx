import React from "react";
import type { CountryCode } from "libphonenumber-js";

const PhoneInputField = React.lazy(() => import("./PhoneInputField"));

type Props = {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  error?: string;
  defaultCountry?: CountryCode;
  autoComplete?: string;
  disabled?: boolean;
};

export default function LazyPhoneInputField(props: Props) {
  const { label, error } = props;

  return (
    <React.Suspense
      fallback={
        <label className="block">
          <span className="mb-1 block text-sm text-muted">{label}</span>
          <div
            className={[
              "h-10 w-full rounded-xl border bg-surface",
              error ? "border-red-300" : "border-subtle",
            ].join(" ")}
          />
          {error && <span className="mt-1 block text-xs text-red-600">{error}</span>}
        </label>
      }
    >
      <PhoneInputField {...props} />
    </React.Suspense>
  );
}
