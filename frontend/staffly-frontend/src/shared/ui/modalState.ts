import { useSyncExternalStore } from "react";

const openModals = new Set<string>();
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export function registerOpenModal(id: string) {
  openModals.add(id);
  notify();
  return () => {
    openModals.delete(id);
    notify();
  };
}

export function useAnyModalOpen() {
  return useSyncExternalStore(
    subscribe,
    () => openModals.size > 0,
    () => false,
  );
}
