import { describe, expect, it } from "vitest";
import { normalizeShoppingSources } from "./shoppingRepo";

describe("normalizeShoppingSources", () => {
  it("keeps multiple comparison sources and infers known platforms", () => {
    expect(normalizeShoppingSources([
      { platform: "", url: "https://24h.pchome.com.tw/prod/ABC", price: "5988", note: "送 P 幣" },
      { platform: "MOMO", url: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=1", price: 5888, note: "期間促銷" },
    ])).toEqual([
      { platform: "PChome", url: "https://24h.pchome.com.tw/prod/ABC", price: 5988, note: "送 P 幣" },
      { platform: "MOMO", url: "https://www.momoshop.com.tw/goods/GoodsDetail.jsp?i_code=1", price: 5888, note: "期間促銷" },
    ]);
  });

  it("removes completely empty comparison rows", () => {
    expect(normalizeShoppingSources([{ platform: "", url: "", price: "", note: "" }])).toEqual([]);
  });

  it("rejects unsafe URL schemes", () => {
    expect(() => normalizeShoppingSources([{ platform: "測試", url: "javascript:alert(1)", price: 1, note: "" }])).toThrow("僅支援 http 或 https");
  });
});
