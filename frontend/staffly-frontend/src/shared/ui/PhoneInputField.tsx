import React from "react";
import embeddedFlags from "react-phone-number-input/flags";
import { parseIncompletePhoneNumber } from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";

import {
  analyzePhoneNumber,
  canAcceptPhoneInput,
  getCountryFlagEmoji,
  getCountryLabel,
  getPhoneCountryOptions,
} from "../utils/phone";

type Props = {
  label: string;
  value: string | undefined;
  onChange: (value: string | undefined) => void;
  country?: CountryCode;
  countryLocked?: boolean;
  onCountryChange?: (country: CountryCode, meta?: { manual: boolean; locked: boolean }) => void;
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
  countryLocked,
  onCountryChange,
  error,
  defaultCountry,
  autoComplete,
  disabled,
}: Props) {
  const selectedCountry = country || defaultCountry;
  const phoneCountryOptions = React.useMemo(() => getPhoneCountryOptions(), []);
  const analysis = React.useMemo(
    () => analyzePhoneNumber(value, selectedCountry, countryLocked),
    [value, selectedCountry, countryLocked],
  );
  const effectiveCountry = analysis.selectedCountry || selectedCountry;
  const helperText = error || getPhoneHelperText(analysis);
  const Flag = effectiveCountry ? embeddedFlags[effectiveCountry] : undefined;
  const inputRef = React.useRef<HTMLInputElement>(null);
  const pendingCaretRef = React.useRef<{ digits: number; keepPlus: boolean } | null>(null);
  const [displayValue, setDisplayValue] = React.useState(value || "");

  React.useEffect(() => {
    if (!value) {
      setDisplayValue("");
      return;
    }

    setDisplayValue(analysis.inputValue || value);
  }, [analysis.inputValue, value]);

  React.useEffect(() => {
    if (!value) {
      return;
    }

    if (
      analysis.shouldAutoSwitchCountry &&
      analysis.selectedCountry &&
      analysis.selectedCountry !== country
    ) {
      onCountryChange?.(analysis.selectedCountry, { manual: false, locked: false });
    }
  }, [analysis.selectedCountry, analysis.shouldAutoSwitchCountry, country, onCountryChange, value]);

  React.useLayoutEffect(() => {
    if (pendingCaretRef.current === null || !inputRef.current) {
      return;
    }

    const nextCaret = findCaretPosition(displayValue, pendingCaretRef.current);
    inputRef.current.setSelectionRange(nextCaret, nextCaret);
    pendingCaretRef.current = null;
  }, [displayValue]);

  const handleCountryChange = (nextCountry: CountryCode) => {
    onCountryChange?.(nextCountry, { manual: true, locked: true });
  };

  const applyPhoneValue = (nextRawValue: string, caret: { digits: number; keepPlus: boolean }) => {
    if (!canAcceptPhoneInput(nextRawValue, effectiveCountry, !!countryLocked)) {
      return;
    }

    const nextAnalysis = analyzePhoneNumber(nextRawValue, effectiveCountry, !!countryLocked);
    const nextDraft = parseIncompletePhoneNumber(nextRawValue);
    pendingCaretRef.current = caret;
    setDisplayValue(nextAnalysis.inputValue || nextRawValue);
    onChange(nextDraft || undefined);

    if (!nextRawValue) {
      onCountryChange?.(defaultCountry || country || "RU", { manual: false, locked: false });
    }
  };

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextRawValue = event.target.value;
    const selectionStart = event.target.selectionStart ?? nextRawValue.length;
    const caret = getCaretSnapshot(nextRawValue, selectionStart);

    applyPhoneValue(nextRawValue, caret);
  };

  const handleDeleteBySeparator = (input: HTMLInputElement, mode: "backward" | "forward") => {
    const selectionStart = input.selectionStart ?? 0;
    const selectionEnd = input.selectionEnd ?? selectionStart;

    if (selectionStart !== selectionEnd) {
      return false;
    }

    const adjustedValue =
      mode === "backward"
        ? removeDigitBeforeCaret(displayValue, selectionStart)
        : removeDigitAfterCaret(displayValue, selectionStart);

    if (!adjustedValue) {
      return false;
    }

    const caret = getCaretSnapshot(adjustedValue.value, adjustedValue.caret);
    applyPhoneValue(adjustedValue.value, caret);
    return true;
  };

  const handleBeforeInput = (event: React.FormEvent<HTMLInputElement>) => {
    const nativeEvent = event.nativeEvent as InputEvent;

    if (nativeEvent.inputType === "deleteContentBackward") {
      if (handleDeleteBySeparator(event.currentTarget, "backward")) {
        event.preventDefault();
      }
      return;
    }

    if (nativeEvent.inputType === "deleteContentForward") {
      if (handleDeleteBySeparator(event.currentTarget, "forward")) {
        event.preventDefault();
      }
    }
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Backspace") {
      if (handleDeleteBySeparator(event.currentTarget, "backward")) {
        event.preventDefault();
      }
      return;
    }

    if (event.key === "Delete") {
      if (handleDeleteBySeparator(event.currentTarget, "forward")) {
        event.preventDefault();
      }
    }
  };

  const handleBlur = () => {
    if (!analysis.inputValue) {
      return;
    }

    setDisplayValue(analysis.inputValue);
  };

  return (
    <label className="block">
      <span className="text-muted mb-1 block text-sm">{label}</span>

      <div className={`staffly-phone w-full ${error ? "is-error" : ""}`}>
        <div className="staffly-phone-country">
          <select
            aria-label="Страна номера"
            className="PhoneInputCountrySelect"
            value={effectiveCountry || ""}
            onChange={(event) => handleCountryChange(event.target.value as CountryCode)}
            disabled={disabled}
          >
            <option value="" disabled>
              Страна
            </option>
            {phoneCountryOptions.map((option) => (
              <option key={option.code} value={option.code}>
                {option.label}
              </option>
            ))}
          </select>
          <span className="staffly-phone-countryValue">
            {effectiveCountry ? (
              <>
                {Flag ? (
                  <Flag title={getCountryLabel(effectiveCountry)} />
                ) : (
                  <span aria-hidden="true">{getCountryFlagEmoji(effectiveCountry)}</span>
                )}
                <span>{effectiveCountry}</span>
              </>
            ) : (
              <span className="text-muted">Страна</span>
            )}
          </span>
        </div>

        <input
          ref={inputRef}
          type="tel"
          value={displayValue}
          onChange={handleInputChange}
          onBeforeInput={handleBeforeInput}
          onKeyDown={handleKeyDown}
          onBlur={handleBlur}
          autoComplete={autoComplete}
          disabled={disabled}
          className="PhoneInputInput text-default placeholder:text-muted bg-transparent"
          placeholder={effectiveCountry === "RU" ? "999 888-77-66" : "+1 555 123 45 67"}
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

function getPhoneHelperText(analysis: ReturnType<typeof analyzePhoneNumber>) {
  if (analysis.lengthIssue === "TOO_SHORT") {
    return analysis.selectedCountry
      ? `Номер слишком короткий для ${getCountryLabel(analysis.selectedCountry)}.`
      : "Номер слишком короткий.";
  }

  if (analysis.lengthIssue === "TOO_LONG") {
    return analysis.selectedCountry
      ? `Номер слишком длинный для ${getCountryLabel(analysis.selectedCountry)}.`
      : "Номер слишком длинный.";
  }

  return analysis.warning;
}

function getCaretSnapshot(value: string, caret: number) {
  return {
    digits: countDigitsBeforeCaret(value, caret),
    keepPlus: value.startsWith("+") && caret > 0 && countDigitsBeforeCaret(value, caret) === 0,
  };
}

function countDigitsBeforeCaret(value: string, caret: number) {
  return value.slice(0, caret).replace(/\D/g, "").length;
}

function findCaretPosition(value: string, caret: { digits: number; keepPlus: boolean }) {
  if (caret.keepPlus && value.startsWith("+")) {
    return 1;
  }

  const digitsCount = caret.digits;
  if (digitsCount <= 0) {
    return 0;
  }

  let seenDigits = 0;
  for (let index = 0; index < value.length; index += 1) {
    if (/\d/.test(value[index])) {
      seenDigits += 1;
    }

    if (seenDigits >= digitsCount) {
      return index + 1;
    }
  }

  return value.length;
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
