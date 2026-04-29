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
    mascotPose: "flashcards",
    palette: "lavender",
    subtitle: "Vocabulary",
  },
  {
    mode: "writing",
    order: 6,
    label: "✍ 写",
    href: "/ket/writing/new",
    mascotPose: "writing",
    palette: "butter",
    subtitle: "Writing",
  },
];

describe("<PortalMap>", () => {
  it("renders one Next/Link tile per chip with the mode href", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    expect(links.length).toBe(2);
    expect(links[0].getAttribute("href")).toBe("/ket/vocab");
    expect(links[1].getAttribute("href")).toBe("/ket/writing/new");
  });

  it("each tile shows the ordinal badge", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    expect(container.textContent).toContain("1");
    expect(container.textContent).toContain("6");
  });

  it("each tile renders Leo (KET) mascot with the per-mode pose", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const imgs = container.querySelectorAll("img");
    // Two mascot images — one per chip.
    expect(imgs.length).toBe(2);
    // Mascot uses next/image which rewrites the src; decode and check
    // the underlying asset path.
    const flashcards = decodeURIComponent(imgs[0].getAttribute("src") ?? "");
    expect(flashcards).toContain("/mascots/leo/flashcards.png");
    const writing = decodeURIComponent(imgs[1].getAttribute("src") ?? "");
    expect(writing).toContain("/mascots/leo/writing.png");
  });

  it("PET portal renders Aria mascot poses instead of Leo", () => {
    const { container } = render(
      <PortalMap portal="pet" chips={sampleChips} />,
    );
    const imgs = container.querySelectorAll("img");
    expect(decodeURIComponent(imgs[0].getAttribute("src") ?? "")).toContain(
      "/mascots/aria/flashcards.png",
    );
  });

  it("tile background uses the per-chip palette class", () => {
    const { container } = render(
      <PortalMap portal="ket" chips={sampleChips} />,
    );
    const links = container.querySelectorAll("a");
    expect(links[0].className).toContain("tile-lavender");
    expect(links[1].className).toContain("tile-butter");
  });
});
