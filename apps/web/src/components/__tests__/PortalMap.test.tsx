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
    clipPath: "polygon(50% 0, 100% 30%, 100% 100%, 0 100%, 0 30%)",
  },
  {
    mode: "listening",
    label: "🎧 听",
    href: "/ket/listening/new",
    region: { top: "12%", left: "52%", width: "25%", height: "30%" },
    clipPath: "polygon(0 0, 100% 0, 100% 100%, 0 100%)",
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

  it("each chip renders 2 sibling links: building shape + name-tag", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    // 2 chips × 2 links each = 4 total.
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(4);

    // Both links per chip point to the same href.
    expect(links[0].getAttribute("href")).toBe("/ket/reading/new");
    expect(links[1].getAttribute("href")).toBe("/ket/reading/new");
    expect(links[2].getAttribute("href")).toBe("/ket/listening/new");
    expect(links[3].getAttribute("href")).toBe("/ket/listening/new");
  });

  it("primary (building-shape) link applies clip-path; name-tag has aria-hidden", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const wrapper = container.querySelectorAll("a");
    const buildingLink = wrapper[0] as HTMLAnchorElement;
    const nameTag = wrapper[1] as HTMLAnchorElement;

    // Primary link has the clip-path polygon applied.
    expect(buildingLink.style.clipPath).toContain("polygon");
    // Primary link is the accessible link (aria-label set).
    expect(buildingLink.getAttribute("aria-label")).toBe("📖 读");

    // Name-tag link is decorative — aria-hidden + tabIndex -1.
    expect(nameTag.getAttribute("aria-hidden")).toBe("true");
    expect(nameTag.getAttribute("tabindex")).toBe("-1");
  });

  it("active chip name-tag uses the inverted ink-black variant", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    // links[1] = inactive name-tag; links[3] = active name-tag.
    expect(links[1].className).toContain("bg-white/95");
    expect(links[3].className).toContain("bg-ink");
  });
});
