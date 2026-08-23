import { useCallback, useEffect, useState } from "react";

import { getCertificationContainerCapabilities } from "../../api/trainingApi";
import type { CertificationContainerCapabilitiesDto } from "../../api/types";
import { getTrainingErrorMessage } from "../../utils/errors";

export function useCertificationContainerCapabilities({
  restaurantId,
  folderId,
  enabled,
}: {
  restaurantId: number | null;
  folderId: number | null;
  enabled: boolean;
}) {
  const [capabilities, setCapabilities] = useState<CertificationContainerCapabilitiesDto | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!restaurantId || !enabled) {
      setCapabilities(null);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      setCapabilities(await getCertificationContainerCapabilities(restaurantId, folderId));
    } catch (cause) {
      setCapabilities(null);
      setError(getTrainingErrorMessage(cause, "Не удалось проверить возможность изменения порядка."));
    } finally {
      setLoading(false);
    }
  }, [enabled, folderId, restaurantId]);

  useEffect(() => void reload(), [reload]);

  return { capabilities, loading, error, reload };
}
