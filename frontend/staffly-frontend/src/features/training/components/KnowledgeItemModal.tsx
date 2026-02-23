import { useEffect, useMemo, useRef, useState } from "react";
import Button from "../../../shared/ui/Button";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import ImageCropperModal from "../../../shared/ui/ImageCropperModal";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import { exportCroppedImageToFile } from "../../../shared/lib/imageCrop/canvasExport";
import {
  TRAINING_ALLOWED_MIME_TYPES,
  isAllowedMimeType,
  pickOutputMimeType,
  supportsWebp,
} from "../../../shared/lib/imageCrop/mime";
import { toAbsoluteUrl } from "../../../shared/utils/url";
import {
  createKnowledgeItem,
  deleteKnowledgeImage,
  updateKnowledgeItem,
  uploadKnowledgeImage,
} from "../api/trainingApi";
import type { TrainingKnowledgeItemDto } from "../api/types";
import { getTrainingErrorMessage } from "../utils/errors";

type KnowledgeItemModalProps = {
  open: boolean;
  mode: "create" | "edit";
  initialItem?: TrainingKnowledgeItemDto;
  folderId: number;
  restaurantId: number;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function KnowledgeItemModal({
  open,
  mode,
  initialItem,
  folderId,
  restaurantId,
  onClose,
  onSaved,
}: KnowledgeItemModalProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [composition, setComposition] = useState("");
  const [allergens, setAllergens] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [croppedFile, setCroppedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropBusy, setCropBusy] = useState(false);
  const [sourceImageUrl, setSourceImageUrl] = useState<string | null>(null);
  const [confirmDeleteImageOpen, setConfirmDeleteImageOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedFileRef = useRef<File | null>(null);

  const hasImage = Boolean(imageUrl);

  useEffect(() => {
    if (!open) return;
    setTitle(initialItem?.title ?? "");
    setDescription(initialItem?.description ?? "");
    setComposition(initialItem?.composition ?? "");
    setAllergens(initialItem?.allergens ?? "");
    setImageUrl(toAbsoluteUrl(initialItem?.imageUrl) ?? null);
    setCroppedFile(null);
    setError(null);
  }, [open, initialItem]);

  useEffect(() => {
    return () => {
      if (sourceImageUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(sourceImageUrl);
      }
    };
  }, [sourceImageUrl]);

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
    setCropBusy(true);
    setError(null);

    try {
      const { file, previewUrl } = await exportCroppedImageToFile({
        imageSrc: sourceImageUrl,
        crop: croppedAreaPixels,
        exportOptions: {
          outputWidth: 800,
          outputHeight: 500,
          mimeType: pickOutputMimeType({
            supportsWebp: supportsWebp(),
            backendAllowsWebp: TRAINING_ALLOWED_MIME_TYPES.has("image/webp"),
            fallback: "image/jpeg",
          }),
          quality: 0.9,
          baseFileName: selectedFileRef.current.name,
        },
      });
      setCroppedFile(file);
      setImageUrl(previewUrl);
      resetCropState();
    } catch (cropError) {
      setError(getTrainingErrorMessage(cropError, "Не удалось обработать изображение."));
      setCropBusy(false);
    }
  };

  const handleDeleteImage = async () => {
    if (mode === "create") {
      setImageUrl(null);
      setCroppedFile(null);
      setConfirmDeleteImageOpen(false);
      return;
    }

    if (!initialItem) return;
    setLoading(true);
    setError(null);
    try {
      await deleteKnowledgeImage(restaurantId, initialItem.id);
      setImageUrl(null);
      setCroppedFile(null);
      setConfirmDeleteImageOpen(false);
    } catch (deleteError) {
      setError(getTrainingErrorMessage(deleteError, "Не удалось удалить фото."));
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle || loading) return;

    setLoading(true);
    setError(null);

    try {
      const payload = {
        folderId,
        title: trimmedTitle,
        description: description.trim() || null,
        composition: composition.trim() || null,
        allergens: allergens.trim() || null,
      };

      const item =
        mode === "create"
          ? await createKnowledgeItem(restaurantId, payload)
          : await updateKnowledgeItem(restaurantId, initialItem!.id, payload);

      if (croppedFile) {
        const uploaded = await uploadKnowledgeImage(restaurantId, item.id, croppedFile);
        setImageUrl(toAbsoluteUrl(uploaded.imageUrl) ?? imageUrl);
        setCroppedFile(null);
      }

      await onSaved();
      onClose();
    } catch (submitError) {
      setError(getTrainingErrorMessage(submitError, "Не удалось сохранить карточку."));
    } finally {
      setLoading(false);
    }
  };

  const imageActionLabel = useMemo(() => (hasImage ? "Изменить фото" : "Добавить фото"), [hasImage]);

  return (
    <>
      <Modal
        open={open}
        title={modalTitle}
        onClose={() => {
          if (loading) return;
          onClose();
        }}
        className="max-w-xl"
        footer={
          <>
            <Button variant="outline" onClick={onClose} disabled={loading}>
              Отмена
            </Button>
            <Button onClick={handleSubmit} disabled={!title.trim()} isLoading={loading}>
              Сохранить
            </Button>
          </>
        }
      >
        <div className="space-y-4">
          {imageUrl && (
            <div className="border-subtle bg-app overflow-hidden rounded-2xl border aspect-[16/10]">
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
              <Button variant="ghost" onClick={() => setConfirmDeleteImageOpen(true)} disabled={loading}>
                Удалить фото
              </Button>
            )}
          </div>

          <Input
            label="Название"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            required
            autoFocus
          />

          <label className="block min-w-0">
            <span className="mb-1 block text-sm text-muted">Описание (опционально)</span>
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className="border-subtle bg-surface w-full max-w-full rounded-2xl border p-3 text-[16px] text-default outline-none transition focus:ring-2 focus:ring-default dark:[color-scheme:dark]"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-sm text-muted">Состав (опционально)</span>
            <textarea
              value={composition}
              onChange={(event) => setComposition(event.target.value)}
              rows={3}
              className="border-subtle bg-surface w-full max-w-full rounded-2xl border p-3 text-[16px] text-default outline-none transition focus:ring-2 focus:ring-default dark:[color-scheme:dark]"
            />
          </label>

          <label className="block min-w-0">
            <span className="mb-1 block text-sm text-muted">Аллергены (опционально)</span>
            <textarea
              value={allergens}
              onChange={(event) => setAllergens(event.target.value)}
              rows={3}
              className="border-subtle bg-surface w-full max-w-full rounded-2xl border p-3 text-[16px] text-default outline-none transition focus:ring-2 focus:ring-default dark:[color-scheme:dark]"
            />
          </label>

          {error && <div className="rounded-2xl border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
        </div>
      </Modal>

      <ImageCropperModal
        open={cropOpen}
        title="Обрезать фото карточки"
        description="Подгоните фото под формат карточки"
        imageUrl={sourceImageUrl}
        frame={{ shape: "rect", frameWidth: 320, frameHeight: 200, borderRadius: 16 }}
        busy={cropBusy}
        onCancel={resetCropState}
        onConfirm={({ croppedAreaPixels }) => void handleConfirmCrop(croppedAreaPixels)}
      />

      <ConfirmDialog
        open={confirmDeleteImageOpen}
        title="Удалить фото?"
        description="Фото будет удалено из карточки."
        confirmText="Удалить"
        confirming={loading}
        onCancel={() => setConfirmDeleteImageOpen(false)}
        onConfirm={() => void handleDeleteImage()}
      />
    </>
  );
}
