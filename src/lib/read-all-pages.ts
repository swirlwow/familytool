export type DataPage<T>={data:T[]|null;error:unknown;count:number|null};
export async function readAllPages<T>(fetchPage:(from:number,to:number)=>PromiseLike<DataPage<T>>,key:(row:T)=>string):Promise<T[]> {
  const result:T[]=[];const seen=new Set<string>();let expected:number|undefined;
  while(true) {
    const page=await fetchPage(result.length,result.length+499);
    if(page.error||!page.data||!Number.isSafeInteger(page.count)||page.count!<0) throw new Error('資料讀取失敗，請重試');
    if(expected!==undefined&&expected!==page.count) throw new Error('資料讀取期間有異動，請重試');
    expected=page.count!;
    if(expected>100000) throw new Error('資料超過線上讀取上限，未回傳不完整結果');
    for(const row of page.data){const id=key(row);if(!id||seen.has(id))throw new Error('資料讀取重複或缺少識別碼，請重試');seen.add(id);result.push(row);}
    if(result.length===expected)return result;
    if(!page.data.length||result.length>expected)throw new Error('資料未完整取得，請重試');
  }
}
