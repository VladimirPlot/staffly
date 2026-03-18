import React from "react";
import embeddedFlags from "react-phone-number-input/flags";
import type { CountryCode } from "libphonenumber-js";

import {
  canAppendPhoneInput,
  formatPhoneForInput,
  getCountryFlagEmoji,
  getCountryLabel,
  getPhoneCountryOptions,
  analyzePhoneNumber,
  resolvePhoneCountryForInput,
} from "../utils/phone";

type Props = {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  country?: CountryCode;
  onCountryChange?: (country: CountryCode) => void;
  error?: string;
  defaultCountry?: CountryCode;
  autoComplete?: string;
  disabled?: boolean;
};

export default function PhoneInputField({
  label,
  value,
  onChange,
  country,
  onCountryChange,
  error,
  defaultCountry,
  autoComplete,
  disabled,
}: Props) {
  const selectedCountry = country || defaultCountry;
  const analysis = analyzePhoneNumber(value, selectedCountry);
  const helperText = error || getPhoneHelperText(analysis, selectedCountry);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [inputValue, setInputValue] = React.useState(() =>
    formatPhoneForInput(value, selectedCountry),
  );
  const Flag = selectedCountry ? embeddedFlags[selectedCountry] : undefined;

  React.useEffect(() => {
    setInputValue(formatPhoneForInput(value, selectedCountry));
  }, [value, selectedCountry]);

  const handleCountryChange = (nextCountry: CountryCode) => {
    const nextFormatted = formatPhoneForInput(value, nextCountry);
    setInputValue(nextFormatted);
    onCountryChange?.(nextCountry);
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextRawValue = event.target.value;
    const nextCountry = resolvePhoneCountryForInput(nextRawValue, selectedCountry);
    const inputType = (event.nativeEvent as InputEvent).inputType || "";
    const isDeleting = inputType.startsWith("delete");

    if (!canAppendPhoneInput(nextRawValue, nextCountry)) {
      return;
    }

    const nextFormatted = formatPhoneForInput(nextRawValue, nextCountry);
    setInputValue(isDeleting ? nextRawValue : nextFormatted);
    if (nextCountry) {
      onCountryChange?.(nextCountry);
    }
    onChange(nextRawValue);
  };

  const applyAdjustedDeletion = React.useCallback(
    (adjustedValue: { value: string; caret: number }) => {
      const nextCountry = resolvePhoneCountryForInput(adjustedValue.value, selectedCountry);
      const nextFormatted = formatPhoneForInput(adjustedValue.value, nextCountry);

      setInputValue(nextFormatted);
      if (nextCountry) {
        onCountryChange?.(nextCountry);
      }
      onChange(adjustedValue.value);

      queueMicrotask(() => {
        const nextInput = inputRef.current;
        if (!nextInput) {
          return;
        }

        const nextCaret = Math.min(adjustedValue.caret, nextInput.value.length);
        nextInput.setSelectionRange(nextCaret, nextCaret);
      });
    },
    [onChange, onCountryChange, selectedCountry],
  );

  const handleBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;
    if (
      nativeEvent.inputType !== "deleteContentBackward" &&
      nativeEvent.inputType !== "deleteContentForward"
    ) {
      return;
    }

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) {
      return;
    }

    const adjustedValue =
      nativeEvent.inputType === "deleteContentBackward"
        ? removeDigitBeforeCaret(input.value, selectionStart)
        : removeDigitAfterCaret(input.value, selectionStart);

    if (!adjustedValue) {
      return;
    }

    event.preventDefault();
    applyAdjustedDeletion(adjustedValue);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== "Backspace" && event.key !== "Delete") {
      return;
    }

    const input = event.currentTarget;
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) {
      return;
    }

    const adjustedValue =
      event.key === "Backspace"
        ? removeDigitBeforeCaret(input.value, selectionStart)
        : removeDigitAfterCaret(input.value, selectionStart);

    if (!adjustedValue) {
      return;
    }

    event.preventDefault();
    applyAdjustedDeletion(adjustedValue);
  };

  return (
    <label className="block">
      <span className="mb-1 block text-sm text-muted">{label}</span>

      <div className={`w-full staffly-phone ${error ? "is-error" : ""}`}>
        <div className="staffly-phone-country">
          <select
            aria-label="Страна номера"
            className="PhoneInputCountrySelect"
            value={selectedCountry || ""}
            onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
            disabled={disabled}
          >
            <option value="" disabled>
              Страна
            </option>
            {getPhoneCountryOptions().map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="staffly-phone-countryValue">
            {selectedCountry ? (
              <>
                {Flag ? (
                  <Flag title={getCountryLabel(selectedCountry)} />
                ) : (
                  <span aria-hidden="true">{getCountryFlagEmoji(selectedCountry)}</span>
                )}
                <span>{selectedCountry}</span>
              </>
            ) : (
              <span className="text-muted">Страна</span>
            )}
          </span>
        </div>

        <input
          ref={inputRef}
          type="tel"
          value={inputValue}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onChange={handleInputChange}
          autoComplete={autoComplete}
          disabled={disabled}
          className="PhoneInputInput text-default placeholder:text-muted bg-transparent"
          placeholder={selectedCountry ? "999 888-77-66" : "+7 999 888-77-66"}
        />
      </div>

      {helperText && (
        <span className={`mt-1 block text-xs ${error ? "text-red-600" : "text-amber-600"}`}>
          {helperText}
        </span>
      )}
    </label>
  );
}

function getPhoneHelperText(
  analysis: ReturnType<typeof analyzePhoneNumber>,
  selectedCountry?: CountryCode,
) {
  if (analysis.lengthIssue === "TOO_SHORT") {
    return selectedCountry
      ? `Номер слишком короткий для ${getCountryLabel(selectedCountry)}.`
      : "Номер слишком короткий.";
  }

  if (analysis.lengthIssue === "TOO_LONG") {
    return selectedCountry
      ? `Номер слишком длинный для ${getCountryLabel(selectedCountry)}.`
      : "Номер слишком длинный.";
  }

  return analysis.warning;
}

function removeDigitBeforeCaret(value: string, caret: number) {
  const previousCharacter = value[caret - 1];
  if (!previousCharacter || /\d/.test(previousCharacter)) {
    return null;
  }

  for (let index = caret - 2; index >= 0; index -= 1) {
    if (/\d/.test(value[index])) {
      return {
        value: `${value.slice(0, index)}${value.slice(index + 1)}`,
        caret: index,
      };
    }
  }

  return null;
}

function removeDigitAfterCaret(value: string, caret: number) {
  const currentCharacter = value[caret];
  if (!currentCharacter || /\d/.test(currentCharacter)) {
    return null;
  }

  for (let index = caret + 1; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      return {
        value: `${value.slice(0, index)}${value.slice(index + 1)}`,
        caret,
      };
    }
  }

  return null;
}
