export function getErrorMessage(value: unknown, fallback: string) {
  if (value instanceof Error && value.message) return value.message;
  if (value && typeof value === "object" && "error" in value) {
    const error = (value as { error?: unknown }).error;
    if (typeof error === "string" && error) return error;
  }
  return fallback;
}
