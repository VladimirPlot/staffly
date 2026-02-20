import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Avatar from "../../../shared/ui/Avatar";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ImageCropperModal from "../../../shared/ui/ImageCropperModal";
import {
  changeMyPassword,
  deleteMyAvatar,
  getMyProfile,
  updateMyProfile,
  uploadMyAvatar,
  type UserProfile,
} from "../api";
import { useAuth } from "../../../shared/providers/AuthProvider";
import { base64UrlToArrayBuffer, getVapidPublicKey, subscribePush, subscriptionToDto, unsubscribePush } from "../../push/api";
import { applyThemeToDom, getStoredTheme, setStoredTheme, type Theme } from "../../../shared/utils/theme";
import { isAvatarMimeType } from "../utils/avatarCrop";
import { toAbsoluteUrl } from "../../../shared/utils/url";
import { exportCroppedImageToFile } from "../../../shared/lib/imageCrop/canvasExport";
import { pickOutputMimeType, supportsWebp } from "../../../shared/lib/imageCrop/mime";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const CROP_SIZE = 280;

type UploadAvatarBlockProps = {
  currentAvatarUrl?: string;
  onUploaded: () => Promise<void>;
};

function UploadAvatarBlock({ currentAvatarUrl, onUploaded }: UploadAvatarBlockProps) {
  const [busy, setBusy] = React.useState(false);
  const [deleteBusy, setDeleteBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [cropModalOpen, setCropModalOpen] = React.useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = React.useState(false);
  const [sourceImageUrl, setSourceImageUrl] = React.useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement | null>(null);
  const selectedFileRef = React.useRef<File | null>(null);

  React.useEffect(() => {
    setPreviewUrl(currentAvatarUrl ?? null);
  }, [currentAvatarUrl]);

  React.useEffect(() => {
    return () => {
      if (sourceImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImageUrl);
      }
    };
  }, [sourceImageUrl]);

  const resetCropModal = React.useCallback(() => {
    if (sourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImageUrl);
    }
    setCropModalOpen(false);
    setSourceImageUrl(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  }, [sourceImageUrl]);

  const onFileSelected = React.useCallback((file: File | null) => {
    if (!file) return;
    setError(null);

    if (!isAvatarMimeType(file.type)) {
      setError("Разрешены только JPEG, PNG или WEBP");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      setError("Файл больше 5MB");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (sourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImageUrl);
    }

    selectedFileRef.current = file;
    setSourceImageUrl(URL.createObjectURL(file));
    setCropModalOpen(true);
  }, [sourceImageUrl]);

  const handleSaveCroppedAvatar = React.useCallback(async (croppedAreaPixels: { x: number; y: number; width: number; height: number }) => {
    if (!sourceImageUrl || !selectedFileRef.current) return;

    setBusy(true);
    setError(null);

    try {
      const { file, previewUrl: nextPreview } = await exportCroppedImageToFile({
        imageSrc: sourceImageUrl,
        crop: croppedAreaPixels,
        exportOptions: {
          outputWidth: 512,
          outputHeight: 512,
          mimeType: pickOutputMimeType({
            supportsWebp: supportsWebp(),
            backendAllowsWebp: true,
            fallback: "image/png",
          }),
          quality: 0.92,
          baseFileName: selectedFileRef.current.name,
        },
      });

      const { avatarUrl } = await uploadMyAvatar(file);
      setPreviewUrl(nextPreview);
      await onUploaded();
      setPreviewUrl(toAbsoluteUrl(avatarUrl) ?? nextPreview);
      resetCropModal();
      alert("Аватар обновлён");
    } catch (e: any) {
      setError(e?.friendlyMessage || e?.message || "Не удалось обновить аватар");
    } finally {
      setBusy(false);
    }
  }, [onUploaded, resetCropModal, sourceImageUrl]);

  const handleDeleteAvatar = React.useCallback(async () => {
    setDeleteBusy(true);
    setError(null);
    try {
      await deleteMyAvatar();
      setDeleteConfirmOpen(false);
      setPreviewUrl(null);
      await onUploaded();
    } catch (e: any) {
      setError(e?.friendlyMessage || e?.message || "Не удалось удалить аватар");
    } finally {
      setDeleteBusy(false);
    }
  }, [onUploaded]);

  return (
    <div className="rounded-2xl border border-subtle p-4">
      <div className="mb-2 text-sm font-medium">Аватар</div>
      <div className="mb-3 text-xs text-muted">Разрешены: JPEG, PNG, WEBP. Максимум 5MB.</div>

      {previewUrl && (
        <div className="mb-3">
          <img src={previewUrl} alt="Аватар" className="h-20 w-20 rounded-full border border-subtle object-cover" />
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/jpg,image/png,image/webp"
        className="hidden"
        onChange={(e) => onFileSelected(e.currentTarget.files?.[0] ?? null)}
      />

      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={busy || deleteBusy}>
          Выбрать файл
        </Button>
        <Button type="button" variant="ghost" onClick={() => setDeleteConfirmOpen(true)} disabled={!previewUrl || busy || deleteBusy}>
          Удалить аватар
        </Button>
      </div>

      {error && <div className="mt-2 text-xs text-red-600">{error}</div>}

      <ImageCropperModal
        open={cropModalOpen}
        title="Предпросмотр аватара"
        description="Перетащите фото и выберите масштаб"
        imageUrl={sourceImageUrl}
        frame={{ shape: "circle", frameWidth: CROP_SIZE, frameHeight: CROP_SIZE }}
        busy={busy}
        onCancel={resetCropModal}
        onConfirm={({ croppedAreaPixels }) => void handleSaveCroppedAvatar(croppedAreaPixels)}
      />

      <ConfirmDialog
        open={deleteConfirmOpen}
        title="Удалить аватар?"
        description="Это действие нельзя отменить."
        confirmText="Удалить"
        cancelText="Отмена"
        confirming={deleteBusy}
        onCancel={() => setDeleteConfirmOpen(false)}
        onConfirm={handleDeleteAvatar}
      />
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
  const [theme, setTheme] = React.useState<Theme>(getStoredTheme() ?? "light");
  const [themeBusy, setThemeBusy] = React.useState(false);
  const [themeMsg, setThemeMsg] = React.useState<string | null>(null);

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
        if (p.theme === "light" || p.theme === "dark") {
          setTheme(p.theme);
          setStoredTheme(p.theme);
          applyThemeToDom(p.theme);
        }
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

  const onChangeTheme = async (next: Theme) => {
    setTheme(next);
    setThemeMsg(null);
    setStoredTheme(next);
    applyThemeToDom(next);
    setThemeBusy(true);
    try {
      await updateMyProfile({ theme: next });
      await refreshMe();
    } catch {
      setThemeMsg("Сервер недоступен — тема сохранена локально и синхронизируется позже");
    } finally {
      setThemeBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-xl">
      <Card>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-xl font-semibold">Профиль</h2>
          <Button variant="outline" onClick={() => navigate("/restaurants")}>Закрыть</Button>
        </div>

        {/* Текущий аватар */}
        <div className="mb-4 flex items-center gap-3">
          <Avatar name={user?.name || "Пользователь"} imageUrl={user?.avatarUrl} />
          <div className="text-sm text-muted">
            {user?.avatarUrl ? "Аватар загружен" : "Аватар не загружен"}
          </div>
        </div>

        {/* Загрузка нового аватара */}
        <UploadAvatarBlock currentAvatarUrl={user?.avatarUrl} onUploaded={refreshMe} />

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

            <div className="mb-2 text-sm font-medium">Тема</div>
            <div className="rounded-2xl border border-subtle p-4">
              <div className="flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    value="light"
                    checked={theme === "light"}
                    onChange={() => onChangeTheme("light")}
                    disabled={themeBusy}
                  />
                  <span>Светлая</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="theme"
                    value="dark"
                    checked={theme === "dark"}
                    onChange={() => onChangeTheme("dark")}
                    disabled={themeBusy}
                  />
                  <span>Тёмная</span>
                </label>
              </div>
              {themeMsg && <div className="mt-2 text-xs text-amber-700">{themeMsg}</div>}
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
            <div className="mb-2 text-sm font-medium">Сменить пароль</div>
            <div className="rounded-2xl border border-subtle p-4 grid gap-3">
              <Input
                label="Текущий пароль"
                type="password"
                value={currPass}
                onChange={(e) => setCurrPass(e.target.value)}
              />
              <Input
                label="Новый пароль"
                type="password"
                value={newPass}
                onChange={(e) => setNewPass(e.target.value)}
              />

              {pwdMsg && <div className="text-sm text-emerald-700">{pwdMsg}</div>}

              <div className="flex gap-2">
                <Button
                  onClick={async () => {
                    try {
                      setPwdBusy(true);
                      setPwdMsg(null);
                      await changeMyPassword({ currentPassword: currPass, newPassword: newPass });
                      setPwdMsg("Пароль изменён");
                      setCurrPass("");
                      setNewPass("");
                    } catch (e: any) {
                      alert(e?.friendlyMessage || "Не удалось сменить пароль");
                    } finally {
                      setPwdBusy(false);
                    }
                  }}
                  disabled={pwdBusy || !currPass || !newPass}
                >
                  {pwdBusy ? "Сохраняем…" : "Обновить пароль"}
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
