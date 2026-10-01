export const stickyOrderKey = (workspace: string) => 'familytool:sticky-order:v1:' + workspace;
export function parseStickyOrder(value: string | null): string[] {
  try {
    const parsed: unknown = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? [...new Set(parsed.filter((id): id is string => typeof id === 'string' && id.length > 0 && id.length < 200))] : [];
  } catch { return []; }
}
export function applyStickyOrder<T extends {id: string}>(rows: T[], order: string[]): T[] {
  const ranks = new Map(order.map((id, index) => [id, index]));
  return [...rows].sort((a, b) => (ranks.get(a.id) ?? -1) - (ranks.get(b.id) ?? -1));
}
// Change only the visible slots, leaving filtered-out notes in place.
export function mergeStickyOrder(saved: string[], visible: string[], reordered: string[]): string[] {
  const known = new Set(saved);
  const base = [...new Set([...visible.filter(id => !known.has(id)), ...saved])];
  const visibleSet = new Set(visible);
  let index = 0;
  return base.map(id => visibleSet.has(id) ? reordered[index++] : id);
}
