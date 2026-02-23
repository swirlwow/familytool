export type Money = number;

export type Payer = { id: string; name: string };
export type PayMethod = { id: string; name: string };

export type CategoryType = "expense" | "income";

export type Category = {
  id: string;
  workspace_id: string;
  name: string;
  type: CategoryType;
  group_name: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at?: string;
};

export type CategoryGroup = {
  id: string;
  workspace_id: string;
  name: string;
  type: CategoryType;
  sort_order: number | null;
  is_active: boolean;
};

export type LedgerSplit = { payer_id: string; amount: Money };

export type LedgerRow = {
  id: string;
  entry_date: string;
  type: CategoryType;
  amount: Money;
  category_id?: string | null;
  pay_method?: string | null;
  merchant?: string | null;
  note?: string | null;
  bill_instance_id?: string | null;
  payer_id?: string | null;
  created_at?: string;
  ledger_splits?: LedgerSplit[];
};

export type LookupPayload = {
  payers: Payer[];
  payment_methods: PayMethod[];
  categories_expense: Category[];
  categories_income: Category[];
  groups_expense: CategoryGroup[];
  groups_income: CategoryGroup[];
};
