import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ImageCropperModal from "../../../shared/ui/ImageCropperModal";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { KNOWLEDGE_SOURCE_MAX_BYTES, prepareKnowledgeImages } from "../utils/knowledgeImages";
import {
  TRAINING_ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  pickOutputMimeType,
  supportsWebp,
} from "../../../shared/lib/imageCrop/mime";
import { toAbsoluteUrl } from "../../../shared/utils/url";
import { saveKnowledgeItem } from "../api/trainingApi";
import type { TrainingKnowledgeItemDto } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";
import { useTrainingEditorGuard } from "../hooks/useTrainingEditorGuard";

type KnowledgeItemModalProps = {
  open: boolean;
  mode: "create" | "edit";

  /**
   * ВАЖНО:
   * В разных местах проекта могли передавать карточку как `item`,
   * а раньше компонент ожидал `initialItem`.
   * Поддерживаем оба варианта, чтобы ничего не ломалось.
   */
  item?: TrainingKnowledgeItemDto;
  initialItem?: TrainingKnowledgeItemDto;

  folderId?: number | null;
  restaurantId: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function KnowledgeItemModal({
  open,
  mode,
  item,
  initialItem,
  folderId,
  restaurantId,
  onClose,
  onSaved,
}: KnowledgeItemModalProps) {
  const effectiveItem = item ?? initialItem ?? null;
  const effectiveItemRef = useRef(effectiveItem);
  effectiveItemRef.current = effectiveItem;

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [composition, setComposition] = useState("");
  const [allergens, setAllergens] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [originalFile, setOriginalFile] = useState<File | null>(null);
  const [removeImage, setRemoveImage] = useState(false);
  const [saveCommitted, setSaveCommitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [confirmDeleteImageOpen, setConfirmDeleteImageOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);
  const creationRequestId = useRef<string | null>(null);
  const busyRef = useRef(false);
  const sessionRef = useRef(0);
  const guard = useTrainingEditorGuard(open, loading || cropBusy, onClose);

  const hasImage = Boolean(imageUrl);

  useEffect(() => {
    if (!open) return;
    sessionRef.current += 1;
    creationRequestId.current = crypto.randomUUID();
    busyRef.current = false;
    const initial = effectiveItemRef.current;

    // При открытии модалки подставляем данные редактируемой карточки (если есть)
    setTitle(initial?.title ?? "");
    setDescription(initial?.description ?? "");
    setComposition(initial?.composition ?? "");
    setAllergens(initial?.allergens ?? "");
    setImageUrl(toAbsoluteUrl(initial?.imageUrl) ?? null);

    setCroppedFile(null);
    setOriginalFile(null);
    setRemoveImage(false);
    setSaveCommitted(false);
    setLoading(false);
    setCropOpen(false);
    setCropBusy(false);
    setSourceImageUrl(null);
    setConfirmDeleteImageOpen(false);
    selectedFileRef.current = null;
    if (fileInputRef.current) fileInputRef.current.value = "";
    setError(null);
    return () => {
      sessionRef.current += 1;
    };
  }, [open, mode, restaurantId, effectiveItem?.id]);

  useEffect(() => {
    return () => {
      if (sourceImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImageUrl);
      }
    };
  }, [sourceImageUrl]);

  useEffect(
    () => () => {
      if (imageUrl?.startsWith("blob:")) URL.revokeObjectURL(imageUrl);
    },
    [imageUrl],
  );

  const modalTitle = mode === "create" ? "Создать карточку" : "Редактировать карточку";

  const resetCropState = () => {
    if (sourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImageUrl);
    }
    setCropOpen(false);
    setCropBusy(false);
    setSourceImageUrl(null);
    selectedFileRef.current = null;
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSelectFile = (file: File | null) => {
    if (!file) return;
    setError(null);
    if (file.size > KNOWLEDGE_SOURCE_MAX_BYTES) {
      setError("Выберите фото до 20 МБ. Перед загрузкой оно будет автоматически уменьшено.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    if (!isAllowedMimeType(file.type, TRAINING_ALLOWED_MIME_TYPES)) {
      setError("Разрешены только файлы JPEG, PNG или WEBP.");
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
      return;
    }

    if (sourceImageUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(sourceImageUrl);
    }

    selectedFileRef.current = file;
    setSourceImageUrl(URL.createObjectURL(file));
    setCropOpen(true);
  };

  const handleConfirmCrop = async (croppedAreaPixels: { x: number; y: number; width: number; height: number }) => {
    if (!sourceImageUrl || !selectedFileRef.current) return;
    const session = sessionRef.current;
    setCropBusy(true);
    setError(null);

    try {
      const {
        file,
        originalFile: fullFile,
        previewUrl,
      } = await prepareKnowledgeImages({
        imageSrc: sourceImageUrl,
        crop: croppedAreaPixels,
        mimeType: pickOutputMimeType({
          supportsWebp: supportsWebp(),
          backendAllowsWebp: TRAINING_ALLOWED_MIME_TYPES.has("image/webp"),
          fallback: "image/jpeg",
        }),
      });

      if (session !== sessionRef.current) {
        URL.revokeObjectURL(previewUrl);
        return;
      }

      setCroppedFile(file);
      setOriginalFile(fullFile);
      setRemoveImage(false);
      setImageUrl(previewUrl);
      resetCropState();
    } catch (cropError) {
      if (session !== sessionRef.current) return;
      setError(getTrainingErrorMessage(cropError, "Не удалось обработать изображение."));
      setCropBusy(false);
    }
  };

  const handleDeleteImage = () => {
    guard.markDirty();
    setRemoveImage(Boolean(effectiveItem?.imageUrl));
    setImageUrl(null);
    setCroppedFile(null);
    setOriginalFile(null);
    setConfirmDeleteImageOpen(false);
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || busyRef.current || cropBusy || cropOpen) return;

    // Защита от ситуации: mode=edit, но карточку не передали
    if (mode === "edit" && !effectiveItem) {
      setError("Не удалось определить редактируемую карточку. Закройте окно и попробуйте снова.");
      return;
    }

    setLoading(true);
    busyRef.current = true;
    const session = sessionRef.current;
    let persisted = saveCommitted;
    setError(null);

    try {
      if (!saveCommitted) {
        const payload = {
          creationRequestId: creationRequestId.current!,
          itemId: mode === "edit" ? effectiveItem!.id : null,
          folderId: folderId === undefined ? (effectiveItem?.folderId ?? null) : folderId,
          title: trimmedTitle,
          description: description.trim() || null,
          composition: composition.trim() || null,
          allergens: allergens.trim() || null,
          removeImage,
        };
        const savedItem = await saveKnowledgeItem(restaurantId, payload, croppedFile, originalFile);
        if (session !== sessionRef.current) return;
        setImageUrl(toAbsoluteUrl(savedItem.imageUrl) ?? null);
        setCroppedFile(null);
        setOriginalFile(null);
        setRemoveImage(false);
        setSaveCommitted(true);
        guard.markSaved();
        persisted = true;
      }

      await onSaved();
      if (session !== sessionRef.current) return;
      onClose();
    } catch (submitError) {
      if (session !== sessionRef.current) return;
      setError(
        persisted
          ? "Карточка сохранена, но не удалось обновить список. Повторите обновление."
          : getTrainingErrorMessage(submitError, "Не удалось сохранить карточку."),
      );
    } finally {
      if (session === sessionRef.current) {
        setLoading(false);
        busyRef.current = false;
      }
    }
  };

  const imageActionLabel = useMemo(() => (hasImage ? "Изменить фото" : "Добавить фото"), [hasImage]);

  return (
    <>
      <Modal
        open={open}
        title={modalTitle}
        onClose={() => {
          guard.requestClose();
        }}
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={guard.requestClose} disabled={loading || cropBusy}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim() || cropBusy || cropOpen} isLoading={loading}>
              {saveCommitted ? "Обновить список" : "Сохранить"}
            </Button>
          </>
        }
      >
        <fieldset disabled={loading || saveCommitted} className="min-w-0 space-y-4" onChangeCapture={guard.markDirty}>
          {imageUrl && (
            <div className="border-subtle bg-app aspect-[16/10] overflow-hidden rounded-2xl border">
              <img src={imageUrl} alt="Фото карточки" className="h-full w-full object-cover" />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/jpg,image/png,image/webp"
              className="hidden"
              onChange={(event) => handleSelectFile(event.currentTarget.files?.[0] ?? null)}
            />
            <Button variant="outline" onClick={() => fileInputRef.current?.click()} disabled={loading}>
              {imageActionLabel}
            </Button>
            {hasImage && (
              <Button variant="outline" onClick={() => setConfirmDeleteImageOpen(true)} disabled={loading}>
                Удалить фото
              </Button>
            )}
          </div>

          <Input label="Название" value={title} onChange={(event) => setTitle(event.target.value)} required autoFocus />

          <label className="block min-w-0">
            <span className="text-muted mb-1 block text-sm">Описание (опционально)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="border-subtle bg-surface text-default focus:ring-default w-full max-w-full rounded-2xl border p-3 text-[16px] transition outline-none focus:ring-2 dark:[color-scheme:dark]"
            />
          </label>

          <label className="block min-w-0">
            <span className="text-muted mb-1 block text-sm">Состав (опционально)</span>
            <textarea
              value={composition}
              onChange={(event) => setComposition(event.target.value)}
              rows={3}
              className="border-subtle bg-surface text-default focus:ring-default w-full max-w-full rounded-2xl border p-3 text-[16px] transition outline-none focus:ring-2 dark:[color-scheme:dark]"
            />
          </label>

          <label className="block min-w-0">
            <span className="text-muted mb-1 block text-sm">Аллергены (опционально)</span>
            <textarea
              value={allergens}
              onChange={(event) => setAllergens(event.target.value)}
              rows={3}
              className="border-subtle bg-surface text-default focus:ring-default w-full max-w-full rounded-2xl border p-3 text-[16px] transition outline-none focus:ring-2 dark:[color-scheme:dark]"
            />
          </label>

          {error && (
            <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
          )}
        </fieldset>
        {saveCommitted && (
          <p className="text-muted mt-3 text-sm">Карточка сохранена. Если список не обновился, повторите обновление.</p>
        )}
      </Modal>
      {guard.discardDialog}

      <ImageCropperModal
        open={cropOpen}
        title="Обрезать фото карточки"
        description="Выберите область для превью. Полное фото сохранится без обрезки и будет автоматически уменьшено."
        imageUrl={sourceImageUrl}
        frame={{ shape: "rect", frameWidth: 320, frameHeight: 200, borderRadius: 16 }}
        busy={cropBusy}
        onCancel={resetCropState}
        onConfirm={({ croppedAreaPixels }) => void handleConfirmCrop(croppedAreaPixels)}
      />

      <ConfirmDialog
        open={confirmDeleteImageOpen}
        title="Удалить фото?"
        description="Фото будет удалено после сохранения карточки. Отмена редактирования сохранит прежнее фото."
        confirmText="Удалить"
        confirming={loading}
        onCancel={() => setConfirmDeleteImageOpen(false)}
        onConfirm={() => void handleDeleteImage()}
      />
    </>
  );
}
