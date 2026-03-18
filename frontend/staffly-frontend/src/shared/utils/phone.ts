import {
  AsYouType,
  getExampleNumber,
  getCountries,
  getCountryCallingCode,
  isValidPhoneNumber,
  parseIncompletePhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from "libphonenumber-js/max";
import examples from "libphonenumber-js/mobile/examples";
import type { CountryCode } from "libphonenumber-js";

const PRIORITY_COUNTRIES: CountryCode[] = ["RU", "KZ"];
const SHARED_CALLING_CODE_DEFAULTS: Partial<Record<string, CountryCode>> = {
  "1": "US",
  "44": "GB",
};
const MAX_E164_DIGITS = 15;
const COUNTRY_HINT_MIN_DIGITS = 5;
const COUNTRY_LENGTH_CACHE = new Map<CountryCode, number | undefined>();

export type PhoneAnalysis = {
  e164?: string;
  inferredCountry?: CountryCode;
  possibleCountries: CountryCode[];
  isValid: boolean;
  lengthIssue?: string;
  warning?: string;
};

const countryNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["ru"], { type: "region" })
    : undefined;

export function getPhoneCountryOptions(): Array<{ code: CountryCode; label: string }> {
  const countries = getCountries().slice().sort((left, right) => {
    const leftPriority = PRIORITY_COUNTRIES.indexOf(left);
    const rightPriority = PRIORITY_COUNTRIES.indexOf(right);

    if (leftPriority !== -1 || rightPriority !== -1) {
      if (leftPriority === -1) return 1;
      if (rightPriority === -1) return -1;
      return leftPriority - rightPriority;
    }

    return getCountryLabel(left).localeCompare(getCountryLabel(right), "ru");
  });

  return countries.map((code) => ({
    code,
    label: `${getCountryFlagEmoji(code)} ${getCountryLabel(code)} +${getCountryCallingCode(code)}`,
  }));
}

export function getCountryLabel(country: CountryCode) {
  return countryNames?.of(country) || country;
}

export function getCountryFlagEmoji(country: CountryCode) {
  return String.fromCodePoint(
    ...country.split("").map((char) => 127397 + char.charCodeAt(0)),
  );
}

export function inferPhoneCountry(
  value?: string,
  currentCountry?: CountryCode,
): CountryCode | undefined {
  const normalized = parseIncompletePhoneNumber(value || "");
  if (!normalized) return currentCountry;

  if (normalized.startsWith("+")) {
    const parsed = parsePhoneNumberFromString(normalized);
    if (parsed?.country) return parsed.country;

    if (normalized.startsWith("+7")) {
      return inferCountryFromSharedZone7(normalized, currentCountry);
    }

    return currentCountry;
  }

  if (normalized.startsWith("7")) {
    return inferCountryFromSharedZone7(`+${normalized}`, currentCountry);
  }

  if (normalized.startsWith("8")) {
    return inferCountryFromSharedZone7(`+7${normalized.slice(1)}`, currentCountry);
  }

  if (/^9/.test(normalized)) return "RU";

  const countryFromCallingCode = inferCountryFromCallingCodePrefix(normalized, currentCountry);
  if (countryFromCallingCode) {
    return countryFromCallingCode;
  }

  if (currentCountry) return currentCountry;

  return undefined;
}

export function formatPhoneForInput(value?: string, country?: CountryCode) {
  if (!value) return "";

  const normalized = parseIncompletePhoneNumber(value);
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("+")) {
    return new AsYouType().input(normalized);
  }

  const formatter = country ? new AsYouType(country) : new AsYouType();
  return formatter.input(normalized);
}

export function resolvePhoneCountryForInput(
  value: string | undefined,
  currentCountry?: CountryCode,
) {
  const normalized = parseIncompletePhoneNumber(value || "");
  if (!normalized) {
    return currentCountry;
  }

  const inferredCountry = inferPhoneCountry(normalized, currentCountry);
  if (!inferredCountry) {
    return currentCountry;
  }

  const digitsCount = getDigitsCount(normalized);

  if (digitsCount < COUNTRY_HINT_MIN_DIGITS) {
    return currentCountry || inferredCountry;
  }

  if (!currentCountry || inferredCountry === currentCountry) {
    return inferredCountry;
  }

  const parsed = parsePhoneNumberFromString(normalized, {
    defaultCountry: inferredCountry,
    extract: false,
  });

  if (parsed?.isValid()) {
    return parsed.country || inferredCountry;
  }

  if (normalized.startsWith("+")) {
    return inferredCountry;
  }

  const lengthIssue = validatePhoneNumberLength(normalized, inferredCountry);
  if (lengthIssue === "TOO_SHORT") {
    return inferredCountry;
  }

  return inferredCountry;
}

export function canAppendPhoneInput(nextRawValue: string, country?: CountryCode) {
  const normalized = parseIncompletePhoneNumber(nextRawValue);

  if (!normalized) {
    return true;
  }

  const digitsCount = normalized.replace(/\D/g, "").length;

  if (digitsCount > MAX_E164_DIGITS) {
    return false;
  }

  const resolvedCountry = inferPhoneCountry(normalized, country);

  if (!resolvedCountry) {
    return true;
  }

  const nationalDigits = getNationalDigits(normalized, resolvedCountry);
  const maxNationalDigits = getMaxDialableNationalLength(resolvedCountry);

  if (maxNationalDigits && nationalDigits.length > maxNationalDigits) {
    return false;
  }

  const lengthResult = validatePhoneNumberLength(normalized, resolvedCountry);
  return lengthResult !== "TOO_LONG";
}

export function analyzePhoneNumber(
  value: string | undefined,
  selectedCountry?: CountryCode,
): PhoneAnalysis {
  if (!value) {
    return {
      possibleCountries: [],
      isValid: false,
    };
  }

  const normalized = parseIncompletePhoneNumber(value);
  const resolvedCountry = inferPhoneCountry(normalized, selectedCountry);
  const parsed = parsePhoneNumberFromString(
    normalized,
    resolvedCountry ? { defaultCountry: resolvedCountry, extract: false } : undefined,
  );
  const inferredCountry = parsed?.country || resolvedCountry;
  const possibleCountries = parsed?.getPossibleCountries() || [];
  const isValid =
    parsed?.isValid() ||
    (resolvedCountry ? isValidPhoneNumber(normalized, resolvedCountry) : false) ||
    false;
  const lengthIssue = resolvedCountry
    ? validatePhoneNumberLength(normalized, resolvedCountry)
    : undefined;

  return {
    e164: parsed?.number,
    inferredCountry,
    possibleCountries,
    isValid,
    lengthIssue,
    warning: getPhoneWarning(inferredCountry, selectedCountry, normalized),
  };
}

function getPhoneWarning(
  inferredCountry: CountryCode | undefined,
  selectedCountry: CountryCode | undefined,
  value: string,
) {
  if (!value.startsWith("+7")) return undefined;

  if (inferredCountry && selectedCountry && inferredCountry !== selectedCountry) {
    return `Похоже, это номер ${getCountryLabel(inferredCountry)}. Проверьте выбранную страну.`;
  }

  if (!inferredCountry && selectedCountry === "RU") {
    return "Код +7 используется и в России, и в Казахстане. Проверьте страну номера.";
  }

  return undefined;
}

function inferCountryFromSharedZone7(
  normalized: string,
  currentCountry?: CountryCode,
): CountryCode {
  const digits = normalized.replace(/\D/g, "");
  const prefixDigit = digits[1];

  if (!prefixDigit) {
    return "RU";
  }

  if (["0", "6", "7"].includes(prefixDigit)) {
    return "KZ";
  }

  if (["2", "3", "4", "5", "9"].includes(prefixDigit)) {
    return "RU";
  }

  return currentCountry === "KZ" ? "KZ" : "RU";
}

function inferCountryFromCallingCodePrefix(
  normalized: string,
  currentCountry?: CountryCode,
) {
  const digits = normalized.replace(/\D/g, "");
  if (!digits) return undefined;

  for (let prefixLength = Math.min(3, digits.length); prefixLength >= 1; prefixLength -= 1) {
    const prefix = digits.slice(0, prefixLength);
    const countries = getCountriesByCallingCode(prefix);

    if (!countries.length) {
      continue;
    }

    if (prefix === "7") {
      return inferCountryFromSharedZone7(`+${digits}`, currentCountry);
    }

    if (countries.length === 1) {
      return countries[0];
    }

    const preferredCountry = SHARED_CALLING_CODE_DEFAULTS[prefix];
    if (preferredCountry) {
      return preferredCountry;
    }

    if (currentCountry && countries.includes(currentCountry)) {
      return currentCountry;
    }

    return countries[0];
  }

  return undefined;
}

function getNationalDigits(value: string, country: CountryCode) {
  const parsed = parsePhoneNumberFromString(value, {
    defaultCountry: country,
    extract: false,
  });

  if (parsed?.nationalNumber) {
    return parsed.nationalNumber;
  }

  const digits = value.replace(/\D/g, "");
  if (!digits) return "";

  const callingCode = getCountryCallingCode(country);

  if (value.startsWith("+")) {
    return digits.startsWith(callingCode) ? digits.slice(callingCode.length) : digits;
  }

  if (digits.startsWith(callingCode)) {
    return digits.slice(callingCode.length);
  }

  if (digits.startsWith("8")) {
    return digits.slice(1);
  }

  return digits;
}

function getMaxDialableNationalLength(country: CountryCode) {
  if (COUNTRY_LENGTH_CACHE.has(country)) {
    return COUNTRY_LENGTH_CACHE.get(country);
  }

  const maxLength = getExampleNumber(country, examples)?.nationalNumber.length;

  COUNTRY_LENGTH_CACHE.set(country, maxLength);
  return maxLength;
}

function getCountriesByCallingCode(callingCode: string) {
  return getCountries().filter((country) => getCountryCallingCode(country) === callingCode);
}

function getDigitsCount(value: string) {
  return value.replace(/\D/g, "").length;
}

export { getCountryCallingCode };
