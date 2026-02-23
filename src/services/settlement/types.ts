// src/services/settlement/types.ts
export type SplitLine = {
  split_id: string;
  entry_id: string;
  entry_date: string;
  creditor_id: string;      // ledger_entries.payer_id
  debtor_id: string;        // ledger_splits.payer_id
  split_amount: number;
  settled_amount: number;
  remaining_amount: number;
};
