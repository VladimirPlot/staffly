import { useEffect, useRef, useState } from "react";
import Button from "../../../shared/ui/Button";
import ImageCropperModal from "../../../shared/ui/ImageCropperModal";
import PhotoViewer from "../../../shared/ui/PhotoViewer";
import { prepareImagePair, PHOTO_SOURCE_MAX_BYTES } from "../../../shared/lib/imageCrop/prepareImagePair";
import type { PixelCrop } from "../../../shared/lib/imageCrop/types";
import { readDishwarePhoto, validateDishwarePhoto } from "../dishwarePhotoDraft";
import type { DishwareInventoryEditableItem } from "../dishwareInventoryItems";

export function useDishwarePhotoDialogs({
  items,
  readOnly,
  locked,
  onUpload,
  onDelete,
  onEditingChange,
}: {
  items: DishwareInventoryEditableItem[];
  readOnly: boolean;
  locked: boolean;
  onUpload: (clientId: string, file: File, originalFile?: File) => Promise<boolean | void>;
  onDelete: (clientId: string) => void;
  onEditingChange?: (editing: boolean) => void;
}) {
  const [source, setSource] = useState<{ clientId: string; url: string } | null>(null);
  const [viewer, setViewer] = useState<{ clientId: string; url: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [frameSize, setFrameSize] = useState(() => Math.min(260, Math.floor(window.innerWidth * 0.7 - 16)));
  const picker = useRef<HTMLInputElement>(null);
  const mounted = useRef(true);
  const session = useRef(0);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!source) return;
    return () => URL.revokeObjectURL(source.url);
  }, [source]);
  useEffect(() => {
    if (!viewer?.url.startsWith("blob:")) return;
    return () => URL.revokeObjectURL(viewer.url);
  }, [viewer]);
  useEffect(() => {
    onEditingChange?.(Boolean(source) || busy);
    return () => onEditingChange?.(false);
  }, [busy, onEditingChange, source]);
  useEffect(() => {
    const resize = () => setFrameSize(Math.min(260, Math.floor(window.innerWidth * 0.7 - 16)));
    window.addEventListener("resize", resize);
    return () => window.removeEventListener("resize", resize);
  }, []);
  useEffect(() => {
    if (source && (!items.some((item) => item.clientId === source.clientId) || readOnly)) setSource(null);
    if (viewer && !items.some((item) => item.clientId === viewer.clientId)) setViewer(null);
  }, [items, readOnly, source, viewer]);

  async function selectPhoto(clientId: string, file: File) {
    if (readOnly || busy) return;
    const selected = ++session.current;
    setError(null);
    try {
      await validateDishwarePhoto(file, PHOTO_SOURCE_MAX_BYTES);
      if (!mounted.current || selected !== session.current) return;
      setViewer(null);
      setSource({ clientId, url: URL.createObjectURL(file) });
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Не удалось выбрать фото");
    }
  }
  async function viewPhoto(clientId: string) {
    const row = items.find((item) => item.clientId === clientId);
    if (!row || row.removePhoto) return;
    const selected = ++session.current;
    setError(null);
    try {
      const file = row.pendingPhoto ? await readDishwarePhoto(row.pendingPhoto, true) : null;
      if (!mounted.current || selected !== session.current) return;
      const url = file ? URL.createObjectURL(file) : (row.originalPhotoUrl ?? row.photoUrl);
      if (url) setViewer({ clientId, url });
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Не удалось открыть фото");
    }
  }
  async function confirm(crop: PixelCrop) {
    if (!source || busy || readOnly) return;
    setBusy(true);
    setError(null);
    try {
      const pair = await prepareImagePair({
        imageSrc: source.url,
        crop,
        mimeType: "image/jpeg",
        previewWidth: 512,
        previewHeight: 512,
      });
      URL.revokeObjectURL(pair.previewUrl);
      if (!mounted.current) return;
      const accepted = await onUpload(source.clientId, pair.file, pair.originalFile);
      if (mounted.current && accepted !== false) setSource(null);
      else if (mounted.current) setError("Не удалось сохранить фото на устройстве. Повторите попытку.");
    } catch (err) {
      if (mounted.current) setError(err instanceof Error ? err.message : "Не удалось обработать фото");
    } finally {
      if (mounted.current) setBusy(false);
    }
  }
  const viewedItem = items.find((item) => item.clientId === viewer?.clientId);
  return {
    selectPhoto,
    viewPhoto,
    error: source || viewer ? null : error,
    dialogs: (
      <>
        <input
          type="file"
          accept="image/jpeg,image/png,image/webp"
          className="hidden"
          ref={picker}
          aria-label="Заменить открытое фото"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file && viewer) void selectPhoto(viewer.clientId, file);
            event.target.value = "";
          }}
        />
        {source && (
          <ImageCropperModal
            open
            title="Подготовить фото позиции"
            description={
              <>
                <span>Выберите область для миниатюры. Полное фото сохранится без обрезки для просмотра деталей.</span>
                {error && (
                  <p role="alert" className="mt-2 text-red-600">
                    {error}
                  </p>
                )}
              </>
            }
            imageUrl={source.url}
            frame={{ shape: "roundedRect", frameWidth: frameSize, frameHeight: frameSize, borderRadius: 16 }}
            busy={busy}
            onCancel={() => {
              setSource(null);
              setError(null);
            }}
            onConfirm={({ croppedAreaPixels }) => void confirm(croppedAreaPixels)}
          />
        )}
        {viewer && viewedItem && (
          <PhotoViewer
            key={viewer.url}
            url={viewer.url}
            title={viewedItem.name || "Фото позиции"}
            onClose={() => setViewer(null)}
            actions={
              !readOnly ? (
                <div className="flex flex-wrap gap-2">
                  {error && (
                    <p role="alert" className="w-full text-sm text-red-600">
                      {error}
                    </p>
                  )}
                  <Button variant="outline" disabled={locked} onClick={() => picker.current?.click()}>
                    Заменить фото
                  </Button>
                  <Button
                    variant="outline"
                    disabled={locked}
                    onClick={() => {
                      onDelete(viewer.clientId);
                      setViewer(null);
                    }}
                  >
                    Удалить фото
                  </Button>
                </div>
              ) : undefined
            }
          />
        )}
      </>
    ),
  };
}
