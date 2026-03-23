import {
  AsYouType,
  getCountries,
  getCountryCallingCode,
  parseIncompletePhoneNumber,
  parsePhoneNumberFromString,
  validatePhoneNumberLength,
} from "libphonenumber-js/max";
import type { CountryCode } from "libphonenumber-js";

const PRIORITY_COUNTRIES: CountryCode[] = [
  "RU",
  "KZ",
  "BY",
  "KG",
  "AM",
  "AZ",
  "UZ",
  "TJ",
  "TM",
  "MD",
];

const SHARED_CALLING_CODE_DEFAULTS: Partial<Record<string, CountryCode>> = {
  "1": "US",
  "44": "GB",
};

const DEFAULT_PHONE_COUNTRY: CountryCode = "RU";
const AUTO_DETECTION_THRESHOLD = 3;
const GENERIC_AUTO_PREFIX_THRESHOLD = 4;

type PhoneLengthIssue = ReturnType<typeof validatePhoneNumberLength>;

export type PhoneNormalizationResult = {
  normalized: string;
  inputValue: string;
  selectedCountry?: CountryCode;
  detectedCountry?: CountryCode;
  e164?: string;
  possibleCountries: CountryCode[];
  isValid: boolean;
  lengthIssue?: PhoneLengthIssue;
  warning?: string;
  shouldAutoSwitchCountry: boolean;
};

export type PhoneAnalysis = PhoneNormalizationResult;

type NormalizePhoneOptions = {
  selectedCountry?: CountryCode;
  isCountryLocked?: boolean;
  defaultCountry?: CountryCode;
};

const countryNames =
  typeof Intl !== "undefined" && "DisplayNames" in Intl
    ? new Intl.DisplayNames(["ru"], { type: "region" })
    : undefined;

let phoneCountryOptionsCache: Array<{ code: CountryCode; label: string }> | null = null;

export function getPhoneCountryOptions(): Array<{ code: CountryCode; label: string }> {
  if (phoneCountryOptionsCache) {
    return phoneCountryOptionsCache;
  }

  phoneCountryOptionsCache = getCountries()
    .slice()
    .sort((left, right) => {
      const leftPriority = PRIORITY_COUNTRIES.indexOf(left);
      const rightPriority = PRIORITY_COUNTRIES.indexOf(right);

      if (leftPriority !== -1 || rightPriority !== -1) {
        if (leftPriority === -1) return 1;
        if (rightPriority === -1) return -1;
        return leftPriority - rightPriority;
      }

      return getCountryLabel(left).localeCompare(getCountryLabel(right), "ru");
    })
    .map((code) => ({
      code,
      label: `${getCountryFlagEmoji(code)} ${getCountryLabel(code)} +${getCountryCallingCode(code)}`,
    }));

  return phoneCountryOptionsCache;
}

export function getCountryLabel(country: CountryCode) {
  return countryNames?.of(country) || country;
}

export function getCountryFlagEmoji(country: CountryCode) {
  return String.fromCodePoint(...country.split("").map((char) => 127397 + char.charCodeAt(0)));
}

export function formatPhoneForInput(value?: string, country?: CountryCode) {
  const normalized = parseIncompletePhoneNumber(value || "");
  if (!normalized) {
    return "";
  }

  if (normalized.startsWith("+")) {
    return new AsYouType().input(normalized);
  }

  return country ? new AsYouType(country).input(normalized) : normalized;
}

export function normalizePhoneInput(
  value: string | undefined,
  options: NormalizePhoneOptions = {},
): PhoneNormalizationResult {
  const normalized = parseIncompletePhoneNumber(value || "");
  const fallbackCountry = options.defaultCountry || DEFAULT_PHONE_COUNTRY;
  const currentCountry = options.selectedCountry || fallbackCountry;
  const isCountryLocked = options.isCountryLocked || false;

  if (!normalized) {
    return {
      normalized: "",
      inputValue: "",
      selectedCountry: currentCountry,
      detectedCountry: currentCountry,
      possibleCountries: [],
      isValid: false,
      shouldAutoSwitchCountry: false,
    };
  }

  if (normalized.startsWith("+")) {
    return normalizeInternationalPhone(normalized, currentCountry, isCountryLocked);
  }

  const digits = getDigits(normalized);
  const cisDraft = normalizeCisDraft(digits, currentCountry, isCountryLocked);
  if (cisDraft) {
    return cisDraft;
  }

  const internationalWithoutPlus = normalizeInternationalWithoutPlus(
    digits,
    currentCountry,
    isCountryLocked,
  );
  if (internationalWithoutPlus) {
    return internationalWithoutPlus;
  }

  return normalizeNationalPhone(normalized, currentCountry, isCountryLocked);
}

export function normalizePhoneForSubmit(
  value: string | undefined,
  options: NormalizePhoneOptions = {},
) {
  return normalizePhoneInput(value, options);
}

export function analyzePhoneNumber(
  value: string | undefined,
  selectedCountry?: CountryCode,
  isCountryLocked = false,
): PhoneAnalysis {
  return normalizePhoneInput(value, {
    selectedCountry,
    isCountryLocked,
  });
}

export function canAcceptPhoneInput(
  value: string | undefined,
  selectedCountry?: CountryCode,
  isCountryLocked = false,
) {
  const normalized = parseIncompletePhoneNumber(value || "");
  if (!normalized) {
    return true;
  }

  const digits = getDigits(normalized);
  if (digits.length > 15) {
    return false;
  }

  if (looksLikeZone7National(digits) && digits.length > 11) {
    return false;
  }

  const analysis = analyzePhoneNumber(normalized, selectedCountry, isCountryLocked);
  return analysis.lengthIssue !== "TOO_LONG";
}

function normalizeInternationalPhone(
  normalized: string,
  currentCountry: CountryCode,
  isCountryLocked: boolean,
): PhoneNormalizationResult {
  const parsed = parsePhoneNumberFromString(normalized);
  const detectedCountry =
    parsed?.country || inferCountryFromCallingCode(normalized, currentCountry);
  const selectedCountry = isCountryLocked || !detectedCountry ? currentCountry : detectedCountry;
  const possibleCountries =
    parsed?.getPossibleCountries() || (detectedCountry ? [detectedCountry] : []);
  const isValid = parsed?.isValid() || false;
  const lengthIssue =
    detectedCountry && !isValid
      ? validatePhoneNumberLength(normalized, detectedCountry)
      : undefined;

  return {
    normalized,
    inputValue: formatPhoneForInput(normalized, selectedCountry),
    selectedCountry,
    detectedCountry,
    e164: isValid ? parsed?.number : undefined,
    possibleCountries,
    isValid,
    lengthIssue,
    warning: getPhoneWarning({
      normalized,
      selectedCountry,
      detectedCountry,
      possibleCountries,
      isCountryLocked,
      isInternational: true,
    }),
    shouldAutoSwitchCountry:
      !isCountryLocked && !!detectedCountry && detectedCountry !== currentCountry,
  };
}

function normalizeCisDraft(
  digits: string,
  currentCountry: CountryCode,
  isCountryLocked: boolean,
): PhoneNormalizationResult | null {
  if (!digits) {
    return null;
  }

  if (isCountryLocked && !PRIORITY_COUNTRIES.includes(currentCountry)) {
    return null;
  }

  const zone7Country = getZone7CountryForDigits(digits, currentCountry);
  if (!zone7Country) {
    return null;
  }

  const selectedCountry =
    !isCountryLocked && digits.length >= AUTO_DETECTION_THRESHOLD && zone7Country !== currentCountry
      ? zone7Country
      : currentCountry;
  const activeCountry = selectedCountry;
  const normalizedDraft = buildZone7Normalized(digits, activeCountry);
  const parsed = normalizedDraft ? parsePhoneNumberFromString(normalizedDraft) : undefined;
  const isValid = parsed?.isValid() || false;
  const inputValue = getZone7InputValue(digits, activeCountry, normalizedDraft);

  return {
    normalized: normalizedDraft || digits,
    inputValue,
    selectedCountry: activeCountry,
    detectedCountry: zone7Country,
    e164: isValid ? parsed?.number : undefined,
    possibleCountries: [zone7Country],
    isValid,
    lengthIssue: normalizedDraft
      ? validatePhoneNumberLength(normalizedDraft, activeCountry)
      : undefined,
    warning: getPhoneWarning({
      normalized: digits,
      selectedCountry: activeCountry,
      detectedCountry: zone7Country,
      possibleCountries: [zone7Country],
      isCountryLocked,
      isInternational: false,
    }),
    shouldAutoSwitchCountry:
      !isCountryLocked &&
      digits.length >= AUTO_DETECTION_THRESHOLD &&
      zone7Country !== currentCountry,
  };
}

function normalizeInternationalWithoutPlus(
  digits: string,
  currentCountry: CountryCode,
  isCountryLocked: boolean,
): PhoneNormalizationResult | null {
  if (digits.length < 11 || digits.startsWith("8") || looksLikeZone7National(digits)) {
    return null;
  }

  const normalized = `+${digits}`;
  const parsed = parsePhoneNumberFromString(normalized);
  const detectedCountry =
    parsed?.country || inferCountryFromCallingCode(normalized, currentCountry);

  if (!detectedCountry) {
    return null;
  }

  const isValid = parsed?.isValid() || false;
  const lengthIssue = validatePhoneNumberLength(normalized, detectedCountry);
  const looksUsableInternational =
    isValid || (lengthIssue !== "TOO_SHORT" && lengthIssue !== "TOO_LONG");

  if (!looksUsableInternational) {
    return null;
  }

  const selectedCountry =
    !isCountryLocked && detectedCountry !== currentCountry ? detectedCountry : currentCountry;

  return {
    normalized: digits,
    inputValue: formatPhoneForInput(normalized, detectedCountry),
    selectedCountry,
    detectedCountry,
    e164: isValid ? parsed?.number : undefined,
    possibleCountries: parsed?.getPossibleCountries() || [detectedCountry],
    isValid,
    lengthIssue,
    warning: isValid
      ? undefined
      : "Проверьте международный номер. Возможно, нужен другой код страны или номер не существует.",
    shouldAutoSwitchCountry:
      !isCountryLocked &&
      detectedCountry !== currentCountry &&
      digits.length >= AUTO_DETECTION_THRESHOLD,
  };
}

function normalizeNationalPhone(
  normalized: string,
  currentCountry: CountryCode,
  isCountryLocked: boolean,
): PhoneNormalizationResult {
  const digits = getDigits(normalized);
  const normalizedDraft = buildInternationalDraftFromNational(digits, currentCountry);

  if ((currentCountry === "RU" || currentCountry === "KZ") && !looksLikeZone7National(digits)) {
    return {
      normalized: normalizedDraft || normalized,
      inputValue: normalizedDraft
        ? formatPhoneForInput(normalizedDraft, currentCountry)
        : normalized,
      selectedCountry: currentCountry,
      detectedCountry: currentCountry,
      possibleCountries: [],
      isValid: false,
      warning:
        digits.length >= 10
          ? "Номер не похож на номер выбранной страны. Уточните страну или введите номер с +."
          : undefined,
      shouldAutoSwitchCountry: false,
    };
  }

  const parsed = parsePhoneNumberFromString(normalized, {
    defaultCountry: currentCountry,
    extract: false,
  });
  const possibleCountries = parsed?.getPossibleCountries() || [];
  const isValid = parsed?.isValid() || false;
  const lengthIssue = validatePhoneNumberLength(normalized, currentCountry);

  return {
    normalized: normalizedDraft || normalized,
    inputValue: formatPhoneForInput(normalizedDraft || normalized, currentCountry),
    selectedCountry: currentCountry,
    detectedCountry: parsed?.country || currentCountry,
    e164: isValid ? parsed?.number : undefined,
    possibleCountries,
    isValid,
    lengthIssue,
    warning: getPhoneWarning({
      normalized,
      selectedCountry: currentCountry,
      detectedCountry: parsed?.country,
      possibleCountries,
      isCountryLocked,
      isInternational: false,
    }),
    shouldAutoSwitchCountry: false,
  };
}

function getPhoneWarning(input: {
  normalized: string;
  selectedCountry?: CountryCode;
  detectedCountry?: CountryCode;
  possibleCountries: CountryCode[];
  isCountryLocked: boolean;
  isInternational: boolean;
}) {
  const {
    normalized,
    selectedCountry,
    detectedCountry,
    possibleCountries,
    isCountryLocked,
    isInternational,
  } = input;

  if (
    selectedCountry &&
    detectedCountry &&
    selectedCountry !== detectedCountry &&
    (isCountryLocked || isInternational)
  ) {
    return `Похоже, это номер ${getCountryLabel(detectedCountry)}. Проверьте выбранную страну.`;
  }

  if ((normalized.startsWith("+7") || normalized.startsWith("7")) && possibleCountries.length > 1) {
    return "Код +7 используется и в России, и в Казахстане. Проверьте страну номера.";
  }

  return undefined;
}

function looksLikeZone7National(digits: string) {
  if (!digits) {
    return false;
  }

  if (digits.startsWith("9")) {
    return digits.length <= 10;
  }

  if (digits.startsWith("8")) {
    return true;
  }

  return digits.startsWith("7") && (digits.length <= 11 || /^7[0145679]/.test(digits));
}

function getZone7CountryForDigits(digits: string, currentCountry: CountryCode) {
  if (!digits || !looksLikeZone7National(digits)) {
    return undefined;
  }

  if (digits.startsWith("9")) {
    return "RU";
  }

  if (digits.startsWith("8")) {
    return getZone7CountryForDigits(digits.slice(1), currentCountry);
  }

  if (!digits.startsWith("7")) {
    return currentCountry === "KZ" ? "KZ" : "RU";
  }

  if (digits.length === 11) {
    const parsed = parsePhoneNumberFromString(`+${digits}`);
    if (parsed?.country) {
      return parsed.country;
    }
  }

  return currentCountry === "KZ" ? "KZ" : "RU";
}

function buildZone7E164(digits: string, country: CountryCode) {
  if (!digits) {
    return undefined;
  }

  if (digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.startsWith("9") && country === "RU") {
    return `+7${digits}`;
  }

  if (digits.length === 10 && digits.startsWith("7")) {
    return country === "KZ" ? `+7${digits}` : undefined;
  }

  if (digits.length === 11 && digits.startsWith("7")) {
    return `+${digits}`;
  }

  return undefined;
}

function buildZone7Normalized(digits: string, country: CountryCode) {
  const e164Candidate = buildZone7E164(digits, country);
  if (e164Candidate) {
    return e164Candidate;
  }

  if (digits.startsWith("9") && country === "RU") {
    return `+7${digits}`;
  }

  if (digits.startsWith("8")) {
    return `+7${digits.slice(1)}`;
  }

  if (digits.startsWith("7")) {
    return `+${digits}`;
  }

  return undefined;
}

function buildInternationalDraftFromNational(digits: string, country: CountryCode) {
  if (!digits) {
    return undefined;
  }

  if (country === "RU" || country === "KZ") {
    if (!looksLikeZone7National(digits)) {
      return undefined;
    }
  }

  const callingCode = getCountryCallingCode(country);
  if (digits.startsWith(callingCode)) {
    return `+${digits}`;
  }

  if (digits.length < GENERIC_AUTO_PREFIX_THRESHOLD) {
    return undefined;
  }

  return `+${callingCode}${digits}`;
}

function shouldFormatAsInternationalZone7(digits: string, country: CountryCode) {
  if (digits.startsWith("8")) {
    return true;
  }

  if (digits.startsWith("9")) {
    return digits.length > 10 || country !== "RU";
  }

  if (digits.startsWith("7")) {
    return digits.length >= 11 || country === "KZ";
  }

  return false;
}

function getZone7InputValue(digits: string, country: CountryCode, normalizedDraft?: string) {
  if (digits.startsWith("9") && country === "RU") {
    return formatPhoneForInput(normalizedDraft || `+7${digits}`, country);
  }

  if (shouldFormatAsInternationalZone7(digits, country)) {
    return formatPhoneForInput(normalizedDraft || digits, country);
  }

  return formatPhoneForInput(normalizedDraft || digits, country);
}

function inferCountryFromCallingCode(value: string, currentCountry?: CountryCode) {
  const digits = getDigits(value);
  if (!digits) {
    return undefined;
  }

  for (let prefixLength = Math.min(3, digits.length); prefixLength >= 1; prefixLength -= 1) {
    const prefix = digits.slice(0, prefixLength);
    const countries = getCountries().filter((country) => getCountryCallingCode(country) === prefix);

    if (!countries.length) {
      continue;
    }

    if (prefix === "7") {
      return getZone7CountryForDigits(digits, currentCountry || DEFAULT_PHONE_COUNTRY);
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

function getDigits(value: string) {
  return value.replace(/\D/g, "");
}

export {
  AUTO_DETECTION_THRESHOLD,
  DEFAULT_PHONE_COUNTRY,
  GENERIC_AUTO_PREFIX_THRESHOLD,
  getCountryCallingCode,
};
