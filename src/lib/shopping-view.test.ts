import {describe,it,expect} from "vitest";
import {isWishlistItem} from "./shopping-view";
describe("wishlist presentation",()=>{
 it("excludes purchased items even when browsing all or searching",()=>{
  const items=[{status:"pending",name:"杯"},{status:"purchased",name:"杯"},{status:"skipped",name:"杯"}];
  expect(items.filter(isWishlistItem).map(r=>r.status)).toEqual(["pending","skipped"]);
  expect(items.filter(isWishlistItem).filter(r=>r.name.includes("杯"))).toHaveLength(2);
  expect(items).toHaveLength(3);
 });
});
