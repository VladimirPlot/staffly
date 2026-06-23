import Button from "../../../shared/ui/Button";
import Modal from "../../../shared/ui/Modal";
import type { PhotoPreview } from "../types";

type PhotoPreviewModalProps = {
  preview: PhotoPreview | null;
  onClose: () => void;
};

export default function PhotoPreviewModal({ preview, onClose }: PhotoPreviewModalProps) {
  return (
    <Modal
      open={Boolean(preview)}
      title={preview?.title ?? "Фото"}
      description={preview?.description}
      onClose={onClose}
      className="max-w-3xl"
      footer={
        <Button variant="outline" onClick={onClose}>
          Закрыть
        </Button>
      }
    >
      {preview && (
        <div className="bg-app rounded-2xl p-2">
          <img src={preview.url} alt={preview.title} className="max-h-[70dvh] w-full rounded-xl object-contain" />
        </div>
      )}
    </Modal>
  );
}
