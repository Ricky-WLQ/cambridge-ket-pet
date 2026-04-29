// @vitest-environment jsdom
import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { PortalMap, type ModeChip } from "../PortalMap";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}));

const sampleChips: ModeChip[] = [
  {
    mode: "reading",
    label: "📖 读",
    href: "/ket/reading/new",
    imgSrc: "/maps/buildings/ket/reading.png",
    plotCenter: { x: 24, y: 74 },
    placement: { x: 14, y: 64, w: 20, h: 18 },
  },
  {
    mode: "listening",
    label: "🎧 听",
    href: "/ket/listening/new",
    imgSrc: "/maps/buildings/ket/listening.png",
    plotCenter: { x: 24, y: 46 },
    placement: { x: 14, y: 36, w: 20, h: 18 },
    active: true,
  },
];

describe("<PortalMap>", () => {
  it("renders the empty-island background for portal=ket", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const bgImage = container.querySelector("svg image");
    expect(bgImage?.getAttribute("href")).toBe("/maps/ket-island-bg.png");
  });

  it("renders one <image> per chip with visiblePainted pointer events", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const svgImages = container.querySelectorAll("svg image");
    // 1 background + 2 building images
    expect(svgImages.length).toBe(3);

    const reading = svgImages[1] as SVGImageElement;
    expect(reading.getAttribute("href")).toBe("/maps/buildings/ket/reading.png");
    expect(reading.getAttribute("aria-label")).toBe("📖 读");
    expect(reading.getAttribute("role")).toBe("link");
    expect(reading.getAttribute("tabindex")).toBe("0");
    // pointer-events: visiblePainted is set inline.
    expect(reading.style.pointerEvents).toBe("visiblePainted");
  });

  it("places each building at its placement coordinates in viewBox space", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const svgImages = container.querySelectorAll("svg image");
    const reading = svgImages[1] as SVGImageElement;
    expect(reading.getAttribute("x")).toBe("14");
    expect(reading.getAttribute("y")).toBe("64");
    expect(reading.getAttribute("width")).toBe("20");
    expect(reading.getAttribute("height")).toBe("18");
  });

  it("renders DOM chip name-tag overlays as decorative aria-hidden links", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("/ket/reading/new");
    expect(links[0].getAttribute("aria-hidden")).toBe("true");
    expect(links[0].getAttribute("tabindex")).toBe("-1");
  });

  it("active chip name-tag uses the inverted ink-black variant", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    expect(links[0].className).toContain("bg-white/95");
    expect(links[1].className).toContain("bg-ink");
  });
});
