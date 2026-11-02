/** Every date covered by a hidden multi-day event must retain an access point. */
export function addCalendarOverflow<T extends { id: string }>(
  byDate: Map<string, T[]>, dates: readonly (string | null)[], start: number, end: number, event: T,
): void {
  for (let index = start; index <= end; index++) {
    const date = dates[index];
    if (!date) continue;
    const existing = byDate.get(date) || [];
    if (!existing.some(row => row.id === event.id)) byDate.set(date, [...existing, event]);
  }
}
