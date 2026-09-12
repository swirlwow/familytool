export const BACKUP_TABLES = {
  "family": [
    "workspaces",
    "user_workspaces",
    "members",
    "accounts",
    "account_records",
    "bill_templates",
    "bill_instances",
    "calendar_events",
    "categories",
    "category_groups",
    "ledger_categories",
    "ledger_entries",
    "ledger_merchants",
    "ledger_splits",
    "notes",
    "payers",
    "payment_methods",
    "payments",
    "settlements",
    "settlement_items",
    "settlement_split_links",
    "stickies",
    "sticky_items",
    "shopping_items",
    "shopping_item_sources",
    "investment_accounts",
    "investment_securities",
    "investment_transactions",
    "investment_dividends",
    "investment_corporate_actions"
  ],
  "shift": [
    "profiles",
    "work_settings",
    "import_batches",
    "duty_records",
    "duty_segments",
    "leave_records",
    "leave_record_days",
    "balance_ledger",
    "import_rows",
    "shift_overrides"
  ]
} as const;
export type BackupKind = keyof typeof BACKUP_TABLES;
export type Backup = {format:string;version:2;exported_at:string;scope_id:string;workspace_id?:string;counts:Record<string,number>;checksums:Record<string,string>;tables:Record<string,Record<string,unknown>[]>;excludes:string[]};
export function canonical(value:unknown):string {
  if(Array.isArray(value)) return '['+value.map(canonical).join(',')+']';
  if(value!==null&&typeof value==='object') return '{'+Object.keys(value).sort().map(key=>JSON.stringify(key)+':'+canonical((value as Record<string,unknown>)[key])).join(',')+'}';
  return JSON.stringify(value);
}
export async function digest(value:unknown) {
  const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(canonical(value)));
  return Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join('');
}
function checkTables(kind:BackupKind,tables:Backup['tables']) {
  if(!tables||Object.keys(tables).sort().join('|')!==[...BACKUP_TABLES[kind]].sort().join('|')) throw new Error('備份資料表不完整');
  for(const table of BACKUP_TABLES[kind]) {
    const rows=tables[table];
    if(!Array.isArray(rows)) throw new Error('備份資料格式錯誤');
    const keys=new Set<string>();
    for(const row of rows) {
      if(!row||typeof row!=='object'||Array.isArray(row)) throw new Error('備份資料格式錯誤');
      const id=row.id??row.user_id;
      if(typeof id!=='string'||keys.has(id)) throw new Error('備份識別碼缺漏或重複');
      keys.add(id);
    }
  }
}
export async function makeBackup(kind:BackupKind,scope:string,tables:Backup['tables']):Promise<Backup> {
  checkTables(kind,tables);
  const counts:Record<string,number>={},checksums:Record<string,string>={};
  for(const table of BACKUP_TABLES[kind]) {counts[table]=tables[table].length;checksums[table]=await digest(tables[table]);}
  return {format:kind==='family'?'familytool-backup':'shift-tool-backup',version:2,exported_at:new Date().toISOString(),scope_id:scope,...(kind==='family'?{workspace_id:scope}:{}),counts,checksums,tables,excludes:['auth credentials and sessions','platform secrets and configuration','external attachments and linked files']};
}
export async function verifyBackup(value:unknown,kind:BackupKind,expectedScope?:string):Promise<Backup> {
  const b=value as Backup;
  if(!b||b.version!==2||b.format!==(kind==='family'?'familytool-backup':'shift-tool-backup')||typeof b.scope_id!=='string'||!b.scope_id||!Number.isFinite(Date.parse(b.exported_at))||(expectedScope&&b.scope_id!==expectedScope)) throw new Error('備份內容不完整或版本／帳戶不符');
  checkTables(kind,b.tables);
  for(const table of BACKUP_TABLES[kind]) if(b.counts?.[table]!==b.tables[table].length||b.checksums?.[table]!==await digest(b.tables[table])) throw new Error('備份筆數或校驗碼不符');
  return b;
}
export async function fetchVerifiedBackup(url:string,kind:BackupKind,expectedScope?:string):Promise<Blob> {
  const response=await fetch(url,{cache:'no-store'});
  if(!response.ok||!response.headers.get('content-type')?.includes('application/json')) throw new Error('無法下載備份，請確認登入狀態後重試。');
  const blob=await response.blob();
  if(blob.size>32*1024*1024) throw new Error('備份檔超過瀏覽器驗證上限，請使用管理員備份流程。');
  await verifyBackup(JSON.parse(await blob.text()),kind,expectedScope);
  return blob;
}
