import React from "react";

import { createReplacement, createSwap } from "../api";
import { getFriendlyScheduleErrorMessage } from "../utils/errorMessages";

type ReplacementPayload = {
  day: string;
  toMemberId: number;
  reason?: string;
};

type SwapPayload = {
  myDay: string;
  targetMemberId: number;
  targetDay: string;
  reason?: string;
};

type UseScheduleShiftRequestDialogsParams = {
  restaurantId: number | null;
  scheduleId: number | null;
  onClearScheduleNotices: () => void;
  onSuccessMessage: (message: string) => void;
  onErrorMessage: (message: string) => void;
  onRefreshShiftRequests: () => Promise<void>;
};

export default function useScheduleShiftRequestDialogs({
  restaurantId,
  scheduleId,
  onClearScheduleNotices,
  onSuccessMessage,
  onErrorMessage,
  onRefreshShiftRequests,
}: UseScheduleShiftRequestDialogsParams) {
  const [replacementOpen, setReplacementOpen] = React.useState(false);
  const [swapOpen, setSwapOpen] = React.useState(false);

  const openReplacement = React.useCallback(() => {
    setReplacementOpen(true);
  }, []);

  const closeReplacement = React.useCallback(() => {
    setReplacementOpen(false);
  }, []);

  const openSwap = React.useCallback(() => {
    setSwapOpen(true);
  }, []);

  const closeSwap = React.useCallback(() => {
    setSwapOpen(false);
  }, []);

  const submitReplacement = React.useCallback(
    async (payload: ReplacementPayload) => {
      if (!restaurantId || !scheduleId) return;
      onClearScheduleNotices();
      try {
        await createReplacement(restaurantId, scheduleId, payload);
        onSuccessMessage("Заявка на замену отправлена");
        setReplacementOpen(false);
        await onRefreshShiftRequests();
      } catch (e: unknown) {
        onErrorMessage(getFriendlyScheduleErrorMessage(e, "Не удалось создать заявку на замену"));
      }
    },
    [onClearScheduleNotices, onErrorMessage, onRefreshShiftRequests, onSuccessMessage, restaurantId, scheduleId],
  );

  const submitSwap = React.useCallback(
    async (payload: SwapPayload) => {
      if (!restaurantId || !scheduleId) return;
      onClearScheduleNotices();
      try {
        await createSwap(restaurantId, scheduleId, payload);
        onSuccessMessage("Заявка на обмен отправлена");
        setSwapOpen(false);
        await onRefreshShiftRequests();
      } catch (e: unknown) {
        onErrorMessage(getFriendlyScheduleErrorMessage(e, "Не удалось создать заявку на обмен"));
      }
    },
    [onClearScheduleNotices, onErrorMessage, onRefreshShiftRequests, onSuccessMessage, restaurantId, scheduleId],
  );

  return {
    replacementOpen,
    swapOpen,
    openReplacement,
    closeReplacement,
    openSwap,
    closeSwap,
    submitReplacement,
    submitSwap,
  };
}
