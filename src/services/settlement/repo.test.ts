import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({ calls: [] as Array<Array<[string, ...unknown[]]>>, count: 501 }));
vi.mock('@/lib/supabaseClient', () => ({
  supabase: {
    from(table: string) {
      const calls: Array<[string, ...unknown[]]> = [['from', table]];
      state.calls.push(calls);
      const query = {
        select(...args: unknown[]) { calls.push(['select', ...args]); return query; },
        eq(...args: unknown[]) { calls.push(['eq', ...args]); return query; },
        gte(...args: unknown[]) { calls.push(['gte', ...args]); return query; },
        lte(...args: unknown[]) { calls.push(['lte', ...args]); return query; },
        order(...args: unknown[]) { calls.push(['order', ...args]); return query; },
        range(start: number, end: number) {
          calls.push(['range', start, end]);
          return Promise.resolve({ error: null, count: state.count,
            data: Array.from({ length: Math.max(0, Math.min(end + 1, state.count) - start) },
              (_, i) => ({ id: String(start + i), note: '' })) });
        },
      };
      return query;
    },
  },
}));

import { getSplitsInRange, getSettledItemsForUI, getSettlementHeadersThroughDate } from './repo';

describe('settlement pagination keeps business dates separate from offsets', () => {
  beforeEach(() => { state.calls = []; state.count = 501; });
  const params = { workspace_id: 'workspace-a', from: '2026-08-01', to: '2026-09-12' };
  for (const [name, load, filters] of [
    ['splits', getSplitsInRange, [['gte', 'ledger_entries.entry_date', params.from], ['lte', 'ledger_entries.entry_date', params.to]]],
    ['settled items', getSettledItemsForUI, [['lte', 'settlements.settled_date', params.to]]],
    ['settlement headers', getSettlementHeadersThroughDate, [['lte', 'settled_date', params.to]]],
  ] as const) {
    it(`${name}: every page uses original dates and workspace`, async () => {
      expect(await load(params)).toHaveLength(501);
      expect(state.calls).toHaveLength(2);
      state.calls.forEach((calls, page) => {
        expect(calls).toContainEqual(['eq', 'workspace_id', params.workspace_id]);
        for (const filter of filters) expect(calls).toContainEqual([...filter]);
        expect(calls).toContainEqual(['range', page * 500, page * 500 + 499]);
        expect(calls).toContainEqual(['order', 'id']);
        expect(calls.find(call => call[0] === 'select')?.[2]).toEqual({ count: 'exact' });
      });
    });
    it(`${name}: an empty workspace returns an empty list`, async () => {
      state.count = 0;
      expect(await load(params)).toEqual([]);
      expect(state.calls).toHaveLength(1);
    });
  }
});
