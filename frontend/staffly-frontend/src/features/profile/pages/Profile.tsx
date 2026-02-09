import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Avatar from "../../../shared/ui/Avatar";
import { uploadMyAvatar, getMyProfile, updateMyProfile, changeMyPassword, type UserProfile } from "../api";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { API_BASE } from "../../../shared/utils/url";
import { base64UrlToArrayBuffer, getVapidPublicKey, subscribePush, subscriptionToDto, unsubscribePush } from "../../push/api";

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
    <div className="rounded-2xl border border-subtle p-4">
      <div className="mb-2 text-sm font-medium">Аватар</div>
      <div className="mb-3 text-xs text-muted">Разрешены: JPEG, PNG, WEBP. Максимум 5MB.</div>

      {preview && (
        <div className="mb-3">
          <img src={preview} alt="preview" className="h-20 w-20 rounded-full border border-subtle object-cover" />
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
              setError(e?.friendlyMessage || (e as Error)?.message || "Ошибка загрузки");
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

  const [pushSupported, setPushSupported] = React.useState(false);
  const [pushEnabled, setPushEnabled] = React.useState(false);
  const [pushBusy, setPushBusy] = React.useState(false);
  const [pushError, setPushError] = React.useState<string | null>(null);
  const [pushPermission, setPushPermission] = React.useState<NotificationPermission>("default");
  const [isStandalone, setIsStandalone] = React.useState(true);
  const [isIOS, setIsIOS] = React.useState(false);

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
        setLoadErr(e?.friendlyMessage || "Не удалось загрузить профиль");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, []);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const supported = "serviceWorker" in navigator && "PushManager" in window;
    setPushSupported(supported);
    setPushPermission(Notification.permission);
    setIsStandalone(
      window.matchMedia("(display-mode: standalone)").matches || Boolean((navigator as any).standalone),
    );
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent));
    if (!supported || Notification.permission !== "granted") {
      setPushEnabled(false);
      return;
    }
    void (async () => {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      setPushEnabled(Boolean(sub));
    })();
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
          <div className="text-sm text-muted">
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
                    alert(e?.friendlyMessage || "Не удалось сохранить профиль");
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

            <hr className="my-6 border-subtle" />

            {/* Push уведомления */}
            <div className="mb-2 text-sm font-medium">Push уведомления</div>
            {!pushSupported && (
              <div className="text-xs text-muted">
                Ваш браузер не поддерживает push-уведомления.
              </div>
            )}
            {pushSupported && (
              <div className="rounded-2xl border border-subtle p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-sm font-medium">
                      {pushEnabled ? "Включены" : "Выключены"}
                    </div>
                    <div className="text-xs text-muted">
                      Разрешение: {pushPermission}
                    </div>
                  </div>
                  <Button
                    variant={pushEnabled ? "outline" : "primary"}
                    disabled={pushBusy}
                    onClick={async () => {
                      setPushBusy(true);
                      setPushError(null);
                      try {
                        if (!pushEnabled) {
                          const permission = await Notification.requestPermission();
                          setPushPermission(permission);
                          if (permission !== "granted") {
                            setPushEnabled(false);
                            setPushError("Разрешение на уведомления не выдано");
                            return;
                          }
                          const reg = await navigator.serviceWorker.ready;
                          const publicKey = await getVapidPublicKey();
                          const subscription = await reg.pushManager.subscribe({
                            userVisibleOnly: true,
                            applicationServerKey: base64UrlToArrayBuffer(publicKey),
                          });
                          await subscribePush(subscriptionToDto(subscription));
                          setPushEnabled(true);
                        } else {
                          const reg = await navigator.serviceWorker.ready;
                          const subscription = await reg.pushManager.getSubscription();
                          if (subscription) {
                            const endpoint = subscription.endpoint;
                            await subscription.unsubscribe();
                            await unsubscribePush(endpoint);
                          }
                          setPushEnabled(false);
                        }
                      } catch (e: any) {
                        setPushError(e?.friendlyMessage || (e as Error)?.message || "Ошибка настройки push");
                      } finally {
                        setPushBusy(false);
                      }
                    }}
                  >
                    {pushBusy ? "Подождите…" : pushEnabled ? "Выключить" : "Включить"}
                  </Button>
                </div>
                {pushError && <div className="mt-2 text-xs text-red-600">{pushError}</div>}
                {isIOS && !isStandalone && (
                  <div className="mt-2 text-xs text-muted">
                    Добавьте приложение на экран «Домой», иначе push не работают на iOS.
                  </div>
                )}
              </div>
            )}

            <hr className="my-6 border-subtle" />

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
                    alert(e?.friendlyMessage || "Не удалось изменить пароль");
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
