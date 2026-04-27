import { useCallback, useEffect, useMemo, useState } from "react";
import Button from "../../../../shared/ui/Button";
import Modal from "../../../../shared/ui/Modal";
import SelectField from "../../../../shared/ui/SelectField";
import {
  changeCertificationExamOwner,
  getCertificationExamOwnerCandidates,
} from "../../api/trainingApi";
import type { CertificationOwnerCandidateDto, TrainingExamDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";
import ErrorState from "../ErrorState";
import LoadingState from "../LoadingState";

type Props = {
  exam: TrainingExamDto | null;
  restaurantId: number;
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

export default function ChangeCertificationOwnerModal({ exam, restaurantId, open, onClose, onSaved }: Props) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<CertificationOwnerCandidateDto[]>([]);
  const [selectedOwnerUserId, setSelectedOwnerUserId] = useState<string>("");
  const [currentOwnerFullName, setCurrentOwnerFullName] = useState<string | null>(null);

  const ownerName = (currentOwnerFullName ?? exam?.ownerFullName ?? null)?.trim();

  const selectedCandidate = useMemo(
    () => candidates.find((candidate) => String(candidate.userId) === selectedOwnerUserId) ?? null,
    [candidates, selectedOwnerUserId],
  );

  const loadCandidates = useCallback(async () => {
    if (!open || !exam) {
      setCandidates([]);
      setSelectedOwnerUserId("");
      setCurrentOwnerFullName(null);
      return;
    }

    setError(null);
    setCandidates([]);
    setSelectedOwnerUserId("");
    setCurrentOwnerFullName(null);

    setLoading(true);
    try {
      const options = await getCertificationExamOwnerCandidates(restaurantId, exam.id);
      const nextCandidates = options.candidates;
      setCurrentOwnerFullName(options.currentOwnerFullName ?? null);
      setCandidates(nextCandidates);

      if (nextCandidates.length > 0) {
        const firstCandidate = nextCandidates[0];
        if (firstCandidate) {
          setSelectedOwnerUserId(String(firstCandidate.userId));
        }
      }
    } catch (cause) {
      setError(getTrainingErrorMessage(cause, "Не удалось загрузить кандидатов для смены ответственного."));
    } finally {
      setLoading(false);
    }
  }, [exam, open, restaurantId]);

  useEffect(() => {
    void loadCandidates();
  }, [loadCandidates]);

  const handleSubmit = useCallback(async () => {
    if (!exam || !selectedOwnerUserId) {
      return;
    }

    setSaving(true);
    setError(null);
    try {
      await changeCertificationExamOwner(restaurantId, exam.id, Number(selectedOwnerUserId));
      await onSaved();
      onClose();
    } catch (cause) {
      setError(getTrainingErrorMessage(cause, "Не удалось сменить ответственного за аттестацию."));
    } finally {
      setSaving(false);
    }
  }, [exam, onClose, onSaved, restaurantId, selectedOwnerUserId]);

  const submitDisabled = !selectedCandidate || saving || loading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Сменить ответственного"
      footer={(
        <>
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Отмена
          </Button>
          <Button onClick={() => void handleSubmit()} isLoading={saving} disabled={submitDisabled}>
            Сохранить
          </Button>
        </>
      )}
    >
      <div className="space-y-4">
        <div className="text-sm text-muted">
          <span className="font-medium text-default">Текущий ответственный: </span>
          {ownerName && ownerName.length > 0 ? ownerName : "не назначен"}
        </div>

        {loading && <LoadingState label="Загрузка кандидатов..." />}

        {!loading && !error && candidates.length === 0 && (
          <div className="rounded-xl border border-subtle bg-surface-muted p-3 text-sm text-muted">
            Для этой аттестации пока нет доступных кандидатов для переназначения.
          </div>
        )}

        {!loading && candidates.length > 0 && (
          <SelectField
            label="Новый ответственный"
            value={selectedOwnerUserId}
            onChange={(event) => setSelectedOwnerUserId(event.target.value)}
          >
            {candidates.map((candidate) => (
              <option key={candidate.userId} value={candidate.userId}>
                {candidate.fullName}
                {candidate.positionName ? ` — ${candidate.positionName}` : ""}
              </option>
            ))}
          </SelectField>
        )}

        {error && <ErrorState message={error} onRetry={() => void loadCandidates()} />}
      </div>
    </Modal>
  );
}
