import { makeBackup,type BackupKind,type Backup } from './backup-format';
export async function backupResponse(kind:BackupKind,scope:string,tables:Backup['tables']) {
  const payload=await makeBackup(kind,scope,tables);
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  if(bytes.length>32*1024*1024) throw new Error('BACKUP_TOO_LARGE');
  let offset=0;
  const stream=new ReadableStream<Uint8Array>({pull(controller){
    if(offset>=bytes.length){controller.close();return;}
    controller.enqueue(bytes.slice(offset,offset+65536));offset+=65536;
  }});
  return new Response(stream,{headers:{'Content-Type':'application/json; charset=utf-8','Content-Disposition':`attachment; filename="${kind}_backup_${payload.exported_at.slice(0,10)}.json"`,'Cache-Control':'private, no-store, max-age=0','X-Content-Type-Options':'nosniff'}});
}
