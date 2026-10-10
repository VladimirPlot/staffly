// Refresh cookies are shared by all tabs. Serialize operations that change them.
export async function withSessionLock<T>(action: () => Promise<T>): Promise<T> {
  if (typeof navigator !== "undefined" && navigator.locks) {
    return navigator.locks.request("staffly:auth-session", action);
  }
  // Older browsers lack Web Locks. Use a renewable lease instead of letting
  // tabs rotate the same cookie concurrently.
  const key = "staffly:auth-lock";
  const owner = crypto.randomUUID();
  const read = (): { owner: string; until: number } | null => {
    try {
      return JSON.parse(localStorage.getItem(key) ?? "null");
    } catch {
      return null;
    }
  };
  const claim = () => localStorage.setItem(key, JSON.stringify({ owner, until: Date.now() + 30_000 }));
  const deadline = Date.now() + 45_000;
  while (true) {
    if (Date.now() > deadline) throw new Error("Session synchronization timed out");
    const current = read();
    if (!current || current.until < Date.now()) {
      claim();
      await new Promise((resolve) => setTimeout(resolve, 30));
      if (read()?.owner === owner) break;
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  const timer = setInterval(() => {
    if (read()?.owner === owner) claim();
  }, 10_000);
  try {
    return await action();
  } finally {
    clearInterval(timer);
    if (read()?.owner === owner) localStorage.removeItem(key);
  }
}

export function isSessionRejected(error: unknown): boolean {
  return (error as { response?: { status?: number } })?.response?.status === 401;
}
