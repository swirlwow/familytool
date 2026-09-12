import { describe,it,expect } from 'vitest';
import { BACKUP_TABLES,makeBackup,verifyBackup } from '@/lib/backup-format';
import { readAllPages } from '@/lib/read-all-pages';
describe('phase 4 backup and pagination',()=>{
 for(const kind of ['family','shift'] as const) {
  it(kind+' validates every table and rejects corruption',async()=>{
   const tables=Object.fromEntries(BACKUP_TABLES[kind].map(t=>[t,[]]));
   const b=await makeBackup(kind,'scope',tables);
   expect(await verifyBackup(b,kind,'scope')).toEqual(b);
   await expect(verifyBackup(b,kind,'another')).rejects.toThrow();
   const missing=structuredClone(b);delete missing.tables[BACKUP_TABLES[kind][0]];await expect(verifyBackup(missing,kind)).rejects.toThrow();
   const edited=structuredClone(b);edited.tables[BACKUP_TABLES[kind][0]]=[{id:'x'}];await expect(verifyBackup(edited,kind)).rejects.toThrow();
   await expect(makeBackup(kind,'scope',{...tables,[BACKUP_TABLES[kind][0]]:[{id:'x'},{id:'x'}]})).rejects.toThrow();
  });
 }
 for(const count of [0,500,1000,1001,5000,6001]) it('reads exactly '+count+' rows',async()=>{
  const rows=Array.from({length:count},(_,i)=>({id:String(i)}));
  const result=await readAllPages(async(a,b)=>({data:rows.slice(a,b+1),count,error:null}),r=>r.id);
  expect(result).toEqual(rows);
 });
 it('rejects changed count, partial and duplicate responses',async()=>{
  const first=Array.from({length:500},(_,i)=>({id:String(i)}));
  await expect(readAllPages(async(a)=>({data:a?[]:first,count:501,error:null}),r=>r.id)).rejects.toThrow();
  await expect(readAllPages(async(a)=>({data:first,count:a?502:501,error:null}),r=>r.id)).rejects.toThrow();
  await expect(readAllPages(async()=>({data:[{id:'a'},{id:'a'}],count:2,error:null}),r=>r.id)).rejects.toThrow();
  await expect(readAllPages(async()=>({data:[],count:100001,error:null}),r=>String(r))).rejects.toThrow();
 });
});
