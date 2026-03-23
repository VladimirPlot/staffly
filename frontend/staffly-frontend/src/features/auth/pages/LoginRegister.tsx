import React from "react";
import type { CountryCode } from "libphonenumber-js";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import BirthDateInput from "../../../shared/ui/BirthDateInput";
import Input from "../../../shared/ui/Input";
import LazyPhoneInputField from "../../../shared/ui/LazyPhoneInputField";
import { DEFAULT_PHONE_COUNTRY, normalizePhoneForSubmit } from "../../../shared/utils/phone";
import {
  EMAIL_MAX_LENGTH,
  getEmailDraftError,
  getEmailError,
  isEmailValid,
} from "../../../shared/utils/email";
import {
  getBirthDateDraftError,
  getBirthDateError,
  isBirthDateValid,
  normalizeBirthDateForSubmit,
} from "../../../shared/utils/birthDate";

import { useAuth } from "../../../shared/providers/AuthProvider";
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
  const [rEmail, setREmail] = React.useState("");
  const [rEmailTouched, setREmailTouched] = React.useState(false);
  const [rPassword, setRPassword] = React.useState("");
  const [rBirthDate, setRBirthDate] = React.useState("");
  const [rBirthDateTouched, setRBirthDateTouched] = React.useState(false);
  const [registerSubmitAttempted, setRegisterSubmitAttempted] = React.useState(false);

  const registerEmailError =
    registerSubmitAttempted || rEmail.trim()
      ? getEmailError(rEmail)
      : rEmailTouched
        ? getEmailDraftError(rEmail)
        : undefined;
  const registerBirthDateError =
    registerSubmitAttempted || rBirthDate.trim()
      ? getBirthDateError(rBirthDate)
      : rBirthDateTouched
        ? getBirthDateDraftError(rBirthDate)
        : undefined;

  React.useEffect(() => {
    setError(null);
    setREmailTouched(false);
    setRBirthDateTouched(false);
    setRegisterSubmitAttempted(false);
  }, [mode]);

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
    setREmailTouched(true);
    setRBirthDateTouched(true);
    setRegisterSubmitAttempted(true);

    const registerPhone = normalizePhoneForSubmit(rPhone, {
      selectedCountry: rCountry,
      isCountryLocked: rCountryLocked,
    });
    if (!registerPhone.e164 || !registerPhone.isValid) {
      setError(PHONE_ERROR);
      return;
    }
    if (!isEmailValid(rEmail)) {
      return;
    }
    if (!isBirthDateValid(rBirthDate)) {
      return;
    }

    setBusy(true);
    try {
      const { token } = await register({
        phone: registerPhone.e164,
        email: rEmail.trim(),
        firstName: rFirstName.trim(),
        lastName: rLastName.trim(),
        password: rPassword,
        birthDate: normalizeBirthDateForSubmit(rBirthDate),
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
      rEmail.trim() &&
      isEmailValid(rEmail) &&
      rPassword.trim() &&
      rBirthDate.trim() &&
      isBirthDateValid(rBirthDate)
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

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex justify-center gap-2">
          <Button
            variant={mode === "login" ? "primary" : "outline"}
            onClick={() => setMode("login")}
            disabled={busy}
          >
            Вход
          </Button>
          <Button
            variant={mode === "register" ? "primary" : "outline"}
            onClick={() => setMode("register")}
            disabled={busy}
          >
            Регистрация
          </Button>
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

            <Input
              label="Email"
              type="email"
              value={rEmail}
              onChange={(e) => setREmail(e.target.value)}
              onBlur={() => setREmailTouched(true)}
              placeholder="name@example.com"
              maxLength={EMAIL_MAX_LENGTH}
              error={registerEmailError}
              disabled={busy}
            />

            <BirthDateInput
              label="Дата рождения"
              value={rBirthDate}
              onChange={setRBirthDate}
              onBlur={() => setRBirthDateTouched(true)}
              error={registerBirthDateError}
              disabled={busy}
            />

            <Input
              label="Пароль"
              type="password"
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
