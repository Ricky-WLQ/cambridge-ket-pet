import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Mascot } from "../Mascot";

describe("<Mascot>", () => {
  it("renders the ket mascot path for portal=ket", () => {
    const { getByAltText } = render(<Mascot pose="greeting" portal="ket" />);
    const img = getByAltText("Leo");
    // next/image wraps the URL via its optimizer, so the asset path may be
    // URL-encoded inside an `?url=...` query string. Decode before asserting.
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain(
      "/mascots/leo/greeting.png",
    );
  });

  it("renders the pet mascot path for portal=pet", () => {
    const { getByAltText } = render(<Mascot pose="celebrating" portal="pet" />);
    const img = getByAltText("Aria");
    expect(decodeURIComponent(img.getAttribute("src") ?? "")).toContain(
      "/mascots/aria/celebrating.png",
    );
  });

  it("respects custom width/height", () => {
    const { getByAltText } = render(
      <Mascot pose="thinking" portal="ket" width={64} height={64} />,
    );
    const img = getByAltText("Leo");
    expect(img).toHaveAttribute("width", "64");
    expect(img).toHaveAttribute("height", "64");
  });

  it("renders empty alt when decorative=true", () => {
    const { container } = render(
      <Mascot pose="waving" portal="ket" decorative />,
    );
    const img = container.querySelector("img");
    expect(img?.getAttribute("alt")).toBe("");
  });
});
