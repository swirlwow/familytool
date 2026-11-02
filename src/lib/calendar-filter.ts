import { CALENDAR_OWNERS } from "./calendar-colors";

export type CalendarOwnerFilter = "all" | typeof CALENDAR_OWNERS[number];
export type CalendarPerson = Exclude<CalendarOwnerFilter, "all">;
export function toggleCalendarOwnerFilter(selected: readonly CalendarPerson[], owner: CalendarOwnerFilter): CalendarPerson[] {
  if (owner === "all") return [];
  const next = selected.includes(owner) ? selected.filter(person => person !== owner) : [...selected, owner];
  return CALENDAR_OWNERS.filter(person => next.includes(person));
}
/** Match every assigned owner, including historical comma-separated assignments. */
export function matchesCalendarOwner(raw: string | null | undefined, filter: CalendarOwnerFilter | readonly CalendarPerson[]): boolean {
  if (filter === "all") return true;
  const selected = typeof filter === "string" ? [filter] : filter;
  if (!selected.length) return true;
  const owners = String(raw ?? "").split(/[|,]/).map(owner => owner.trim()).filter(Boolean);
  return selected.some(person => (owners.length ? owners : ["家庭"]).includes(person));
}
