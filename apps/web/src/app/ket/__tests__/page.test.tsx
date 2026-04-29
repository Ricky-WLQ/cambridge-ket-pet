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
  findCurrentWeekDiagnose: vi.fn(async () => ({
    readingStatus: "GRADED",
    listeningStatus: "SUBMITTED",
    writingStatus: "AUTO_SUBMITTED",
    speakingStatus: "IN_PROGRESS",
    vocabStatus: "NOT_STARTED",
    grammarStatus: "NOT_STARTED",
  })),
}));
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: () => ({ push: vi.fn() }),
}));
vi.mock("@/components/SiteHeader", () => ({ SiteHeader: () => null }));
vi.mock("@/components/student/AssignmentList", () => ({ default: () => null }));

describe("KET portal home", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders Leo greeting + KET 岛 map composite + 6 mode chip name-tags", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    // Leo greeting in the hero strip is a normal next/image <img>.
    expect(container.querySelector('img[alt="Leo"]')).toBeTruthy();

    // KET 岛 map composite is the SVG-wrapped div with role="img"
    // + aria-label. The empty island background <image> is inside.
    const mapWrapper = container.querySelector(
      'div[role="img"][aria-label="KET 岛"]',
    );
    expect(mapWrapper).toBeTruthy();
    expect(
      mapWrapper?.querySelector('image[href="/maps/ket-island-bg.png"]'),
    ).toBeTruthy();

    // 6 chip name-tag <Link>s for the 6 modes.
    const chipHrefs = Array.from(container.querySelectorAll("a"))
      .map((a) => a.getAttribute("href"))
      .filter(
        (h): h is string =>
          !!h &&
          /^\/ket\/(reading|writing|listening|speaking|vocab|grammar)/.test(h),
      );
    expect(new Set(chipHrefs).size).toBe(6);
  });

  it("week pill shows real completed-section count and links to /diagnose", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    // The mock has 3 sections in a done state (GRADED, SUBMITTED,
    // AUTO_SUBMITTED) out of 6. Real-data-only: pill should read 3/6.
    expect(container.textContent).toContain("本周诊断打卡 3/6");

    // Pill is a link to /diagnose.
    const pill = Array.from(container.querySelectorAll("a")).find((a) =>
      a.textContent?.includes("本周诊断打卡 3/6"),
    );
    expect(pill).toBeTruthy();
    expect(pill?.getAttribute("href")).toBe("/diagnose");
  });

  it("renders 0/6 when the user has no diagnose row this week", async () => {
    const eligibility = await import("@/lib/diagnose/eligibility");
    vi.mocked(eligibility.findCurrentWeekDiagnose).mockResolvedValueOnce(null);

    const Page = await KetPortalPage();
    const { container } = render(Page);
    expect(container.textContent).toContain("本周诊断打卡 0/6");
  });

  it("does not render fabricated UI (no TodayCard / streak / hardcoded stats)", async () => {
    const Page = await KetPortalPage();
    const { container } = render(Page);

    // No TodayCard CTA — title text was '来 5 道听力题' (fabricated).
    expect(container.textContent).not.toContain("来 5 道听力题");
    // No streak — '连打 7 天' was fabricated.
    expect(container.textContent).not.toContain("连打");
    // No hardcoded stats footer.
    expect(container.textContent).not.toContain("已练 84 词");
  });
});
