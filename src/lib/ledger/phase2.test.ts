import {expect,it} from "vitest";
import {validateSplits} from "./splits";
it("requires a payer and every debtor before accepting a split",()=>{
 expect(validateSplits({type:"expense",amount:100,splits:[{payer_id:"b",amount:20}]}).ok).toBe(false);
 expect(validateSplits({type:"expense",amount:100,payer_id:"a",splits:[{amount:20}]}).ok).toBe(false);
});
it.each([0,-1,"invalid",null])("rejects an invalid split amount: %s",(amount)=>{
 expect(validateSplits({type:"expense",amount:100,payer_id:"a",splits:[{payer_id:"b",amount}]}).ok).toBe(false);
});
it("accepts a partial allocation without changing the input",()=>{
 const input={type:"expense" as const,amount:100,payer_id:"a",splits:[{payer_id:"b",amount:25}]};
 const before=structuredClone(input);
 expect(validateSplits(input)).toEqual({ok:true});
 expect(input).toEqual(before);
});
