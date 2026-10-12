import { useState } from "react";
import Modal from "../../../shared/ui/Modal";
import Button from "../../../shared/ui/Button";

export default function KnowledgePhotoViewer({
  url,
  title,
  onClose,
}: {
  url: string;
  title: string;
  onClose: () => void;
}) {
  const [failed, setFailed] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [retry, setRetry] = useState(0);
  return (
    <Modal
      open
      title={title}
      onClose={onClose}
      className="max-w-5xl"
      footer={
        <>
          <Button variant="outline" disabled={failed} onClick={() => setExpanded(!expanded)}>
            {expanded ? "Вписать в окно" : "Масштаб 100%"}
          </Button>
          <Button onClick={onClose}>Закрыть</Button>
        </>
      }
    >
      <div className="bg-app flex max-h-[65dvh] min-h-40 overflow-auto rounded-xl">
        {failed ? (
          <div className="text-muted m-auto space-y-3 p-6 text-center">
            <p>Не удалось загрузить фото.</p>
            <Button
              variant="outline"
              onClick={() => {
                setFailed(false);
                setRetry(retry + 1);
              }}
            >
              Повторить
            </Button>
          </div>
        ) : (
          <img
            key={retry}
            src={url}
            alt={title}
            onError={() => setFailed(true)}
            className={
              expanded ? "m-auto max-w-none shrink-0 self-start" : "m-auto max-h-[65dvh] w-full object-contain"
            }
          />
        )}
      </div>
    </Modal>
  );
}
