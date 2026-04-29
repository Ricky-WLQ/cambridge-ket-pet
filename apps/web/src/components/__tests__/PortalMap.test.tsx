// @vitest-environment jsdom
import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortalMap, type ModeChip } from "../PortalMap";

const sampleChips: ModeChip[] = [
  {
    mode: "vocab",
    order: 1,
    label: "📖 词",
    href: "/ket/vocab",
    tagPosition: { x: 50, y: 30 },
  },
  {
    mode: "writing",
    order: 6,
    label: "✍ 写",
    href: "/ket/writing/new",
    tagPosition: { x: 50, y: 80 },
    active: true,
  },
];

describe("<PortalMap>", () => {
  it("renders the vectorized KET map via <object data='/maps/ket-island.svg'>", () => {
    const { container } = render(<PortalMap portal="ket" chips={sampleChips} />);
    const obj = container.querySelector("object");
    expect(obj).toBeTruthy();
    expect(obj?.getAttribute("data")).toBe("/maps/ket-island.svg");
    expect(obj?.getAttribute("type")).toBe("image/svg+xml");
  });

  it("falls back to PNG <img> for portal=pet (vectorization pending Phase C)", () => {
    const { container } = render(<PortalMap portal="pet" chips={sampleChips} />);
    expect(container.querySelector("object")).toBeFalsy();
    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toBe("/maps/pet-city.png");
  });

  it("renders a chip name-tag <Link> per chip with the order badge", () => {
    const { container } = render(<PortalMap portal="ket" chips={sampleChips} />);
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("/ket/vocab");
    expect(links[0].getAttribute("aria-hidden")).toBe("true");
    // Order badge with the numeral 1.
    expect(links[0].textContent).toContain("1");
    expect(links[1].textContent).toContain("6");
  });

  it("active chip name-tag uses the inverted ink-black variant", () => {
    const { container } = render(<PortalMap portal="ket" chips={sampleChips} />);
    const links = container.querySelectorAll("a");
    expect(links[0].className).toContain("bg-white/95");
    expect(links[1].className).toContain("bg-ink");
  });
});
