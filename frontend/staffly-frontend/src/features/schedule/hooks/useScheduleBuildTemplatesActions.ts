import React from "react";

import {
  archiveScheduleBuildTemplate,
  createScheduleBuildTemplate,
  listScheduleBuildTemplates,
  type SaveScheduleBuildTemplateRequest,
  type ScheduleBuildTemplateDto,
  updateScheduleBuildTemplate,
} from "../api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

export default function useScheduleBuildTemplatesActions(restaurantId: number | null) {
  const [templates, setTemplates] = React.useState<ScheduleBuildTemplateDto[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [deletingId, setDeletingId] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  const loadTemplates = React.useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await listScheduleBuildTemplates(restaurantId);
      setTemplates(data);
    } catch (e: unknown) {
      setError(getFriendlyScheduleErrorMessage(e, "Не удалось загрузить шаблоны сборки"));
    } finally {
      setLoading(false);
    }
  }, [restaurantId]);

  const createTemplate = React.useCallback(
    async (request: SaveScheduleBuildTemplateRequest): Promise<ScheduleBuildTemplateDto | null> => {
      if (!restaurantId) return null;
      setSaving(true);
      setError(null);
      try {
        const created = await createScheduleBuildTemplate(restaurantId, request);
        setTemplates((prev) => [created, ...prev]);
        return created;
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось создать шаблон"));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [restaurantId],
  );

  const updateTemplate = React.useCallback(
    async (templateId: number, request: SaveScheduleBuildTemplateRequest): Promise<ScheduleBuildTemplateDto | null> => {
      if (!restaurantId) return null;
      setSaving(true);
      setError(null);
      try {
        const updated = await updateScheduleBuildTemplate(restaurantId, templateId, request);
        setTemplates((prev) => prev.map((item) => (item.id === templateId ? updated : item)));
        return updated;
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось обновить шаблон"));
        return null;
      } finally {
        setSaving(false);
      }
    },
    [restaurantId],
  );

  const archiveTemplate = React.useCallback(
    async (templateId: number): Promise<boolean> => {
      if (!restaurantId) return false;
      setDeletingId(templateId);
      setError(null);
      try {
        await archiveScheduleBuildTemplate(restaurantId, templateId);
        setTemplates((prev) => prev.filter((item) => item.id !== templateId));
        return true;
      } catch (e: unknown) {
        setError(getFriendlyScheduleErrorMessage(e, "Не удалось архивировать шаблон"));
        return false;
      } finally {
        setDeletingId(null);
      }
    },
    [restaurantId],
  );

  React.useEffect(() => {
    setTemplates([]);
    setLoading(false);
    setSaving(false);
    setDeletingId(null);
    setError(null);
  }, [restaurantId]);

  return {
    templates,
    loading,
    error,
    saving,
    deletingId,
    loadTemplates,
    createTemplate,
    updateTemplate,
    archiveTemplate,
  };
}
