import { describe, it, expect } from "vitest";
import { derivePortalFromPathname } from "../derivePortalFromPathname";

describe("derivePortalFromPathname", () => {
  it("returns 'ket' for /ket and /ket/*", () => {
    expect(derivePortalFromPathname("/ket")).toBe("ket");
    expect(derivePortalFromPathname("/ket/listening/new")).toBe("ket");
  });

  it("returns 'pet' for /pet and /pet/*", () => {
    expect(derivePortalFromPathname("/pet")).toBe("pet");
    expect(derivePortalFromPathname("/pet/speaking/runner/abc")).toBe("pet");
  });

  it("returns the default 'ket' for non-portal routes", () => {
    expect(derivePortalFromPathname("/")).toBe("ket");
    expect(derivePortalFromPathname("/login")).toBe("ket");
    expect(derivePortalFromPathname("/diagnose")).toBe("ket");
    expect(derivePortalFromPathname("/teacher/classes")).toBe("ket");
  });
});
