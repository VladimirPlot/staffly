import React from "react";

import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import LazyPhoneInputField from "../../../shared/ui/LazyPhoneInputField";

import { useAuth } from "../../../shared/providers/AuthProvider";
import { login, register } from "../../auth/api";

type Mode = "login" | "register";

const PHONE_ERROR = "Введите корректный номер телефона";

const getStoredPhone = () => {
  const stored = localStorage.getItem("auth.lastPhone");
  return stored || undefined;
};

async function isPhoneValid(phone: string): Promise<boolean> {
  const mod = await import("react-phone-number-input");
  return mod.isValidPhoneNumber(phone);
}

export default function LoginRegister() {
  const { loginWithToken } = useAuth();
  const [mode, setMode] = React.useState<Mode>("login");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // login form
  const [lPhone, setLPhone] = React.useState<string | undefined>(() => getStoredPhone());
  const [lPassword, setLPassword] = React.useState("");

  // register form
  const [rFirstName, setRFirstName] = React.useState("");
  const [rLastName, setRLastName] = React.useState("");
  const [rPhone, setRPhone] = React.useState<string | undefined>(undefined);
  const [rEmail, setREmail] = React.useState("");
  const [rPassword, setRPassword] = React.useState("");
  const [rBirthDate, setRBirthDate] = React.useState("");

  // ✅ сбрасываем ошибки при смене вкладки, чтобы не “тянулось” между режимами
  React.useEffect(() => {
    setError(null);
  }, [mode]);

  const onLogin = async () => {
    setError(null);

    if (!lPhone || !(await isPhoneValid(lPhone))) {
      setError(PHONE_ERROR);
      return;
    }
    if (!lPassword.trim()) {
      setError("Введите пароль");
      return;
    }

    setBusy(true);
    try {
      const { token } = await login({ phone: lPhone, password: lPassword });

      // ✅ сохраняем телефон сразу после успеха
      localStorage.setItem("auth.lastPhone", lPhone);

      await loginWithToken(token);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async () => {
    setError(null);

    if (!rPhone || !(await isPhoneValid(rPhone))) {
      setError(PHONE_ERROR);
      return;
    }

    setBusy(true);
    try {
      const { token } = await register({
        phone: rPhone,
        email: rEmail.trim(),
        firstName: rFirstName.trim(),
        lastName: rLastName.trim(),
        password: rPassword,
        birthDate: rBirthDate.trim(),
      });

      // ✅ тоже сохраняем телефон после успешной регистрации
      localStorage.setItem("auth.lastPhone", rPhone);

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
      rPassword.trim() &&
      rBirthDate.trim()
    ) && !busy;

  const phoneError = error === PHONE_ERROR ? error : undefined;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex gap-2">
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
              defaultCountry="RU"
              value={lPhone}
              onChange={setLPhone}
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
              defaultCountry="RU"
              autoComplete="tel"
              value={rPhone}
              onChange={setRPhone}
              error={phoneError}
              disabled={busy}
            />

            <Input
              label="Email"
              type="email"
              value={rEmail}
              onChange={(e) => setREmail(e.target.value)}
              placeholder="name@example.com"
              disabled={busy}
            />

            <Input
              label="Дата рождения"
              type="date"
              value={rBirthDate}
              onChange={(e) => setRBirthDate(e.target.value)}
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
