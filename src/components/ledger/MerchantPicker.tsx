"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { ChoiceChips } from "./ChoiceChips";
import { TextInputDialog } from "@/components/ui/text-input-dialog";
import { toast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/client/feedback";
import type { useLedgerMerchants } from "@/hooks/useLedgerMerchants";

type Props = {
  value: string;
  onChange: (value: string) => void;
  source: ReturnType<typeof useLedgerMerchants>;
};

export function MerchantPicker({ value, onChange, source }: Props) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  async function saveName() {
    if (busy) return false;
    setBusy(true);
    try {
      const item = await source.save({ name });
      onChange(item.name);
      toast({ title: "店家已新增" });
      return true;
    } catch (error) {
      toast({ variant: "destructive", title: "無法儲存店家", description: getErrorMessage(error, "請稍後再試") });
      return false;
    } finally { setBusy(false); }
  }
  return <div className="min-w-0">
    {source.loading ? <p role="status" className="choice-hint">載入店家中…{value && `目前：${value}`}</p> : source.error ? (
      <div role="alert" className="choice-hint">{source.error}
        {value && <p>目前：{value}</p>}
        <button type="button" className="choice-more" onClick={source.retry}>重試</button>
      </div>
    ) : <ChoiceChips label="店家／對象" value={value} onChange={onChange}
      options={source.items.filter(item => item.is_active).map(item => ({ value: item.name, label: item.name }))} />}
    <button type="button" disabled={busy || source.loading || !!source.error} className="choice-more merchant-quick-add"
      onClick={() => { setName(""); setOpen(true); }}><Plus size={15} aria-hidden="true" />新增店家</button>
    <TextInputDialog open={open} onOpenChange={setOpen} title="新增店家" label="店家名稱"
      description="名稱最多 120 個字；同名店家不會重複新增。" value={name}
      onValueChange={setName} busy={busy} onConfirm={saveName} />
  </div>;
}
