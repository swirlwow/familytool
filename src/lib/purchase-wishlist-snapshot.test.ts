import {describe,expect,it} from "vitest";
import {purchaseWishlistSnapshot} from "./purchases";

describe("purchase wishlist snapshots",()=>{
  it("keeps every quoted source and original wishlist metadata",()=>{
    const snapshot=purchaseWishlistSnapshot({requested_by:"我",purchase_for:"自己",priority:"high",planned_date:"2026-09-20",note:"等優惠",sources:[
      {platform:"PChome",url:"https://example.com/a",price:"5988",note:"送點數",sort_order:0},
      {platform:"momo",url:"https://example.com/b",price:5888,note:null,sort_order:1},
      {platform:"蝦皮",url:"https://example.com/c",price:null,note:"看折價券",sort_order:2},
    ]});
    expect(snapshot).toMatchObject({requested_by:"我",purchase_for:"自己",priority:"high",planned_date:"2026-09-20",note:"等優惠"});
    expect(snapshot?.sources).toHaveLength(3);
    expect(snapshot?.sources.map(source=>source.platform)).toEqual(["PChome","momo","蝦皮"]);
    expect(snapshot?.sources[0].price).toBe(5988);
  });

  it("treats old purchase rows without a snapshot as compatible",()=>{
    expect(purchaseWishlistSnapshot(undefined)).toBeNull();
    expect(purchaseWishlistSnapshot({})).toBeNull();
  });
});
