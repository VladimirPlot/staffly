import React from "react";
import type { CountryCode } from "libphonenumber-js";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import BirthDateInput from "../../../shared/ui/BirthDateInput";
import EmailInput from "../../../shared/ui/EmailInput";
import Input from "../../../shared/ui/Input";
import LazyPhoneInputField from "../../../shared/ui/LazyPhoneInputField";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForSubmit } from "../../../shared/utils/phone";

import { useAuth } from "../../../shared/providers/AuthProvider";
import useValidatedTextField from "../../../shared/hooks/useValidatedTextField";
import { getEmailDraftError, getEmailError } from "../../../shared/utils/email";
import {
  getBirthDateDraftError,
  getBirthDateError,
  normalizeBirthDateForSubmit,
} from "../../../shared/utils/birthDate";
import { login, register } from "../../auth/api";

type Mode = "login" | "register";

const PHONE_ERROR = "Введите корректный номер телефона";

const getStoredPhone = () => {
  const stored = localStorage.getItem("auth.lastPhone");
  return stored || undefined;
};

export default function LoginRegister() {
  const { loginWithToken } = useAuth();
  const [mode, setMode] = React.useState<Mode>("login");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const [lPhone, setLPhone] = React.useState<string | undefined>(() => getStoredPhone());
  const [lCountry, setLCountry] = React.useState<CountryCode | undefined>(DEFAULT_PHONE_COUNTRY);
  const [lCountryLocked, setLCountryLocked] = React.useState(false);
  const [lPassword, setLPassword] = React.useState("");

  const [rFirstName, setRFirstName] = React.useState("");
  const [rLastName, setRLastName] = React.useState("");
  const [rPhone, setRPhone] = React.useState<string | undefined>(undefined);
  const [rCountry, setRCountry] = React.useState<CountryCode | undefined>(DEFAULT_PHONE_COUNTRY);
  const [rCountryLocked, setRCountryLocked] = React.useState(false);
  const rEmailField = useValidatedTextField({
    initialValue: "",
    getError: getEmailError,
    getDraftError: getEmailDraftError,
  });
  const [rPassword, setRPassword] = React.useState("");
  const rBirthDateField = useValidatedTextField({
    initialValue: "",
    getError: getBirthDateError,
    getDraftError: getBirthDateDraftError,
    normalizeForSubmit: normalizeBirthDateForSubmit,
  });
  const resetREmailValidation = rEmailField.resetValidation;
  const resetRBirthDateValidation = rBirthDateField.resetValidation;

  React.useEffect(() => {
    setError(null);
    resetREmailValidation();
    resetRBirthDateValidation();
  }, [mode, resetREmailValidation, resetRBirthDateValidation]);

  const onLogin = async () => {
    setError(null);

    const loginPhone = normalizePhoneForSubmit(lPhone, {
      selectedCountry: lCountry,
      isCountryLocked: lCountryLocked,
    });
    if (!loginPhone.e164 || !loginPhone.isValid) {
      setError(PHONE_ERROR);
      return;
    }
    if (!lPassword.trim()) {
      setError("Введите пароль");
      return;
    }

    setBusy(true);
    try {
      const { token } = await login({ phone: loginPhone.e164, password: lPassword });
      localStorage.setItem("auth.lastPhone", loginPhone.e164);
      await loginWithToken(token);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async () => {
    setError(null);
    rEmailField.setTouched(true);
    rEmailField.setSubmitAttempted(true);
    rBirthDateField.setTouched(true);
    rBirthDateField.setSubmitAttempted(true);

    const registerPhone = normalizePhoneForSubmit(rPhone, {
      selectedCountry: rCountry,
      isCountryLocked: rCountryLocked,
    });
    if (!registerPhone.e164 || !registerPhone.isValid) {
      setError(PHONE_ERROR);
      return;
    }
    if (!rEmailField.isValid || !rBirthDateField.isValid) {
      return;
    }

    setBusy(true);
    try {
      const registerEmail = rEmailField.getSubmitValue();
      const registerBirthDate = rBirthDateField.getSubmitValue();

      if (!registerEmail || !registerBirthDate) {
        return;
      }

      const { token } = await register({
        phone: registerPhone.e164,
        email: registerEmail,
        firstName: rFirstName.trim(),
        lastName: rLastName.trim(),
        password: rPassword,
        birthDate: registerBirthDate,
      });
      localStorage.setItem("auth.lastPhone", registerPhone.e164);
      await loginWithToken(token);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка регистрации");
    } finally {
      setBusy(false);
    }
  };

  const canRegister =
    !!(
      rFirstName.trim() &&
      rLastName.trim() &&
      rPhone &&
      rEmailField.isValid &&
      rPassword.trim() &&
      rBirthDateField.isValid
    ) && !busy;

  const phoneError = error === PHONE_ERROR ? error : undefined;

  const handleLoginCountryChange = (
    nextCountry: NonNullable<typeof lCountry>,
    meta?: { manual: boolean; locked: boolean },
  ) => {
    setLCountry(nextCountry);
    setLCountryLocked(meta?.locked || false);
  };

  const handleRegisterCountryChange = (
    nextCountry: NonNullable<typeof rCountry>,
    meta?: { manual: boolean; locked: boolean },
  ) => {
    setRCountry(nextCountry);
    setRCountryLocked(meta?.locked || false);
  };

  const tabRailClassName =
    "inline-flex w-full max-w-xs gap-1 rounded-[1.4rem] border " +
    "border-[var(--staffly-brand-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.72)_0%,rgba(24,24,27,0.04)_100%)] " +
    "p-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] backdrop-blur-[2px] transition-colors duration-150 ease-out " +
    "dark:bg-[linear-gradient(180deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.02)_100%)] " +
    "dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]";

  const tabButtonBaseClassName =
    "relative flex-1 shadow-none transition-[transform,box-shadow,background-color,color] " +
    "duration-150 ease-out motion-reduce:transition-none";

  const activeTabClassName =
    "z-10 -translate-y-px shadow-[0_14px_28px_rgba(9,9,11,0.24)] " +
    "ring-1 ring-black/5 dark:ring-white/10";

  const inactiveTabClassName = "text-muted hover:bg-[var(--staffly-brand-hover)]";

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex justify-center">
          <div className={tabRailClassName}>
            <Button
              variant={mode === "login" ? "primary" : "ghost"}
              onClick={() => setMode("login")}
              disabled={busy}
              className={`${tabButtonBaseClassName} ${mode === "login" ? activeTabClassName : inactiveTabClassName}`}
            >
              Вход
            </Button>
            <Button
              variant={mode === "register" ? "primary" : "ghost"}
              onClick={() => setMode("register")}
              disabled={busy}
              className={`${tabButtonBaseClassName} ${mode === "register" ? activeTabClassName : inactiveTabClassName}`}
            >
              Регистрация
            </Button>
          </div>
        </div>

        {mode === "login" ? (
          <div className="grid gap-3">
            <LazyPhoneInputField
              label="Телефон"
              autoComplete="username"
              value={lPhone}
              onChange={setLPhone}
              country={lCountry}
              countryLocked={lCountryLocked}
              onCountryChange={handleLoginCountryChange}
              error={phoneError}
              disabled={busy}
            />

            <Input
              label="Пароль"
              type="password"
              name="password"
              autoComplete="current-password"
              value={lPassword}
              onChange={(e) => setLPassword(e.target.value)}
              disabled={busy}
            />

            {error && error !== PHONE_ERROR && <div className="text-sm text-red-600">{error}</div>}

            <Button onClick={onLogin} disabled={busy || !lPhone || !lPassword.trim()}>
              {busy ? "Входим…" : "Войти"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <Input
              label="Имя"
              value={rFirstName}
              onChange={(e) => setRFirstName(e.target.value)}
              disabled={busy}
            />
            <Input
              label="Фамилия"
              value={rLastName}
              onChange={(e) => setRLastName(e.target.value)}
              disabled={busy}
            />

            <LazyPhoneInputField
              label="Телефон"
              autoComplete="tel"
              value={rPhone}
              onChange={setRPhone}
              country={rCountry}
              countryLocked={rCountryLocked}
              onCountryChange={handleRegisterCountryChange}
              error={phoneError}
              disabled={busy}
            />

            <EmailInput
              label="Email"
              value={rEmailField.value}
              onChange={rEmailField.setValue}
              onBlur={() => rEmailField.setTouched(true)}
              error={rEmailField.error}
              disabled={busy}
            />

            <BirthDateInput
              label="Дата рождения"
              value={rBirthDateField.value}
              onChange={rBirthDateField.setValue}
              onBlur={() => rBirthDateField.setTouched(true)}
              error={rBirthDateField.error}
              disabled={busy}
              preventAutofill
            />

            <Input
              label="Пароль"
              type="password"
              name="newPassword"
              autoComplete="new-password"
              value={rPassword}
              onChange={(e) => setRPassword(e.target.value)}
              disabled={busy}
            />

            {error && error !== PHONE_ERROR && <div className="text-sm text-red-600">{error}</div>}

            <Button onClick={onRegister} disabled={!canRegister}>
              {busy ? "Регистрируем…" : "Зарегистрироваться"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
