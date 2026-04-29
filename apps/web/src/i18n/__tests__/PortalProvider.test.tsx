import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { PortalProvider, useT } from "../PortalProvider";

function Probe() {
  const tone = useT();
  return <div>{tone({ ket: "kid", pet: "teen" })}</div>;
}

describe("PortalProvider + useT", () => {
  it("provides the ket tone when portal is ket", () => {
    render(
      <PortalProvider portal="ket"><Probe /></PortalProvider>
    );
    expect(screen.getByText("kid")).toBeInTheDocument();
  });

  it("provides the pet tone when portal is pet", () => {
    render(
      <PortalProvider portal="pet"><Probe /></PortalProvider>
    );
    expect(screen.getByText("teen")).toBeInTheDocument();
  });

  it("defaults to ket when no provider is present", () => {
    render(<Probe />);
    expect(screen.getByText("kid")).toBeInTheDocument();
  });
});
