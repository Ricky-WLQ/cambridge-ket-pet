import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TodayCard } from "../TodayCard";

describe("<TodayCard>", () => {
  it("renders the label, title, hint, and link", () => {
    render(
      <TodayCard
        portal="ket"
        label="今天"
        title="来 5 道听力题"
        hint="Leo 给你挑了 Part 1 · 8 分钟"
        href="/ket/listening/new?part=1"
        ctaLabel="开始 →"
      />,
    );
    expect(screen.getByText("今天")).toBeInTheDocument();
    expect(screen.getByText("来 5 道听力题")).toBeInTheDocument();
    expect(screen.getByText("Leo 给你挑了 Part 1 · 8 分钟")).toBeInTheDocument();
    const cta = screen.getByText("开始 →");
    expect(cta.closest("a")).toHaveAttribute("href", "/ket/listening/new?part=1");
  });

  it("uses the PET palette and Aria mascot when portal=pet", () => {
    const { container } = render(
      <TodayCard
        portal="pet"
        label="TODAY"
        title="口语 Part 2"
        hint="Aria 准备了 4 张图"
        href="/pet/speaking/new"
        ctaLabel="开始 →"
        mascotPose="microphone"
      />,
    );
    // TodayCard renders the mascot decoratively (alt=""), so query by src.
    const aria = container.querySelector("img");
    expect(decodeURIComponent(aria?.getAttribute("src") ?? "")).toContain(
      "/mascots/aria/microphone.png",
    );
  });
});
