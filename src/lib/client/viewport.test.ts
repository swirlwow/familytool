import { describe, expect, it } from "vitest";
import { isKeyboardViewport } from "./viewport";

describe("keyboard-safe viewport", () => {
  it("recognizes a keyboard only while editing", () => {
    expect(isKeyboardViewport(844, 490, 1, true)).toBe(true);
    expect(isKeyboardViewport(844, 490, 1, false)).toBe(false);
  });
  it("does not hide navigation for pinch zoom or browser bars", () => {
    expect(isKeyboardViewport(844, 422, 2, true)).toBe(false);
    expect(isKeyboardViewport(844, 740, 1, true)).toBe(false);
  });
  it("handles desktop, landscape and resized-layout viewports", () => {
    expect(isKeyboardViewport(900, 900, 1, true)).toBe(false);
    expect(isKeyboardViewport(390, 210, 1, true)).toBe(true);
    expect(isKeyboardViewport(490, 490, 1, true)).toBe(false);
  });
});
