import React from "react";
import { useNavigate } from "react-router-dom";
import Card from "../../../shared/ui/Card";
import Button from "../../../shared/ui/Button";
import Input from "../../../shared/ui/Input";
import Avatar from "../../../shared/ui/Avatar";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Modal from "../../../shared/ui/Modal";
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
import { getCroppedAvatarFile, isAvatarMimeType, type PixelCrop } from "../utils/avatarCrop";
import { toAbsoluteUrl } from "../../../shared/utils/url";

const MAX_AVATAR_SIZE_BYTES = 5 * 1024 * 1024;
const CROP_SIZE = 280;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.05;

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
  const [imageNaturalSize, setImageNaturalSize] = React.useState<{ width: number; height: number } | null>(null);

  const [crop, setCrop] = React.useState({ x: 0, y: 0 });
  const [zoom, setZoom] = React.useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = React.useState<PixelCrop | null>(null);

  const dragStateRef = React.useRef<{ pointerId: number; startX: number; startY: number; originX: number; originY: number } | null>(null);
  const cropAreaRef = React.useRef<HTMLDivElement | null>(null);
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

  const baseScale = React.useMemo(() => {
    if (!imageNaturalSize) return 1;
    return Math.max(CROP_SIZE / imageNaturalSize.width, CROP_SIZE / imageNaturalSize.height);
  }, [imageNaturalSize]);

  const minZoom = 1;
  const effectiveScale = baseScale * zoom;

  const maxOffsets = React.useMemo(() => {
    if (!imageNaturalSize) return { x: 0, y: 0 };
    const scaledWidth = imageNaturalSize.width * effectiveScale;
    const scaledHeight = imageNaturalSize.height * effectiveScale;
    return {
      x: Math.max(0, (scaledWidth - CROP_SIZE) / 2),
      y: Math.max(0, (scaledHeight - CROP_SIZE) / 2),
    };
  }, [effectiveScale, imageNaturalSize]);

  const clampCrop = React.useCallback((nextCrop: { x: number; y: number }) => ({
    x: Math.min(maxOffsets.x, Math.max(-maxOffsets.x, nextCrop.x)),
    y: Math.min(maxOffsets.y, Math.max(-maxOffsets.y, nextCrop.y)),
  }), [maxOffsets.x, maxOffsets.y]);

  React.useEffect(() => {
    setCrop((prev) => clampCrop(prev));
  }, [clampCrop]);

  React.useEffect(() => {
    if (!imageNaturalSize) {
      setCroppedAreaPixels(null);
      return;
    }
    const cropWidth = CROP_SIZE / effectiveScale;
    const cropHeight = CROP_SIZE / effectiveScale;
    const centeredX = (imageNaturalSize.width - cropWidth) / 2;
    const centeredY = (imageNaturalSize.height - cropHeight) / 2;
    const x = centeredX - crop.x / effectiveScale;
    const y = centeredY - crop.y / effectiveScale;
    setCroppedAreaPixels({
      x: Math.max(0, Math.min(imageNaturalSize.width - cropWidth, x)),
      y: Math.max(0, Math.min(imageNaturalSize.height - cropHeight, y)),
      width: cropWidth,
      height: cropHeight,
    });
  }, [crop.x, crop.y, effectiveScale, imageNaturalSize]);

  const resetCropModal = React.useCallback(() => {
    if (sourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImageUrl);
    }
    setCropModalOpen(false);
    setSourceImageUrl(null);
    setImageNaturalSize(null);
    selectedFileRef.current = null;
    dragStateRef.current = null;
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
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
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setImageNaturalSize(null);
  }, [sourceImageUrl]);

  const updateZoom = React.useCallback((nextZoom: number) => {
    setZoom(Math.min(MAX_ZOOM, Math.max(minZoom, nextZoom)));
  }, []);

  const handleSaveCroppedAvatar = React.useCallback(async () => {
    if (!sourceImageUrl || !croppedAreaPixels || !selectedFileRef.current) return;

    setBusy(true);
    setError(null);

    try {
      const { file, previewUrl: nextPreview } = await getCroppedAvatarFile({
        imageSrc: sourceImageUrl,
        croppedAreaPixels,
        outputSize: 512,
        baseFileName: selectedFileRef.current.name,
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
  }, [croppedAreaPixels, onUploaded, resetCropModal, sourceImageUrl]);

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

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (busy || !imageNaturalSize) return;
    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      originX: crop.x,
      originY: crop.y,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    const nextCrop = {
      x: dragState.originX + (event.clientX - dragState.startX),
      y: dragState.originY + (event.clientY - dragState.startY),
    };
    setCrop(clampCrop(nextCrop));
  };

  const handlePointerEnd = (event: React.PointerEvent<HTMLDivElement>) => {
    const dragState = dragStateRef.current;
    if (!dragState || dragState.pointerId !== event.pointerId) return;
    dragStateRef.current = null;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

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

      <Modal
        open={cropModalOpen}
        title="Предпросмотр аватара"
        description="Перетащите фото и выберите масштаб"
        onClose={() => {
          if (!busy) resetCropModal();
        }}
        className="max-w-lg"
        footer={(
          <div className="flex w-full gap-2">
            <Button type="button" variant="outline" className="flex-1" disabled={busy} onClick={resetCropModal}>Отмена</Button>
            <Button type="button" className="flex-1" disabled={busy || !croppedAreaPixels} onClick={handleSaveCroppedAvatar}>
              {busy ? "Сохраняем…" : "Сохранить"}
            </Button>
          </div>
        )}
      >
        <div className="flex flex-col gap-4">
          <div
            ref={cropAreaRef}
            className="relative mx-auto h-[min(70vw,360px)] w-[min(70vw,360px)] max-h-[360px] max-w-[360px] select-none overflow-hidden rounded-2xl bg-black/70"
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerEnd}
            onPointerCancel={handlePointerEnd}
          >
            {sourceImageUrl && (
              <>
                <img
                  src={sourceImageUrl}
                  alt="Предпросмотр"
                  draggable={false}
                  className="pointer-events-none absolute left-1/2 top-1/2 max-w-none"
                  style={{
                    width: imageNaturalSize ? `${imageNaturalSize.width}px` : "auto",
                    height: imageNaturalSize ? `${imageNaturalSize.height}px` : "auto",
                    transform: `translate(-50%, -50%) translate(${crop.x}px, ${crop.y}px) scale(${effectiveScale})`,
                    transformOrigin: "center center",
                  }}
                  onLoad={(event) => {
                    const img = event.currentTarget;
                    setImageNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
                  }}
                />
                <div className="pointer-events-none absolute inset-0 bg-black/45" />
                <div className="pointer-events-none absolute left-1/2 top-1/2 h-[280px] w-[280px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <Button type="button" variant="outline" size="icon" onClick={() => updateZoom(zoom - ZOOM_STEP)} disabled={busy || zoom <= minZoom}>–</Button>
            <input
              type="range"
              min={minZoom}
              max={MAX_ZOOM}
              step={ZOOM_STEP}
              value={zoom}
              onChange={(event) => updateZoom(Number(event.target.value))}
              disabled={busy}
              className="h-2 w-full cursor-pointer accent-[var(--staffly-text-strong)]"
              aria-label="Масштаб аватара"
            />
            <Button type="button" variant="outline" size="icon" onClick={() => updateZoom(zoom + ZOOM_STEP)} disabled={busy || zoom >= MAX_ZOOM}>+</Button>
          </div>
        </div>
      </Modal>

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
