/**
 * Global test setup — runs before every test file.
 *
 * Stubs browser-only globals that may be imported transitively
 * (localStorage, fetch, import.meta.env) so pure-TS core code
 * can be tested in Node without a DOM.
 */

// Stub localStorage (used by GNewsProvider cache)
const store: Record<string, string> = {};
const localStorageMock = {
  getItem: (k: string) => store[k] ?? null,
  setItem: (k: string, v: string) => { store[k] = v; },
  removeItem: (k: string) => { delete store[k]; },
  clear: () => { for (const k in store) delete store[k]; },
};
Object.defineProperty(globalThis, "localStorage", { value: localStorageMock, writable: true });

// Stub fetch — tests that need real fetch mock it per-test with vi.stubGlobal
if (!("fetch" in globalThis)) {
  Object.defineProperty(globalThis, "fetch", {
    value: () => Promise.reject(new Error("fetch not mocked")),
    writable: true,
  });
}

// Stub import.meta.env for providers that read VITE_ variables
Object.defineProperty(globalThis, "import", {
  value: { meta: { env: {}, DEV: false } },
  writable: true,
});
