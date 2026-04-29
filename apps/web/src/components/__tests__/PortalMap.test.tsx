import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { PortalMap, type ModeChip } from "../PortalMap";

const sampleChips: ModeChip[] = [
  {
    mode: "reading",
    label: "📖 读",
    accuracy: "84%",
    href: "/ket/reading/new",
    position: { top: "28%", left: "7%" },
  },
  {
    mode: "listening",
    label: "🎧 听",
    accuracy: "→",
    href: "/ket/listening/new",
    position: { top: "22%", left: "67%" },
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

  it("renders all chips with correct hrefs", () => {
    const { getByText } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    expect(getByText("📖 读").closest("a")).toHaveAttribute(
      "href",
      "/ket/reading/new",
    );
    expect(getByText("🎧 听").closest("a")).toHaveAttribute(
      "href",
      "/ket/listening/new",
    );
  });
});
