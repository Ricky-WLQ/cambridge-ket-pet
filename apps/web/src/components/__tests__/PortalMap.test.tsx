// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortalMap, type ModeChip } from "../PortalMap";

const sampleChips: ModeChip[] = [
  {
    mode: "reading",
    label: "📖 读",
    href: "/ket/reading/new",
    region: { top: "38%", left: "3%", width: "29%", height: "32%" },
  },
  {
    mode: "listening",
    label: "🎧 听",
    href: "/ket/listening/new",
    region: { top: "12%", left: "52%", width: "25%", height: "30%" },
    active: true,
  },
];

describe("<PortalMap>", () => {
  it("renders KET map for portal=ket", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const img = container.querySelector("img");
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/maps/ket-island.png",
    );
  });

  it("renders PET map for portal=pet", () => {
    const { container } = render(
      <PortalMap portal="pet" chips={sampleChips} />,
    );
    const img = container.querySelector("img");
    expect(decodeURIComponent(img?.getAttribute("src") ?? "")).toContain(
      "/maps/pet-city.png",
    );
  });

  it("each chip is a click-region link with the building bounding box", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);

    // First link (reading) should have the reading bounding box.
    const readingLink = links[0] as HTMLAnchorElement;
    expect(readingLink.getAttribute("href")).toBe("/ket/reading/new");
    expect(readingLink.style.top).toBe("38%");
    expect(readingLink.style.left).toBe("3%");
    expect(readingLink.style.width).toBe("29%");
    expect(readingLink.style.height).toBe("32%");
    expect(readingLink.getAttribute("aria-label")).toBe("📖 读");
  });

  it("active chip label uses the inverted ink-black variant", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const labels = container.querySelectorAll("a > span:last-child");
    // First chip is inactive, second is active.
    expect(labels[0].className).toContain("bg-white/95");
    expect(labels[1].className).toContain("bg-ink");
  });
});
