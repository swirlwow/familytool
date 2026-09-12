import { fetchVerifiedBackup } from '../backup-format';
export function fetchBackupFile(url:string):Promise<Blob> {
  const scope=new URL(url,'https://local.invalid').searchParams.get('workspace_id')??undefined;
  return fetchVerifiedBackup(url,'family',scope);
}
