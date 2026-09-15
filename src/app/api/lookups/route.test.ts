import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  active: false,
  from: vi.fn(),
}));
vi.mock("@/lib/supabaseClient", () => ({ supabase: { from: fixture.from } }));
import { GET } from "./route";

beforeEach(() => {
  fixture.active = false;
  fixture.from.mockImplementation((table: string) => {
    const filters: Array<[string, unknown]> = [];
    const query = {
      select: () => query,
      eq: (key: string, value: unknown) => { filters.push([key, value]); return query; },
      order: () => query,
      then: (resolve: (value: unknown) => unknown) => {
        const rows = table === "ledger_categories"
          ? [
            { id: "food", workspace_id: "w", name: "餐飲", type: "expense", group_name: "生活", is_active: fixture.active },
            { id: "traffic", workspace_id: "w", name: "交通", type: "expense", group_name: "生活", is_active: true },
            { id: "salary", workspace_id: "w", name: "薪資", type: "income", group_name: "工作", is_active: fixture.active },
            { id: "foreign", workspace_id: "other", name: "其他帳戶", type: "expense", is_active: true },
          ]
          : table === "payment_methods"
            ? [{ id: "cash", workspace_id: "w", name: "現金", is_active: fixture.active }, { id: "card", workspace_id: "w", name: "信用卡", is_active: true }]
            : [];
        return Promise.resolve(resolve({ data: rows.filter(row => filters.every(([key, value]) => (row as Record<string, unknown>)[key] === value)), error: null }));
      },
    };
    return query;
  });
});

describe("lookups historical labels versus new-entry options", () => {
  it("retains disabled category names/groups and payment names only in history", async () => {
    const { data } = await (await GET(new Request("https://example.test/api/lookups?workspace_id=w"))).json();
    expect(data.categories_expense.map((x: {id: string}) => x.id)).toEqual(["traffic"]);
    expect(data.categories_income).toEqual([]);
    expect(data.payment_methods).toEqual([{ id: "card", name: "信用卡" }]);
    expect(data.historical_categories_expense.map((x: {id: string}) => x.id)).toEqual(expect.arrayContaining(["food", "traffic"]));
    expect(data.historical_categories_income[0].name).toBe("薪資");
    expect(data.historical_payment_methods[0].name).toBe("現金");
    const categories = new Map<string, {group_name: string}>(data.historical_categories_expense.map((x: {id: string; group_name: string}) => [x.id, x]));
    const entries = [{category_id: "food", amount: 300}, {category_id: "traffic", amount: 200}];
    expect(entries.filter(e => categories.get(e.category_id)?.group_name === "生活").reduce((sum, e) => sum + e.amount, 0)).toBe(500);
  });
  it("reactivation restores new-entry options without losing history", async () => {
    fixture.active = true;
    const { data } = await (await GET(new Request("https://example.test/api/lookups?workspace_id=w"))).json();
    expect(data.categories_expense).toHaveLength(2);
    expect(data.categories_income).toHaveLength(1);
    expect(data.payment_methods).toHaveLength(2);
    expect(data.historical_categories_expense).toHaveLength(2);
  });
  it("requires a workspace before reading data", async () => {
    fixture.from.mockClear();
    expect((await GET(new Request("https://example.test/api/lookups"))).status).toBe(400);
    expect(fixture.from).not.toHaveBeenCalled();
  });
});
