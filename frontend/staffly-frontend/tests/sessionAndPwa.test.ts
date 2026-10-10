import assert from "node:assert/strict";
import test from "node:test";
import { build } from "esbuild";
import { fileURLToPath } from "node:url";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) {
    return this.values.get(key) ?? null;
  }
  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
  removeItem(key: string) {
    this.values.delete(key);
  }
}

const root = fileURLToPath(new URL("../", import.meta.url));
let caseNumber = 0;
async function bundle(source: string, define: Record<string, string> = {}) {
  const result = await build({
    stdin: { contents: source, resolveDir: root, sourcefile: "regression.ts", loader: "ts" },
    bundle: true,
    platform: "node",
    format: "esm",
    write: false,
    banner: {
      js: `import { createRequire } from "node:module"; const require = createRequire(${JSON.stringify(root + "package.json")});`,
    },
    define: {
      "import.meta.env": '{"DEV":false,"BASE_URL":"/","VITE_API_BASE_URL":""}',
      __APP_BUILD_ID__: '"old"',
      ...define,
    },
  });
  return import(
    `data:text/javascript;base64,${Buffer.from(result.outputFiles[0].text + `\n// case ${++caseNumber}`).toString("base64")}`
  );
}

function globals() {
  const storage = new MemoryStorage();
  const win = Object.assign(new EventTarget(), {
    location: { origin: "https://staffly.test", reload: () => {} },
    setTimeout,
    clearTimeout,
    setInterval: () => 0,
  });
  Object.defineProperty(globalThis, "window", { configurable: true, value: win });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: storage });
  Object.defineProperty(globalThis, "sessionStorage", { configurable: true, value: new MemoryStorage() });
  Object.defineProperty(globalThis, "document", {
    configurable: true,
    value: Object.assign(new EventTarget(), { visibilityState: "visible", activeElement: null }),
  });
  Object.defineProperty(globalThis, "HTMLElement", { configurable: true, value: class {} });
  let lock = Promise.resolve();
  Object.defineProperty(globalThis, "navigator", {
    configurable: true,
    value: {
      onLine: true,
      locks: {
        request: (_name: string, action: () => Promise<unknown>) => {
          const result = lock.then(action);
          lock = result.then(
            () => undefined,
            () => undefined,
          );
          return result;
        },
      },
    },
  });
  return { storage, win };
}

async function authModule(adapter: (config: any) => Promise<any>) {
  (globalThis as any).__testAdapter = adapter;
  return bundle(`
    import axios from "axios";
    axios.defaults.adapter = globalThis.__testAdapter;
    const client = await import("./src/shared/api/apiClient.ts");
    export const api = client.default;
    export const refresh = client.refreshSession;
    export const select = client.selectRestaurant;
    export const storage = await import("./src/shared/utils/storage.ts");
  `);
}

const response = (config: any, data: unknown) => ({ config, data, status: 200, statusText: "OK", headers: {} });
function rejection(config: any, status?: number) {
  return Object.assign(new Error("request failed"), { config, response: status ? { status } : undefined });
}

test("two tabs refresh a shared cookie once and both use the new token", async () => {
  const { storage } = globals();
  storage.setItem("accessToken", "old");
  let calls = 0;
  const adapter = async (config: any) => {
    calls++;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return response(config, { token: "new-with-restaurant" });
  };
  const tabA = await authModule(adapter);
  const tabB = await authModule(adapter);
  assert.deepEqual(await Promise.all([tabA.refresh(), tabB.refresh()]), ["new-with-restaurant", "new-with-restaurant"]);
  assert.equal(calls, 1);
});

test("network and server refresh failures preserve the token", async () => {
  for (const status of [undefined, 503]) {
    const { storage, win } = globals();
    storage.setItem("accessToken", "old");
    let logouts = 0;
    win.addEventListener("auth:logout", () => logouts++);
    const auth = await authModule(async (config) => {
      throw rejection(config, config.url.includes("refresh") ? status : 401);
    });
    await assert.rejects(auth.api.get("/api/me"));
    assert.equal(storage.getItem("accessToken"), "old");
    assert.equal(logouts, 0);
  }
});

test("older browsers serialize refresh through the storage lease", async () => {
  const { storage } = globals();
  delete (navigator as any).locks;
  storage.setItem("accessToken", "old");
  let calls = 0;
  const adapter = async (config: any) => {
    calls++;
    return response(config, { token: "fresh" });
  };
  const tabA = await authModule(adapter);
  const tabB = await authModule(adapter);
  await Promise.all([tabA.refresh(), tabB.refresh()]);
  assert.equal(calls, 1);
});

test("preMigration refresh supplies only a restaurant context hint", async () => {
  const { storage } = globals();
  const jwt = `header.${Buffer.from(JSON.stringify({ restaurantId: 12, roles: ["CREATOR"] })).toString("base64url")}.signature`;
  storage.setItem("accessToken", jwt);
  const auth = await authModule(async (config) => {
    assert.deepEqual(JSON.parse(config.data), { restaurantId: 12 });
    return response(config, { token: "fresh" });
  });
  await auth.refresh();
});

test("rejected refresh clears authentication", async () => {
  const { storage, win } = globals();
  storage.setItem("accessToken", "old");
  let logouts = 0;
  win.addEventListener("auth:logout", () => logouts++);
  const auth = await authModule(async (config) => {
    throw rejection(config, 401);
  });
  await assert.rejects(auth.api.get("/api/me"));
  assert.equal(storage.getItem("accessToken"), null);
  assert.equal(logouts, 1);
});

test("logout during refresh cannot resurrect the access token", async () => {
  const { storage } = globals();
  storage.setItem("accessToken", "old");
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  const auth = await authModule(async (config) => {
    await gate;
    return response(config, { token: "new" });
  });
  const pending = auth.refresh();
  await new Promise((resolve) => setTimeout(resolve, 0));
  auth.storage.clearToken();
  release();
  await assert.rejects(pending, /Session changed/);
  assert.equal(storage.getItem("accessToken"), null);
});

test("restaurant selection refreshes an expired token without deadlocking", async () => {
  const { storage } = globals();
  storage.setItem("accessToken", "expired");
  let attempts = 0;
  const auth = await authModule(async (config) => {
    if (config.url.includes("switch")) {
      if (attempts++ === 0) throw rejection(config, 401);
      return response(config, { token: "restaurant-token" });
    }
    return response(config, { token: "fresh" });
  });
  assert.equal(await auth.select(12), "restaurant-token");
  assert.equal(storage.getItem("accessToken"), "restaurant-token");
});

async function pwaFixture(waiting = false) {
  const { win } = globals();
  let reloads = 0;
  let checks = 0;
  win.location.reload = () => {
    reloads++;
  };
  const sw = Object.assign(new EventTarget(), { controller: {} });
  const worker = Object.assign(new EventTarget(), {
    state: "installed",
    postMessage: () => {
      sw.controller = {};
      sw.dispatchEvent(new Event("controllerchange"));
    },
  });
  const registration = Object.assign(new EventTarget(), {
    active: {},
    waiting: waiting ? worker : null,
    installing: null,
    update: async () => {
      checks++;
    },
  });
  Object.assign(sw, { register: async () => registration });
  Object.assign(navigator, { serviceWorker: sw });
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => ({ ok: true, json: async () => ({ buildId: "new" }) }),
  });
  const pwa = await bundle(
    `export * from "./src/shared/pwa/registerPwa.ts"; export * from "./src/shared/pwa/reloadSafety.ts";`,
  );
  return {
    pwa,
    worker,
    registration,
    sw,
    get reloads() {
      return reloads;
    },
    get checks() {
      return checks;
    },
  };
}

test("PWA checks at startup but does not block until assets are ready", async () => {
  const fixture = await pwaFixture();
  await fixture.pwa.registerPwa();
  assert.equal(fixture.checks, 1);
  assert.equal(fixture.pwa.getUpdateState().ready, false);
  assert.equal(fixture.pwa.getUpdateState().availableVersion, "new");
});

test("existing waiting update is offered, drafts save before activation and reload", async () => {
  const fixture = await pwaFixture(true);
  await fixture.pwa.registerPwa();
  assert.equal(fixture.pwa.getUpdateState().ready, true);
  let saved = false;
  fixture.pwa.registerReloadPreparation(() => {
    saved = true;
  });
  fixture.worker.postMessage = () => {
    assert.equal(saved, true);
    fixture.sw.dispatchEvent(new Event("controllerchange"));
  };
  await fixture.pwa.applyPwaUpdate();
  assert.equal(fixture.reloads, 1);
});

test("failed draft checkpoint prevents reload and permits a retry", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fixture = await pwaFixture(true);
  await fixture.pwa.registerPwa();
  const unregister = fixture.pwa.registerReloadPreparation(() => {
    throw new Error("quota exceeded");
  });
  await fixture.pwa.applyPwaUpdate();
  assert.equal(fixture.reloads, 0);
  assert.equal(fixture.pwa.getUpdateState().ready, true);
  assert.equal(fixture.pwa.getUpdateState().status, "error");
  unregister();
  await fixture.pwa.applyPwaUpdate();
  assert.equal(fixture.reloads, 1);
});

test("update in another tab requires this tab to checkpoint before reloading", async () => {
  const fixture = await pwaFixture();
  await fixture.pwa.registerPwa();
  fixture.sw.dispatchEvent(new Event("controllerchange"));
  assert.equal(fixture.reloads, 0);
  assert.equal(fixture.pwa.getUpdateState().ready, true);
  await fixture.pwa.applyPwaUpdate();
  assert.equal(fixture.reloads, 1);
});

test("reload drafts are isolated by user and restaurant and expire", async () => {
  const fixture = await pwaFixture();
  fixture.pwa.saveReloadDraft("schedule:7:12", { cellValues: { "1:2026-10-10": "10-20" } });
  assert.equal(fixture.pwa.takeReloadDraft("schedule:8:12"), null);
  assert.deepEqual(fixture.pwa.takeReloadDraft("schedule:7:12"), { cellValues: { "1:2026-10-10": "10-20" } });
  assert.equal(fixture.pwa.takeReloadDraft("schedule:7:12"), null);
  sessionStorage.setItem(
    "staffly:reload:expired",
    JSON.stringify({ savedAt: Date.now() - 25 * 60 * 60 * 1000, data: "old" }),
  );
  assert.equal(fixture.pwa.takeReloadDraft("expired"), null);
});

test("PWA registration retries after a temporary browser failure", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fixture = await pwaFixture(true);
  let attempts = 0;
  Object.assign(fixture.sw, {
    register: async () => {
      if (++attempts === 1) throw new Error("temporary registration failure");
      return fixture.registration;
    },
  });
  await fixture.pwa.registerPwa();
  assert.equal(attempts, 2);
  assert.equal(fixture.pwa.getUpdateState().ready, true);
});

test("the first installation never demands an update", async () => {
  const fixture = await pwaFixture(true);
  (fixture.registration as any).active = null;
  await fixture.pwa.registerPwa();
  assert.equal(fixture.pwa.getUpdateState().ready, false);
});

test("an unavailable version file does not prevent checking the service worker", async (t) => {
  t.mock.method(console, "warn", () => {});
  const fixture = await pwaFixture();
  Object.defineProperty(globalThis, "fetch", {
    configurable: true,
    value: async () => {
      throw new Error("version file unavailable");
    },
  });
  await fixture.pwa.registerPwa();
  assert.equal(fixture.checks, 1);
  assert.equal(fixture.pwa.getUpdateState().ready, false);
  assert.equal(fixture.pwa.getUpdateState().status, "error");
});

test("updates wait for a pending write before capturing drafts", async () => {
  const fixture = await pwaFixture(true);
  await fixture.pwa.registerPwa();
  let release!: () => void;
  let saved = false;
  fixture.pwa.trackMutation(
    new Promise<void>((resolve) => {
      release = resolve;
    }),
  );
  fixture.pwa.registerReloadPreparation(() => {
    saved = true;
  });
  const updating = fixture.pwa.applyPwaUpdate();
  await new Promise((resolve) => setTimeout(resolve, 5));
  assert.equal(fixture.reloads, 0);
  assert.equal(saved, false);
  release();
  await updating;
  assert.equal(saved, true);
  assert.equal(fixture.reloads, 1);
});
