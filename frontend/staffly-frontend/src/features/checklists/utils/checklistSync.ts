type Versioned = { id: number; version: number };

export function mergeChecklistUpdate<T extends Versioned>(current: T[], updated: T): T[] {
  return current.map((item) => (item.id === updated.id && updated.version >= item.version ? updated : item));
}

export function mergeChecklistList<T extends Versioned>(current: T[], incoming: T[]): T[] {
  const byId = new Map(current.map((item) => [item.id, item]));
  return incoming.map((item) => {
    const existing = byId.get(item.id);
    return existing && existing.version > item.version ? existing : item;
  });
}
