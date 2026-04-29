// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import KetPortalPage from "../page";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(async () => ({ user: { id: "u1", role: "STUDENT" } })),
}));
vi.mock("@/lib/assignments", () => ({
  getStudentAssignments: vi.fn(async () => []),
}));
vi.mock("@/lib/diagnose/eligibility", () => ({
  requireUngated: vi.fn(async () => {}),
}));
vi.mock("next/navigation", () => ({ redirect: vi.fn() }));
vi.mock("@/components/SiteHeader", () => ({
  SiteHeader: () => null,
}));
vi.mock("@/components/student/AssignmentList", () => ({
  default: () => null,
}));

describe("KET portal home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Leo greeting + KET 岛 map + 6 mode chips", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    // Leo mascot in the hero strip.
    expect(container.querySelector('img[alt="Leo"]')).toBeTruthy();

    // KET 岛 map. (next/image rewrites src; alt is reliable.)
    expect(container.querySelector('img[alt="KET 岛"]')).toBeTruthy();

    // 6 mode chip links over the map.
    const chipHrefs = Array.from(container.querySelectorAll("a"))
      .map((a) => a.getAttribute("href"))
      .filter(
        (h): h is string =>
          !!h &&
          /^\/ket\/(reading|writing|listening|speaking|vocab|grammar)/.test(h),
      );
    expect(new Set(chipHrefs).size).toBe(6);
  });

  it("includes the today card CTA + streak footer", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    // Today card has 开始 → CTA.
    const todayLink = Array.from(container.querySelectorAll("a")).find(
      (a) => a.textContent?.includes("开始"),
    );
    expect(todayLink).toBeTruthy();

    // Streak label rendered with kid voice marker.
    expect(container.textContent).toContain("连打");
  });
});
