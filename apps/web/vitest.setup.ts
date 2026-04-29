// Setup runs in every vitest worker. The @testing-library/jest-dom matchers
// and the @testing-library/react cleanup hook only make sense under jsdom
// (where there is a `document`). Guard so Node-environment workers don't
// import jsdom-only modules.
//
// `export {}` makes this an ES module so top-level await is permitted
// under TS-strict isolated-module checking (Next.js build path).
export {};

if (typeof document !== "undefined") {
  await import("@testing-library/jest-dom/vitest");
  const { afterEach } = await import("vitest");
  const { cleanup } = await import("@testing-library/react");
  afterEach(() => {
    cleanup();
  });
}
