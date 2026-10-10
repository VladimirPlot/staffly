type Preparation = () => void | Promise<void>;
const preparations = new Set<Preparation>();
const mutations = new Set<Promise<unknown>>();

export function registerReloadPreparation(prepare: Preparation): () => void {
  preparations.add(prepare);
  return () => {
    preparations.delete(prepare);
  };
}

export function trackMutation(promise: Promise<unknown>): void {
  mutations.add(promise);
  void promise.finally(() => mutations.delete(promise)).catch(() => undefined);
}

export async function prepareForReload(): Promise<void> {
  if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  let timer: number | undefined;
  try {
    await Promise.race([
      Promise.allSettled([...mutations]),
      new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("Saving timed out")), 20_000);
      }),
    ]);
  } finally {
    window.clearTimeout(timer);
  }
  await new Promise<void>((resolve) => window.setTimeout(resolve, 0));
  for (const prepare of preparations) await prepare();
}

export function saveReloadDraft(key: string, data: unknown): void {
  sessionStorage.setItem(`staffly:reload:${key}`, JSON.stringify({ savedAt: Date.now(), data }));
}

export function takeReloadDraft<T>(key: string): T | null {
  const storageKey = `staffly:reload:${key}`;
  const raw = sessionStorage.getItem(storageKey);
  if (!raw) return null;
  sessionStorage.removeItem(storageKey);
  try {
    const parsed = JSON.parse(raw);
    return Date.now() - parsed.savedAt < 24 * 60 * 60 * 1000 ? (parsed.data as T) : null;
  } catch {
    return null;
  }
}
