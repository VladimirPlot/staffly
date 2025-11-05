import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Avatar from "../../../shared/ui/Avatar";
import { uploadMyAvatar, getMyProfile, updateMyProfile, changeMyPassword, type UserProfile } from "../api";
import { useAuth } from "../../../shared/providers/AuthProvider";

// 👇 базовый URL бэкенда (для превью сразу после аплоада)
const API_BASE =
  (import.meta.env.VITE_API_BASE_URL?.replace(/\/+$/, "") as string) ||
  "http://localhost:8080";

function UploadAvatarBlock({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = React.useState<File | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);

  React.useEffect(() => {
    return () => {
      if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  const onFileChange = (f: File | null) => {
    setError(null);
    if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    setFile(f);
    setPreview(f ? URL.createObjectURL(f) : null);
  };

  return (
    <div className="rounded-2xl border border-zinc-200 p-4">
      <div className="mb-2 text-sm font-medium">Аватар</div>
      <div className="mb-3 text-xs text-zinc-600">Разрешены: JPEG, PNG, WEBP. Максимум 5MB.</div>

      {preview && (
        <div className="mb-3">
          <img src={preview} alt="preview" className="h-20 w-20 rounded-full border border-zinc-200 object-cover" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFileChange(e.currentTarget.files?.[0] ?? null)}
      />

      <div className="flex items-center gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
          Выбрать файл
        </Button>
        <Button
          variant="primary"
          disabled={!file || busy}
          onClick={async () => {
            if (!file) return;
            setBusy(true);
            setError(null);
            try {
              if (file.size > 5 * 1024 * 1024) throw new Error("Файл больше 5MB");
              const { avatarUrl } = await uploadMyAvatar(file);

              // ✅ делаем absolute + cache-busting для мгновенного превью
              const abs = avatarUrl.startsWith("http") ? avatarUrl : `${API_BASE}${avatarUrl}`;
              const withBusting = `${abs}${abs.includes("?") ? "&" : "?"}v=${Date.now()}`;
              setPreview(withBusting);

              onUploaded(); // подтянуть /api/me и обновить аватар в шапке
              if (fileInputRef.current) fileInputRef.current.value = "";
              setFile(null);
              alert("Аватар обновлён");
            } catch (e: any) {
              setError(e?.message || "Ошибка загрузки");
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? "Загружаем…" : "Загрузить"}
        </Button>
      </div>

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}
    </div>
  );
}

export default function Profile() {
  const navigate = useNavigate();
  const { user, refreshMe } = useAuth();

  // данные профиля
  const [loading, setLoading] = React.useState(true);
  const [loadErr, setLoadErr] = React.useState<string | null>(null);

  const [firstName, setFirstName] = React.useState("");
  const [lastName, setLastName] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [email, setEmail] = React.useState("");
  const [birthDate, setBirthDate] = React.useState("");

  // сохранение
  const [saving, setSaving] = React.useState(false);
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null);

  // смена пароля
  const [currPass, setCurrPass] = React.useState("");
  const [newPass, setNewPass] = React.useState("");
  const [pwdBusy, setPwdBusy] = React.useState(false);
  const [pwdMsg, setPwdMsg] = React.useState<string | null>(null);

  React.useEffect(() => {
    let alive = true;
    (async () => {
      try {
        setLoading(true);
        const p: UserProfile = await getMyProfile();
        if (!alive) return;
        setFirstName(p.firstName || "");
        setLastName(p.lastName || "");
        setPhone(p.phone || "");
        setEmail(p.email || "");
        setBirthDate(p.birthDate || "");
        setLoadErr(null);
      } catch (e: any) {
        if (!alive) return;
        setLoadErr(e?.response?.data?.message || e?.message || "Не удалось загрузить профиль");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Профиль</h2>
          <Button variant="ghost" onClick={() => navigate("/restaurants")}>Закрыть</Button>
        </div>

        {/* Текущий аватар */}
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user?.name || "Пользователь"} imageUrl={user?.avatarUrl} />
          <div className="text-sm text-zinc-600">
            {user?.avatarUrl ? "Аватар загружен" : "Аватар не загружен"}
          </div>
        </div>

        {/* Загрузка нового аватара */}
        <UploadAvatarBlock onUploaded={() => refreshMe()} />

        {loading ? (
          <div className="mt-6">Загрузка…</div>
        ) : loadErr ? (
          <div className="mt-6 text-red-600">{loadErr}</div>
        ) : (
          <>
            {/* Контактные данные */}
            <div className="mt-6 grid gap-4">
              <Input label="Имя" value={firstName} onChange={(e) => setFirstName(e.target.value)} />
              <Input label="Фамилия" value={lastName} onChange={(e) => setLastName(e.target.value)} />
              <Input label="Телефон" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
              <Input label="Дата рождения" type="date" value={birthDate} onChange={(e) => setBirthDate(e.target.value)} />
            </div>

            {saveMsg && <div className="mt-2 text-sm text-emerald-700">{saveMsg}</div>}

            <div className="mt-4 flex gap-2">
              <Button
                onClick={async () => {
                  try {
                    setSaving(true);
                    setSaveMsg(null);
                    await updateMyProfile({
                      firstName: firstName.trim(),
                      lastName: lastName.trim(),
                      phone: phone.trim(),
                      email: email.trim(),
                      birthDate: birthDate.trim() ? birthDate.trim() : null,
                    });
                    await refreshMe();
                    setSaveMsg("Сохранено");
                  } catch (e: any) {
                    setSaveMsg(null);
                    alert(e?.response?.data?.message || e?.message || "Не удалось сохранить профиль");
                  } finally {
                    setSaving(false);
                  }
                }}
                disabled={saving}
              >
                {saving ? "Сохраняем…" : "Сохранить"}
              </Button>
              <Button variant="outline" onClick={() => navigate("/restaurants")}>Отмена</Button>
            </div>

            <hr className="my-6 border-zinc-200" />

            {/* Смена пароля */}
            <div className="mb-2 text-sm font-medium">Смена пароля</div>
            <div className="grid gap-3">
              <Input label="Текущий пароль" type="password" value={currPass} onChange={(e) => setCurrPass(e.target.value)} />
              <Input label="Новый пароль" type="password" value={newPass} onChange={(e) => setNewPass(e.target.value)} />
            </div>
            {pwdMsg && <div className="mt-2 text-sm text-emerald-700">{pwdMsg}</div>}
            <div className="mt-3">
              <Button
                disabled={!currPass.trim() || !newPass.trim() || pwdBusy}
                onClick={async () => {
                  try {
                    setPwdBusy(true);
                    setPwdMsg(null);
                    await changeMyPassword({ currentPassword: currPass, newPassword: newPass });
                    setCurrPass("");
                    setNewPass("");
                    setPwdMsg("Пароль изменён");
                  } catch (e: any) {
                    setPwdMsg(null);
                    alert(e?.response?.data?.message || e?.message || "Не удалось изменить пароль");
                  } finally {
                    setPwdBusy(false);
                  }
                }}
              >
                {pwdBusy ? "Обновляем…" : "Обновить пароль"}
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
