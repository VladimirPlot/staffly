import { useCallback, useMemo, useState } from "react";

type UseValidatedTextFieldOptions = {
  initialValue?: string;
  allowEmpty?: boolean;
  getError: (value: string) => string | undefined;
  getDraftError?: (value: string) => string | undefined;
  normalizeForSubmit?: (value: string) => string;
};

type UseValidatedTextFieldResult = {
  value: string;
  setValue: (value: string) => void;
  touched: boolean;
  setTouched: (value: boolean) => void;
  submitAttempted: boolean;
  setSubmitAttempted: (value: boolean) => void;
  error: string | undefined;
  isValid: boolean;
  getSubmitValue: () => string | null;
  resetValidation: () => void;
};

export default function useValidatedTextField({
  initialValue = "",
  allowEmpty = false,
  getError,
  getDraftError,
  normalizeForSubmit,
}: UseValidatedTextFieldOptions): UseValidatedTextFieldResult {
  const [value, setValue] = useState(initialValue);
  const [touched, setTouched] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const trimmedValue = value.trim();
  const hasValue = trimmedValue.length > 0;

  const error = useMemo(() => {
    if (!hasValue && allowEmpty) {
      return undefined;
    }

    if (submitAttempted || hasValue) {
      return getError(value);
    }

    if (touched && getDraftError) {
      return getDraftError(value);
    }

    return undefined;
  }, [allowEmpty, getDraftError, getError, hasValue, submitAttempted, touched, value]);

  const isValid = allowEmpty && !hasValue ? true : getError(value) === undefined;

  const getSubmitValue = useCallback(() => {
    if (allowEmpty && !hasValue) {
      return null;
    }

    return normalizeForSubmit ? normalizeForSubmit(value) : value.trim();
  }, [allowEmpty, hasValue, normalizeForSubmit, value]);

  const resetValidation = useCallback(() => {
    setTouched(false);
    setSubmitAttempted(false);
  }, []);

  return {
    value,
    setValue,
    touched,
    setTouched,
    submitAttempted,
    setSubmitAttempted,
    error,
    isValid,
    getSubmitValue,
    resetValidation,
  };
}
