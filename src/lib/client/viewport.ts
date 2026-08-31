// Do not mistake pinch zoom or a small browser toolbar for the on-screen keyboard.
export function isKeyboardViewport(layoutHeight: number, visualHeight: number, scale: number, editing: boolean) {
  return editing && Math.abs(scale - 1) < 0.05 && layoutHeight - visualHeight > 150;
}
