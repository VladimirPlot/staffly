import React from "react";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { login, register } from "../../auth/api";

type Mode = "login" | "register";

export default function LoginRegister() {
  const { loginWithToken } = useAuth();
  const [mode, setMode] = React.useState<Mode>("login");
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // login form
  const [lPhone, setLPhone] = React.useState("+79999999999");
  const [lPassword, setLPassword] = React.useState("admin123");

  // register form
  const [rFirstName, setRFirstName] = React.useState("");
  const [rLastName, setRLastName] = React.useState("");
  const [rPhone, setRPhone] = React.useState("");
  const [rEmail, setREmail] = React.useState("");
  const [rPassword, setRPassword] = React.useState("");
  const [rBirthDate, setRBirthDate] = React.useState("");

  const onLogin = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token } = await login({ phone: lPhone.trim(), password: lPassword });
      await loginWithToken(token);
    } catch (e: any) {
      setError(e?.friendlyMessage || "Ошибка входа");
    } finally {
      setBusy(false);
    }
  };

  const onRegister = async () => {
    setBusy(true);
    setError(null);
    try {
      const { token } = await register({
        phone: rPhone.trim(),
        email: rEmail.trim(), // <-- обязателен
        firstName: rFirstName.trim(),
        lastName: rLastName.trim(),
        password: rPassword,
        birthDate: rBirthDate.trim(),
      });
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
      rPhone.trim() &&
      rEmail.trim() &&
      rPassword.trim() &&
      rBirthDate.trim()
    ) && !busy;

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <div className="mb-4 flex gap-2">
          <Button variant={mode === "login" ? "primary" : "outline"} onClick={() => setMode("login")}>
            Вход
          </Button>
          <Button variant={mode === "register" ? "primary" : "outline"} onClick={() => setMode("register")}>
            Регистрация
          </Button>
        </div>

        {mode === "login" ? (
          <div className="grid gap-3">
            <Input label="Телефон" type="tel" value={lPhone} onChange={(e) => setLPhone(e.target.value)} />
            <Input label="Пароль" type="password" value={lPassword} onChange={(e) => setLPassword(e.target.value)} />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button onClick={onLogin} disabled={busy}>
              {busy ? "Входим…" : "Войти"}
            </Button>
          </div>
        ) : (
          <div className="grid gap-3">
            <Input label="Имя" value={rFirstName} onChange={(e) => setRFirstName(e.target.value)} />
            <Input label="Фамилия" value={rLastName} onChange={(e) => setRLastName(e.target.value)} />
            <Input label="Телефон" type="tel" value={rPhone} onChange={(e) => setRPhone(e.target.value)} />
            <Input label="Email" type="email" value={rEmail} onChange={(e) => setREmail(e.target.value)} placeholder="name@example.com" />
            <Input label="Дата рождения" type="date" value={rBirthDate} onChange={(e) => setRBirthDate(e.target.value)} />
            <Input label="Пароль" type="password" value={rPassword} onChange={(e) => setRPassword(e.target.value)} />
            {error && <div className="text-sm text-red-600">{error}</div>}
            <Button onClick={onRegister} disabled={!canRegister}>
              {busy ? "Регистрируем…" : "Зарегистрироваться"}
            </Button>
          </div>
        )}
      </Card>
    </div>
  );
}
