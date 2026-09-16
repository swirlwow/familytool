import {describe,it,expect} from "vitest";
import {normalizePurchase,filterPurchases,purchaseDate,type Purchase} from "./purchases";
import {BACKUP_TABLES,makeBackup,verifyBackup} from "./backup-format";
const input={name:"保冷壺",purchase_date:"2026-09-16",quantity:"1"};
describe("purchase history",()=>{
 it("distinguishes unknown amount from zero and preserves decimal precision",()=>{
  expect(normalizePurchase(input).total_amount).toBeNull();
  expect(normalizePurchase({...input,total_amount:"0"}).total_amount).toBe(0);
  expect(normalizePurchase({...input,total_amount:"123.45",quantity:"1.25"})).toMatchObject({total_amount:123.45,quantity:1.25});
 });
 it("never infers actual prices from sources",()=>expect(normalizePurchase({...input,sources:[{price:500}]}).total_amount).toBeNull());
 it("allows unknown dates only for legacy records",()=>{
  expect(()=>normalizePurchase({...input,purchase_date:""})).toThrow();
  expect(normalizePurchase({...input,purchase_date:""},true).purchase_date).toBeNull();
  expect(()=>purchaseDate("2026-02-30")).toThrow();
 });
 it.each([-1,Infinity,NaN,true,{}, "1e3","-3","1.234"])("rejects invalid amount %s",v=>expect(()=>normalizePurchase({...input,total_amount:v})).toThrow());
 it.each([0,-1,"0","1.0001"])("rejects invalid quantity %s",v=>expect(()=>normalizePurchase({...input,quantity:v})).toThrow());
 it.each(["javascript:alert(1)","data:text/plain,test","ftp://x","not url"])("rejects unsafe URLs %s",url=>expect(()=>normalizePurchase({...input,url})).toThrow());
 it("filters all fields, date/store and sorts missing dates last without changing data",()=>{
  const rows=[{id:"a",name:"壺",specification:"500ml",store:"A",note:"旅行",purchase_date:null,created_at:"2026-09-01"},
   {id:"b",name:"杯",store:"B",purchase_date:"2026-09-15",created_at:"2026-09-15"}] as Purchase[];
  expect(filterPurchases(rows,"","","","").map(r=>r.id)).toEqual(["b","a"]);
  expect(filterPurchases(rows,"旅行","","","A")).toHaveLength(1);
  expect(filterPurchases(rows,"","2026-09-01","","")).toHaveLength(1);
  expect(rows[0].id).toBe("a");
 });
 it("requires purchases in v3 and accepts intact old v2 backups",async()=>{
  const tables=Object.fromEntries(BACKUP_TABLES.family.map(t=>[t,[]]));
  const next=await makeBackup("family","w",tables);expect(next.version).toBe(3);
  expect(await verifyBackup(next,"family")).toEqual(next);
  const broken=structuredClone(next);delete broken.tables.shopping_purchases;
  await expect(verifyBackup(broken,"family")).rejects.toThrow();
  const old=structuredClone(next);old.version=2;delete old.tables.shopping_purchases;delete old.counts.shopping_purchases;delete old.checksums.shopping_purchases;
  expect(await verifyBackup(old,"family")).toEqual(old);
  old.tables.ledger_entries=[{id:"edited"}];await expect(verifyBackup(old,"family")).rejects.toThrow();
 });
});
