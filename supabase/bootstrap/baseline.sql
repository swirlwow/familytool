-- NEW EMPTY DATABASE ONLY. Schema snapshot, not an incremental migration.
-- Supabase roles and auth schema must already exist. Contains no row data or Auth configuration.
BEGIN;
DO $guard$ BEGIN
IF EXISTS(SELECT 1 FROM pg_tables WHERE schemaname IN ('public','private'))
OR EXISTS(SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace WHERE n.nspname='private')
THEN RAISE EXCEPTION 'BOOTSTRAP_REQUIRES_EMPTY_APPLICATION_SCHEMAS'; END IF;
IF to_regclass('auth.users') IS NULL OR to_regprocedure('auth.uid()') IS NULL
THEN RAISE EXCEPTION 'BOOTSTRAP_REQUIRES_SUPABASE_AUTH'; END IF;
END $guard$;
CREATE SCHEMA private;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public REVOKE ALL ON TABLES FROM PUBLIC,anon,authenticated,service_role;
SET LOCAL standard_conforming_strings=on;
CREATE TABLE public."bill_instances" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"template_id" uuid,"period" text NOT NULL,"due_date" date,"name_snapshot" text NOT NULL,"amount_due" numeric,"status" text DEFAULT 'unpaid'::text NOT NULL,"paid_total" numeric DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"billing_start" date,"billing_end" date,"source" text DEFAULT 'manual'::text NOT NULL,"payment_mode" text DEFAULT 'ledger'::text NOT NULL,"paid_at" timestamp with time zone);
CREATE TABLE public."bill_templates" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"amount_default" numeric,"schedule_type" text DEFAULT 'monthly'::text NOT NULL,"due_day" integer,"active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"amount_mode" text DEFAULT 'fixed'::text NOT NULL,"schedule_months" smallint[],"generate_day" smallint DEFAULT 1 NOT NULL,"payment_mode" text DEFAULT 'ledger'::text NOT NULL,"starts_on" date DEFAULT (date_trunc('month'::text, (CURRENT_DATE)::timestamp with time zone))::date NOT NULL,"ends_on" date);
CREATE TABLE public."settlement_items" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"settlement_id" uuid NOT NULL,"split_id" uuid NOT NULL,"amount" numeric NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ledger_entries" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"entry_date" date NOT NULL,"type" text DEFAULT 'expense'::text NOT NULL,"amount" numeric NOT NULL,"category_id" uuid,"pay_method" text,"merchant" text,"note" text,"bill_instance_id" uuid,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"payer_id" uuid,"request_key" text,"consumption_content" text);
CREATE TABLE public."calendar_events" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"title" text NOT NULL,"description" text DEFAULT ''::text NOT NULL,"start_at" timestamp with time zone NOT NULL,"end_at" timestamp with time zone,"all_day" boolean DEFAULT true NOT NULL,"color" text DEFAULT 'amber'::text NOT NULL,"location" text DEFAULT ''::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone);
CREATE TABLE public."ledger_categories" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"type" text DEFAULT 'expense'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"group_name" text,"sort_order" integer DEFAULT 0,"is_active" boolean DEFAULT true);
CREATE TABLE public."notes" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"title" text DEFAULT ''::text NOT NULL,"content" text DEFAULT ''::text NOT NULL,"note_date" date,"is_important" boolean DEFAULT false NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone,"date_from" date,"date_to" date,"owner" text DEFAULT '家庭'::text NOT NULL);
CREATE TABLE public."payers" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."payment_methods" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"sort" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"is_favorite" boolean DEFAULT false NOT NULL,"is_pinned" boolean DEFAULT false NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL);
CREATE TABLE public."settlement_split_links" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"settlement_id" uuid NOT NULL,"split_id" uuid NOT NULL,"amount" numeric NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."stickies" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"owner" text DEFAULT '家庭'::text NOT NULL,"title" text NOT NULL,"is_done" boolean DEFAULT false NOT NULL,"due_date" date,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone,"content" text DEFAULT ''::text);
CREATE TABLE public."account_records" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"account_id" uuid NOT NULL,"record_date" date NOT NULL,"amount" numeric,"title" text NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."accounts" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"type" text NOT NULL,"owner_name" text NOT NULL,"note" text,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"account_number" text);
CREATE TABLE public."categories" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"type" text NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"group_name" text,"sort_order" integer DEFAULT 0 NOT NULL);
CREATE TABLE public."category_groups" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"type" text NOT NULL,"name" text NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."payments" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"bill_instance_id" uuid NOT NULL,"paid_at" timestamp with time zone DEFAULT now() NOT NULL,"amount_paid" numeric NOT NULL,"pay_method" text,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."sticky_items" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"sticky_id" uuid NOT NULL,"text" text DEFAULT ''::text NOT NULL,"is_done" boolean DEFAULT false NOT NULL,"sort" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone,"done" boolean DEFAULT false NOT NULL);
CREATE TABLE public."members" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"user_id" uuid NOT NULL,"name" text,"role" text DEFAULT 'owner'::text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."user_workspaces" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"user_id" uuid NOT NULL,"workspace_id" uuid NOT NULL,"created_at" timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL);
CREATE TABLE public."workspaces" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"name" text NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."ledger_splits" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"entry_id" uuid NOT NULL,"payer_id" uuid NOT NULL,"amount" numeric NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."settlements" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"debtor_id" uuid NOT NULL,"creditor_id" uuid NOT NULL,"amount" numeric NOT NULL,"settled_date" date DEFAULT ((now() AT TIME ZONE 'utc'::text))::date NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"from_date" date,"to_date" date,"from_payer_id" uuid,"to_payer_id" uuid,"request_key" text);
CREATE TABLE public."ledger_merchants" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL);
CREATE TABLE public."shopping_items" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"requested_by" text,"purchase_for" text,"priority" text DEFAULT 'normal'::text NOT NULL,"planned_date" date,"status" text DEFAULT 'pending'::text NOT NULL,"note" text,"sort_order" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"deleted_at" timestamp with time zone);
CREATE TABLE public."investment_accounts" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"name" text NOT NULL,"broker" text,"currency" text DEFAULT 'TWD'::text NOT NULL,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."investment_securities" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"symbol" text NOT NULL,"name" text NOT NULL,"market" text DEFAULT 'TWSE'::text NOT NULL,"currency" text DEFAULT 'TWD'::text NOT NULL,"current_price" numeric(20,6),"current_price_date" date,"sort_order" integer DEFAULT 0 NOT NULL,"is_active" boolean DEFAULT true NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."shopping_item_sources" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"shopping_item_id" uuid NOT NULL,"platform" text,"url" text,"price" numeric(12,2),"note" text,"sort_order" integer DEFAULT 0 NOT NULL,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."investment_transactions" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"account_id" uuid NOT NULL,"security_id" uuid NOT NULL,"transaction_type" text NOT NULL,"trade_date" date NOT NULL,"quantity" numeric(20,6) DEFAULT 0 NOT NULL,"price" numeric(20,6) DEFAULT 0 NOT NULL,"fee" numeric(20,2) DEFAULT 0 NOT NULL,"tax" numeric(20,2) DEFAULT 0 NOT NULL,"cash_amount" numeric(20,2) DEFAULT 0 NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"settlement_amount" numeric(20,2),"order_number" text,"currency" text DEFAULT 'TWD'::text NOT NULL,"source" text DEFAULT 'manual'::text NOT NULL);
CREATE TABLE public."investment_corporate_actions" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"account_id" uuid NOT NULL,"security_id" uuid NOT NULL,"action_type" text NOT NULL,"event_date" date NOT NULL,"quantity_before" numeric(20,6) NOT NULL,"reduction_ratio" numeric(12,8) NOT NULL,"quantity_after" numeric(20,6) NOT NULL,"cash_return" numeric(20,2) DEFAULT 0 NOT NULL,"cost_adjustment" numeric(20,2) DEFAULT 0 NOT NULL,"source" text DEFAULT 'manual'::text NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL);
CREATE TABLE public."investment_dividends" ("id" uuid DEFAULT gen_random_uuid() NOT NULL,"workspace_id" uuid NOT NULL,"account_id" uuid NOT NULL,"security_id" uuid NOT NULL,"ex_dividend_date" date NOT NULL,"eligible_quantity" numeric(20,6) NOT NULL,"dividend_per_share" numeric(20,6) NOT NULL,"payment_date" date,"received_amount" numeric(20,2),"deduction_type" text,"status" text DEFAULT 'pending'::text NOT NULL,"source" text DEFAULT 'manual'::text NOT NULL,"note" text,"created_at" timestamp with time zone DEFAULT now() NOT NULL,"updated_at" timestamp with time zone DEFAULT now() NOT NULL,"dividend_type" text DEFAULT 'cash'::text NOT NULL,"stock_dividend_rate" numeric(20,6) DEFAULT 0 NOT NULL,"shares_received" numeric(20,6));
ALTER TABLE public."account_records" ADD CONSTRAINT "account_records_pkey" PRIMARY KEY (id);
ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_pkey" PRIMARY KEY (id);
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_pkey" PRIMARY KEY (id);
ALTER TABLE public."calendar_events" ADD CONSTRAINT "calendar_events_pkey" PRIMARY KEY (id);
ALTER TABLE public."categories" ADD CONSTRAINT "categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."category_groups" ADD CONSTRAINT "category_groups_pkey" PRIMARY KEY (id);
ALTER TABLE public."investment_accounts" ADD CONSTRAINT "investment_accounts_pkey" PRIMARY KEY (id);
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_pkey" PRIMARY KEY (id);
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_pkey" PRIMARY KEY (id);
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_pkey" PRIMARY KEY (id);
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_pkey" PRIMARY KEY (id);
ALTER TABLE public."ledger_categories" ADD CONSTRAINT "ledger_categories_pkey" PRIMARY KEY (id);
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_pkey" PRIMARY KEY (id);
ALTER TABLE public."ledger_merchants" ADD CONSTRAINT "ledger_merchants_pkey" PRIMARY KEY (id);
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_pkey" PRIMARY KEY (id);
ALTER TABLE public."members" ADD CONSTRAINT "members_pkey" PRIMARY KEY (id);
ALTER TABLE public."notes" ADD CONSTRAINT "notes_pkey" PRIMARY KEY (id);
ALTER TABLE public."payers" ADD CONSTRAINT "payers_pkey" PRIMARY KEY (id);
ALTER TABLE public."payment_methods" ADD CONSTRAINT "payment_methods_pkey" PRIMARY KEY (id);
ALTER TABLE public."payments" ADD CONSTRAINT "payments_pkey" PRIMARY KEY (id);
ALTER TABLE public."settlement_items" ADD CONSTRAINT "settlement_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_pkey" PRIMARY KEY (id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_pkey" PRIMARY KEY (id);
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_pkey" PRIMARY KEY (id);
ALTER TABLE public."shopping_items" ADD CONSTRAINT "shopping_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."stickies" ADD CONSTRAINT "stickies_pkey" PRIMARY KEY (id);
ALTER TABLE public."sticky_items" ADD CONSTRAINT "sticky_items_pkey" PRIMARY KEY (id);
ALTER TABLE public."user_workspaces" ADD CONSTRAINT "user_workspaces_pkey" PRIMARY KEY (id);
ALTER TABLE public."workspaces" ADD CONSTRAINT "workspaces_pkey" PRIMARY KEY (id);
ALTER TABLE public."category_groups" ADD CONSTRAINT "category_groups_workspace_id_type_name_key" UNIQUE (workspace_id, type, name);
ALTER TABLE public."investment_accounts" ADD CONSTRAINT "investment_accounts_workspace_name_unique" UNIQUE (workspace_id, name);
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_workspace_market_symbol_unique" UNIQUE (workspace_id, market, symbol);
ALTER TABLE public."payers" ADD CONSTRAINT "payers_workspace_id_name_key" UNIQUE (workspace_id, name);
ALTER TABLE public."payment_methods" ADD CONSTRAINT "payment_methods_workspace_id_name_key" UNIQUE (workspace_id, name);
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_settlement_id_split_id_key" UNIQUE (settlement_id, split_id);
ALTER TABLE public."user_workspaces" ADD CONSTRAINT "unique_user_workspace" UNIQUE (user_id, workspace_id);
ALTER TABLE public."accounts" ADD CONSTRAINT "accounts_type_check" CHECK ((type = ANY (ARRAY['bank'::text, 'cash'::text, 'credit_card'::text])));
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_amount_due_check" CHECK (((amount_due IS NULL) OR (amount_due >= (0)::numeric))) NOT VALID;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_paid_total_check" CHECK ((paid_total >= (0)::numeric)) NOT VALID;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_payment_mode_check" CHECK ((payment_mode = ANY (ARRAY['ledger'::text, 'status_only'::text]))) NOT VALID;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_period_check" CHECK ((period ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'::text)) NOT VALID;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_source_check" CHECK ((source = ANY (ARRAY['manual'::text, 'template'::text]))) NOT VALID;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_status_check" CHECK ((status = ANY (ARRAY['awaiting_details'::text, 'unpaid'::text, 'partial'::text, 'paid'::text]))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_active_range_check" CHECK (((ends_on IS NULL) OR (ends_on >= starts_on))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_amount_mode_check" CHECK ((amount_mode = ANY (ARRAY['fixed'::text, 'variable'::text]))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_due_day_check" CHECK (((due_day IS NULL) OR ((due_day >= 1) AND (due_day <= 31)))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_fixed_amount_check" CHECK ((((amount_mode = 'fixed'::text) AND (amount_default IS NOT NULL) AND (amount_default >= (0)::numeric)) OR ((amount_mode = 'variable'::text) AND (amount_default IS NULL)))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_generate_day_check" CHECK (((generate_day >= 1) AND (generate_day <= 28))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_payment_mode_check" CHECK ((payment_mode = ANY (ARRAY['ledger'::text, 'status_only'::text]))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_schedule_months_check" CHECK (((schedule_type = 'monthly'::text) OR ((schedule_months IS NOT NULL) AND (cardinality(schedule_months) > 0) AND (schedule_months <@ ARRAY[(1)::smallint, (2)::smallint, (3)::smallint, (4)::smallint, (5)::smallint, (6)::smallint, (7)::smallint, (8)::smallint, (9)::smallint, (10)::smallint, (11)::smallint, (12)::smallint])))) NOT VALID;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_schedule_type_check" CHECK ((schedule_type = ANY (ARRAY['monthly'::text, 'months'::text]))) NOT VALID;
ALTER TABLE public."categories" ADD CONSTRAINT "categories_type_check" CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text])));
ALTER TABLE public."category_groups" ADD CONSTRAINT "category_groups_type_check" CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text])));
ALTER TABLE public."investment_accounts" ADD CONSTRAINT "investment_accounts_currency_format" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."investment_accounts" ADD CONSTRAINT "investment_accounts_name_not_blank" CHECK ((char_length(btrim(name)) > 0));
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_source_valid" CHECK ((source = ANY (ARRAY['manual'::text, 'csv'::text, 'excel'::text])));
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_type_valid" CHECK ((action_type = ANY (ARRAY['capital_reduction'::text, 'loss_reduction'::text])));
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_values_valid" CHECK (((quantity_before > (0)::numeric) AND (reduction_ratio > (0)::numeric) AND (reduction_ratio < (1)::numeric) AND (quantity_after >= (0)::numeric) AND (quantity_after < quantity_before) AND (cash_return >= (0)::numeric) AND (cost_adjustment >= (0)::numeric)));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_deduction_type_valid" CHECK (((deduction_type IS NULL) OR (deduction_type = ANY (ARRAY['transfer_fee'::text, 'nhi'::text, 'withholding_tax'::text, 'other'::text, 'unclassified'::text]))));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_source_valid" CHECK ((source = ANY (ARRAY['manual'::text, 'csv'::text, 'excel'::text])));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_status_valid" CHECK ((status = ANY (ARRAY['pending'::text, 'received'::text])));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_type_fields_valid" CHECK ((((dividend_type = 'cash'::text) AND (stock_dividend_rate = (0)::numeric) AND (shares_received IS NULL)) OR ((dividend_type = 'stock'::text) AND (dividend_per_share = (0)::numeric) AND (received_amount IS NULL) AND (deduction_type IS NULL) AND (stock_dividend_rate > (0)::numeric) AND ((shares_received IS NULL) OR (shares_received > (0)::numeric)))));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_type_valid" CHECK ((dividend_type = ANY (ARRAY['cash'::text, 'stock'::text])));
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_values_valid" CHECK (((eligible_quantity > (0)::numeric) AND (dividend_per_share >= (0)::numeric) AND ((received_amount IS NULL) OR (received_amount >= (0)::numeric))));
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_currency_format" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_market_not_blank" CHECK ((char_length(btrim(market)) > 0));
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_name_not_blank" CHECK ((char_length(btrim(name)) > 0));
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_price_nonnegative" CHECK (((current_price IS NULL) OR (current_price >= (0)::numeric)));
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_symbol_not_blank" CHECK ((char_length(btrim(symbol)) > 0));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_amounts_nonnegative" CHECK (((quantity >= (0)::numeric) AND (price >= (0)::numeric) AND (fee >= (0)::numeric) AND (tax >= (0)::numeric) AND (cash_amount >= (0)::numeric)));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_currency_format" CHECK ((currency ~ '^[A-Z]{3}$'::text));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_settlement_nonnegative" CHECK (((settlement_amount IS NULL) OR (settlement_amount >= (0)::numeric)));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_source_valid" CHECK ((source = ANY (ARRAY['manual'::text, 'csv'::text, 'excel'::text])));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_type_fields_valid" CHECK ((((transaction_type = ANY (ARRAY['buy'::text, 'sell'::text])) AND (quantity > (0)::numeric) AND (price > (0)::numeric) AND (cash_amount = (0)::numeric)) OR ((transaction_type = 'dividend'::text) AND (quantity = (0)::numeric) AND (price = (0)::numeric) AND (cash_amount > (0)::numeric))));
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_type_valid" CHECK ((transaction_type = ANY (ARRAY['buy'::text, 'sell'::text, 'dividend'::text])));
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_consumption_content_check" CHECK (((consumption_content IS NULL) OR (char_length(consumption_content) <= 1000)));
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_type_check" CHECK ((type = ANY (ARRAY['expense'::text, 'income'::text])));
ALTER TABLE public."ledger_merchants" ADD CONSTRAINT "ledger_merchants_name_check" CHECK (((name = btrim(name)) AND ((char_length(name) >= 1) AND (char_length(name) <= 120))));
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_amount_check" CHECK ((amount >= (0)::numeric));
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_amount_positive_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."settlement_items" ADD CONSTRAINT "settlement_items_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."settlement_items" ADD CONSTRAINT "settlement_items_amount_positive_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_amount_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_amount_positive_check" CHECK ((amount > (0)::numeric));
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_content_present" CHECK (((char_length(btrim(COALESCE(platform, ''::text))) > 0) OR (char_length(btrim(COALESCE(url, ''::text))) > 0) OR (price IS NOT NULL) OR (char_length(btrim(COALESCE(note, ''::text))) > 0)));
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_price_nonnegative" CHECK (((price IS NULL) OR (price >= (0)::numeric)));
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_url_length" CHECK (((url IS NULL) OR (char_length(url) <= 2048)));
ALTER TABLE public."shopping_items" ADD CONSTRAINT "shopping_items_name_not_blank" CHECK ((char_length(btrim(name)) > 0));
ALTER TABLE public."shopping_items" ADD CONSTRAINT "shopping_items_priority_check" CHECK ((priority = ANY (ARRAY['low'::text, 'normal'::text, 'high'::text])));
ALTER TABLE public."shopping_items" ADD CONSTRAINT "shopping_items_status_check" CHECK ((status = ANY (ARRAY['pending'::text, 'planned'::text, 'waiting_sale'::text, 'purchased'::text, 'skipped'::text])));
DO $idx$ BEGIN IF to_regclass('public."bill_instances_pkey"') IS NULL THEN CREATE UNIQUE INDEX bill_instances_pkey ON public.bill_instances USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."bill_instances_template_period_unique"') IS NULL THEN CREATE UNIQUE INDEX bill_instances_template_period_unique ON public.bill_instances USING btree (workspace_id, template_id, period) WHERE (template_id IS NOT NULL); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."bill_instances_template_id_idx"') IS NULL THEN CREATE INDEX bill_instances_template_id_idx ON public.bill_instances USING btree (template_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."bill_templates_pkey"') IS NULL THEN CREATE UNIQUE INDEX bill_templates_pkey ON public.bill_templates USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."bill_templates_generation_lookup"') IS NULL THEN CREATE INDEX bill_templates_generation_lookup ON public.bill_templates USING btree (active, starts_on, ends_on); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_workspace_id_settlement_id_idx"') IS NULL THEN CREATE INDEX settlement_items_workspace_id_settlement_id_idx ON public.settlement_items USING btree (workspace_id, settlement_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_pkey"') IS NULL THEN CREATE UNIQUE INDEX settlement_items_pkey ON public.settlement_items USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_workspace_id_split_id_idx"') IS NULL THEN CREATE INDEX settlement_items_workspace_id_split_id_idx ON public.settlement_items USING btree (workspace_id, split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_ws_idx"') IS NULL THEN CREATE INDEX settlement_items_ws_idx ON public.settlement_items USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_split_idx"') IS NULL THEN CREATE INDEX settlement_items_split_idx ON public.settlement_items USING btree (split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_settlement_idx"') IS NULL THEN CREATE INDEX settlement_items_settlement_idx ON public.settlement_items USING btree (settlement_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_ws_split_idx"') IS NULL THEN CREATE INDEX settlement_items_ws_split_idx ON public.settlement_items USING btree (workspace_id, split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_ws_settlement_idx"') IS NULL THEN CREATE INDEX settlement_items_ws_settlement_idx ON public.settlement_items USING btree (workspace_id, settlement_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_workspace_settlement_idx"') IS NULL THEN CREATE INDEX settlement_items_workspace_settlement_idx ON public.settlement_items USING btree (workspace_id, settlement_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_items_workspace_split_idx"') IS NULL THEN CREATE INDEX settlement_items_workspace_split_idx ON public.settlement_items USING btree (workspace_id, split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_entries_pkey"') IS NULL THEN CREATE UNIQUE INDEX ledger_entries_pkey ON public.ledger_entries USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_ledger_entries_ws_date"') IS NULL THEN CREATE INDEX idx_ledger_entries_ws_date ON public.ledger_entries USING btree (workspace_id, entry_date); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_ledger_entries_ws"') IS NULL THEN CREATE INDEX idx_ledger_entries_ws ON public.ledger_entries USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_entries_workspace_id_id_key"') IS NULL THEN CREATE UNIQUE INDEX ledger_entries_workspace_id_id_key ON public.ledger_entries USING btree (workspace_id, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_entries_workspace_date_idx"') IS NULL THEN CREATE INDEX ledger_entries_workspace_date_idx ON public.ledger_entries USING btree (workspace_id, entry_date DESC); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_entries_workspace_request_key_unique"') IS NULL THEN CREATE UNIQUE INDEX ledger_entries_workspace_request_key_unique ON public.ledger_entries USING btree (workspace_id, request_key) WHERE (request_key IS NOT NULL); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."calendar_events_pkey"') IS NULL THEN CREATE UNIQUE INDEX calendar_events_pkey ON public.calendar_events USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."cal_workspace_idx"') IS NULL THEN CREATE INDEX cal_workspace_idx ON public.calendar_events USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."cal_start_at_idx"') IS NULL THEN CREATE INDEX cal_start_at_idx ON public.calendar_events USING btree (workspace_id, start_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."cal_deleted_at_idx"') IS NULL THEN CREATE INDEX cal_deleted_at_idx ON public.calendar_events USING btree (workspace_id, deleted_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_categories_pkey"') IS NULL THEN CREATE UNIQUE INDEX ledger_categories_pkey ON public.ledger_categories USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."notes_pkey"') IS NULL THEN CREATE UNIQUE INDEX notes_pkey ON public.notes USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."notes_workspace_idx"') IS NULL THEN CREATE INDEX notes_workspace_idx ON public.notes USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."notes_note_date_idx"') IS NULL THEN CREATE INDEX notes_note_date_idx ON public.notes USING btree (workspace_id, note_date); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."notes_deleted_at_idx"') IS NULL THEN CREATE INDEX notes_deleted_at_idx ON public.notes USING btree (workspace_id, deleted_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_notes_workspace_date_from"') IS NULL THEN CREATE INDEX idx_notes_workspace_date_from ON public.notes USING btree (workspace_id, date_from); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_notes_workspace_date_to"') IS NULL THEN CREATE INDEX idx_notes_workspace_date_to ON public.notes USING btree (workspace_id, date_to); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_notes_ws"') IS NULL THEN CREATE INDEX idx_notes_ws ON public.notes USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."payers_pkey"') IS NULL THEN CREATE UNIQUE INDEX payers_pkey ON public.payers USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."payers_workspace_id_name_key"') IS NULL THEN CREATE UNIQUE INDEX payers_workspace_id_name_key ON public.payers USING btree (workspace_id, name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."payment_methods_pkey"') IS NULL THEN CREATE UNIQUE INDEX payment_methods_pkey ON public.payment_methods USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."payment_methods_workspace_id_name_key"') IS NULL THEN CREATE UNIQUE INDEX payment_methods_workspace_id_name_key ON public.payment_methods USING btree (workspace_id, name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_payment_methods_ws_sort"') IS NULL THEN CREATE INDEX idx_payment_methods_ws_sort ON public.payment_methods USING btree (workspace_id, is_active, sort, created_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_payment_methods_workspace_active"') IS NULL THEN CREATE INDEX idx_payment_methods_workspace_active ON public.payment_methods USING btree (workspace_id, is_active); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_payment_methods_workspace_pin_sort"') IS NULL THEN CREATE INDEX idx_payment_methods_workspace_pin_sort ON public.payment_methods USING btree (workspace_id, is_pinned, sort_order); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_split_links_pkey"') IS NULL THEN CREATE UNIQUE INDEX settlement_split_links_pkey ON public.settlement_split_links USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlement_split_links_settlement_id_split_id_key"') IS NULL THEN CREATE UNIQUE INDEX settlement_split_links_settlement_id_split_id_key ON public.settlement_split_links USING btree (settlement_id, split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_settle_link_ws"') IS NULL THEN CREATE INDEX idx_settle_link_ws ON public.settlement_split_links USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_settle_link_split"') IS NULL THEN CREATE INDEX idx_settle_link_split ON public.settlement_split_links USING btree (split_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_settle_link_settlement"') IS NULL THEN CREATE INDEX idx_settle_link_settlement ON public.settlement_split_links USING btree (settlement_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."stickies_pkey"') IS NULL THEN CREATE UNIQUE INDEX stickies_pkey ON public.stickies USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."stickies_workspace_idx"') IS NULL THEN CREATE INDEX stickies_workspace_idx ON public.stickies USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."stickies_owner_idx"') IS NULL THEN CREATE INDEX stickies_owner_idx ON public.stickies USING btree (owner); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."stickies_due_idx"') IS NULL THEN CREATE INDEX stickies_due_idx ON public.stickies USING btree (due_date); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."account_records_pkey"') IS NULL THEN CREATE UNIQUE INDEX account_records_pkey ON public.account_records USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_account_records_ws_date"') IS NULL THEN CREATE INDEX idx_account_records_ws_date ON public.account_records USING btree (workspace_id, record_date DESC); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_account_records_account_date"') IS NULL THEN CREATE INDEX idx_account_records_account_date ON public.account_records USING btree (account_id, record_date DESC); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."accounts_pkey"') IS NULL THEN CREATE UNIQUE INDEX accounts_pkey ON public.accounts USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_accounts_ws_type_sort"') IS NULL THEN CREATE INDEX idx_accounts_ws_type_sort ON public.accounts USING btree (workspace_id, type, sort_order); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_accounts_ws_active"') IS NULL THEN CREATE INDEX idx_accounts_ws_active ON public.accounts USING btree (workspace_id, is_active); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."categories_pkey"') IS NULL THEN CREATE UNIQUE INDEX categories_pkey ON public.categories USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_categories_workspace_type"') IS NULL THEN CREATE INDEX idx_categories_workspace_type ON public.categories USING btree (workspace_id, type); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_categories_workspace_active"') IS NULL THEN CREATE INDEX idx_categories_workspace_active ON public.categories USING btree (workspace_id, is_active); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_categories_workspace_group"') IS NULL THEN CREATE INDEX idx_categories_workspace_group ON public.categories USING btree (workspace_id, group_name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_categories_workspace_group_sort"') IS NULL THEN CREATE INDEX idx_categories_workspace_group_sort ON public.categories USING btree (workspace_id, group_name, sort_order); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."category_groups_pkey"') IS NULL THEN CREATE UNIQUE INDEX category_groups_pkey ON public.category_groups USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."category_groups_workspace_id_type_name_key"') IS NULL THEN CREATE UNIQUE INDEX category_groups_workspace_id_type_name_key ON public.category_groups USING btree (workspace_id, type, name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_category_groups_ws_type_sort"') IS NULL THEN CREATE INDEX idx_category_groups_ws_type_sort ON public.category_groups USING btree (workspace_id, type, sort_order); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."payments_pkey"') IS NULL THEN CREATE UNIQUE INDEX payments_pkey ON public.payments USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."sticky_items_pkey"') IS NULL THEN CREATE UNIQUE INDEX sticky_items_pkey ON public.sticky_items USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."sticky_items_sticky_idx"') IS NULL THEN CREATE INDEX sticky_items_sticky_idx ON public.sticky_items USING btree (sticky_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."sticky_items_sort_idx"') IS NULL THEN CREATE INDEX sticky_items_sort_idx ON public.sticky_items USING btree (sticky_id, sort); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."sticky_items_sticky_id_idx"') IS NULL THEN CREATE INDEX sticky_items_sticky_id_idx ON public.sticky_items USING btree (sticky_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."members_pkey"') IS NULL THEN CREATE UNIQUE INDEX members_pkey ON public.members USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."user_workspaces_pkey"') IS NULL THEN CREATE UNIQUE INDEX user_workspaces_pkey ON public.user_workspaces USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."unique_user_workspace"') IS NULL THEN CREATE UNIQUE INDEX unique_user_workspace ON public.user_workspaces USING btree (user_id, workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_user_workspaces_user"') IS NULL THEN CREATE INDEX idx_user_workspaces_user ON public.user_workspaces USING btree (user_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_user_workspaces_ws"') IS NULL THEN CREATE INDEX idx_user_workspaces_ws ON public.user_workspaces USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."workspaces_pkey"') IS NULL THEN CREATE UNIQUE INDEX workspaces_pkey ON public.workspaces USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_splits_pkey"') IS NULL THEN CREATE UNIQUE INDEX ledger_splits_pkey ON public.ledger_splits USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_splits_ws_entry"') IS NULL THEN CREATE INDEX idx_splits_ws_entry ON public.ledger_splits USING btree (workspace_id, entry_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_splits_ws_payer"') IS NULL THEN CREATE INDEX idx_splits_ws_payer ON public.ledger_splits USING btree (workspace_id, payer_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_ledger_splits_ws"') IS NULL THEN CREATE INDEX idx_ledger_splits_ws ON public.ledger_splits USING btree (workspace_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_splits_workspace_id_id_key"') IS NULL THEN CREATE UNIQUE INDEX ledger_splits_workspace_id_id_key ON public.ledger_splits USING btree (workspace_id, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_splits_workspace_entry_idx"') IS NULL THEN CREATE INDEX ledger_splits_workspace_entry_idx ON public.ledger_splits USING btree (workspace_id, entry_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_splits_entry_payer_unique"') IS NULL THEN CREATE UNIQUE INDEX ledger_splits_entry_payer_unique ON public.ledger_splits USING btree (workspace_id, entry_id, payer_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlements_pkey"') IS NULL THEN CREATE UNIQUE INDEX settlements_pkey ON public.settlements USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_settlements_ws_date"') IS NULL THEN CREATE INDEX idx_settlements_ws_date ON public.settlements USING btree (workspace_id, settled_date); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."idx_settlements_ws_pair"') IS NULL THEN CREATE INDEX idx_settlements_ws_pair ON public.settlements USING btree (workspace_id, debtor_id, creditor_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlements_ws_date_idx"') IS NULL THEN CREATE INDEX settlements_ws_date_idx ON public.settlements USING btree (workspace_id, from_date, to_date); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlements_ws_created_idx"') IS NULL THEN CREATE INDEX settlements_ws_created_idx ON public.settlements USING btree (workspace_id, created_at DESC); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlements_workspace_id_id_key"') IS NULL THEN CREATE UNIQUE INDEX settlements_workspace_id_id_key ON public.settlements USING btree (workspace_id, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."settlements_workspace_request_key_unique"') IS NULL THEN CREATE UNIQUE INDEX settlements_workspace_request_key_unique ON public.settlements USING btree (workspace_id, request_key) WHERE (request_key IS NOT NULL); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_merchants_pkey"') IS NULL THEN CREATE UNIQUE INDEX ledger_merchants_pkey ON public.ledger_merchants USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_merchants_workspace_name_key"') IS NULL THEN CREATE UNIQUE INDEX ledger_merchants_workspace_name_key ON public.ledger_merchants USING btree (workspace_id, lower(name)); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."ledger_merchants_workspace_sort_idx"') IS NULL THEN CREATE INDEX ledger_merchants_workspace_sort_idx ON public.ledger_merchants USING btree (workspace_id, sort_order, created_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_items_pkey"') IS NULL THEN CREATE UNIQUE INDEX shopping_items_pkey ON public.shopping_items USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_items_workspace_active_order_idx"') IS NULL THEN CREATE INDEX shopping_items_workspace_active_order_idx ON public.shopping_items USING btree (workspace_id, status, sort_order, created_at DESC) WHERE (deleted_at IS NULL); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_items_workspace_planned_date_idx"') IS NULL THEN CREATE INDEX shopping_items_workspace_planned_date_idx ON public.shopping_items USING btree (workspace_id, planned_date) WHERE ((deleted_at IS NULL) AND (planned_date IS NOT NULL)); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_accounts_pkey"') IS NULL THEN CREATE UNIQUE INDEX investment_accounts_pkey ON public.investment_accounts USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_accounts_workspace_name_unique"') IS NULL THEN CREATE UNIQUE INDEX investment_accounts_workspace_name_unique ON public.investment_accounts USING btree (workspace_id, name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_accounts_workspace_order_idx"') IS NULL THEN CREATE INDEX investment_accounts_workspace_order_idx ON public.investment_accounts USING btree (workspace_id, is_active DESC, sort_order, name); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_securities_pkey"') IS NULL THEN CREATE UNIQUE INDEX investment_securities_pkey ON public.investment_securities USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_securities_workspace_market_symbol_unique"') IS NULL THEN CREATE UNIQUE INDEX investment_securities_workspace_market_symbol_unique ON public.investment_securities USING btree (workspace_id, market, symbol); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_securities_workspace_order_idx"') IS NULL THEN CREATE INDEX investment_securities_workspace_order_idx ON public.investment_securities USING btree (workspace_id, is_active DESC, sort_order, market, symbol); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_item_sources_pkey"') IS NULL THEN CREATE UNIQUE INDEX shopping_item_sources_pkey ON public.shopping_item_sources USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_item_sources_item_order_idx"') IS NULL THEN CREATE INDEX shopping_item_sources_item_order_idx ON public.shopping_item_sources USING btree (shopping_item_id, sort_order, created_at); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."shopping_item_sources_workspace_item_idx"') IS NULL THEN CREATE INDEX shopping_item_sources_workspace_item_idx ON public.shopping_item_sources USING btree (workspace_id, shopping_item_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_transactions_pkey"') IS NULL THEN CREATE UNIQUE INDEX investment_transactions_pkey ON public.investment_transactions USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_transactions_workspace_date_idx"') IS NULL THEN CREATE INDEX investment_transactions_workspace_date_idx ON public.investment_transactions USING btree (workspace_id, trade_date DESC, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_transactions_account_security_date_idx"') IS NULL THEN CREATE INDEX investment_transactions_account_security_date_idx ON public.investment_transactions USING btree (account_id, security_id, trade_date, created_at, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_transactions_security_id_idx"') IS NULL THEN CREATE INDEX investment_transactions_security_id_idx ON public.investment_transactions USING btree (security_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_transactions_order_unique_idx"') IS NULL THEN CREATE UNIQUE INDEX investment_transactions_order_unique_idx ON public.investment_transactions USING btree (workspace_id, account_id, trade_date, upper(btrim(order_number))) WHERE ((order_number IS NOT NULL) AND (btrim(order_number) <> ''::text)); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_corporate_actions_pkey"') IS NULL THEN CREATE UNIQUE INDEX investment_corporate_actions_pkey ON public.investment_corporate_actions USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_corporate_actions_workspace_date_idx"') IS NULL THEN CREATE INDEX investment_corporate_actions_workspace_date_idx ON public.investment_corporate_actions USING btree (workspace_id, event_date DESC, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_corporate_actions_account_security_date_idx"') IS NULL THEN CREATE INDEX investment_corporate_actions_account_security_date_idx ON public.investment_corporate_actions USING btree (account_id, security_id, event_date, created_at, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_corporate_actions_security_id_idx"') IS NULL THEN CREATE INDEX investment_corporate_actions_security_id_idx ON public.investment_corporate_actions USING btree (security_id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_dividends_pkey"') IS NULL THEN CREATE UNIQUE INDEX investment_dividends_pkey ON public.investment_dividends USING btree (id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_dividends_workspace_date_idx"') IS NULL THEN CREATE INDEX investment_dividends_workspace_date_idx ON public.investment_dividends USING btree (workspace_id, ex_dividend_date DESC, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_dividends_account_security_date_idx"') IS NULL THEN CREATE INDEX investment_dividends_account_security_date_idx ON public.investment_dividends USING btree (account_id, security_id, ex_dividend_date, created_at, id); END IF; END $idx$;
DO $idx$ BEGIN IF to_regclass('public."investment_dividends_security_id_idx"') IS NULL THEN CREATE INDEX investment_dividends_security_id_idx ON public.investment_dividends USING btree (security_id); END IF; END $idx$;
ALTER TABLE public."account_records" ADD CONSTRAINT "account_records_account_id_fkey" FOREIGN KEY (account_id) REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_template_id_fkey" FOREIGN KEY (template_id) REFERENCES bill_templates(id) ON DELETE SET NULL;
ALTER TABLE public."bill_instances" ADD CONSTRAINT "bill_instances_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."bill_templates" ADD CONSTRAINT "bill_templates_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."investment_accounts" ADD CONSTRAINT "investment_accounts_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES investment_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_security_id_fkey" FOREIGN KEY (security_id) REFERENCES investment_securities(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_corporate_actions" ADD CONSTRAINT "investment_corporate_actions_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_account_id_fkey" FOREIGN KEY (account_id) REFERENCES investment_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_security_id_fkey" FOREIGN KEY (security_id) REFERENCES investment_securities(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_dividends" ADD CONSTRAINT "investment_dividends_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."investment_securities" ADD CONSTRAINT "investment_securities_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_account_id_fkey" FOREIGN KEY (account_id) REFERENCES investment_accounts(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_security_id_fkey" FOREIGN KEY (security_id) REFERENCES investment_securities(id) ON DELETE RESTRICT;
ALTER TABLE public."investment_transactions" ADD CONSTRAINT "investment_transactions_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."ledger_categories" ADD CONSTRAINT "ledger_categories_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_bill_instance_id_fkey" FOREIGN KEY (bill_instance_id) REFERENCES bill_instances(id) ON DELETE SET NULL;
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_category_id_fkey" FOREIGN KEY (category_id) REFERENCES ledger_categories(id) ON DELETE SET NULL;
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_payer_id_fkey" FOREIGN KEY (payer_id) REFERENCES payers(id);
ALTER TABLE public."ledger_entries" ADD CONSTRAINT "ledger_entries_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."ledger_merchants" ADD CONSTRAINT "ledger_merchants_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_payer_id_fkey" FOREIGN KEY (payer_id) REFERENCES payers(id);
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_workspace_entry_fkey" FOREIGN KEY (workspace_id, entry_id) REFERENCES ledger_entries(workspace_id, id) ON DELETE CASCADE;
ALTER TABLE public."ledger_splits" ADD CONSTRAINT "ledger_splits_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."members" ADD CONSTRAINT "members_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."payers" ADD CONSTRAINT "payers_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."payment_methods" ADD CONSTRAINT "payment_methods_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_bill_instance_id_fkey" FOREIGN KEY (bill_instance_id) REFERENCES bill_instances(id) ON DELETE CASCADE;
ALTER TABLE public."payments" ADD CONSTRAINT "payments_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."settlement_items" ADD CONSTRAINT "settlement_items_workspace_settlement_fkey" FOREIGN KEY (workspace_id, settlement_id) REFERENCES settlements(workspace_id, id) ON DELETE CASCADE;
ALTER TABLE public."settlement_items" ADD CONSTRAINT "settlement_items_workspace_split_fkey" FOREIGN KEY (workspace_id, split_id) REFERENCES ledger_splits(workspace_id, id) ON DELETE RESTRICT;
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_settlement_id_fkey" FOREIGN KEY (settlement_id) REFERENCES settlements(id) ON DELETE CASCADE;
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_split_id_fkey" FOREIGN KEY (split_id) REFERENCES ledger_splits(id) ON DELETE CASCADE;
ALTER TABLE public."settlement_split_links" ADD CONSTRAINT "settlement_split_links_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_creditor_id_fkey" FOREIGN KEY (creditor_id) REFERENCES payers(id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_debtor_id_fkey" FOREIGN KEY (debtor_id) REFERENCES payers(id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_from_payer_fk" FOREIGN KEY (from_payer_id) REFERENCES payers(id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_to_payer_fk" FOREIGN KEY (to_payer_id) REFERENCES payers(id);
ALTER TABLE public."settlements" ADD CONSTRAINT "settlements_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_shopping_item_id_fkey" FOREIGN KEY (shopping_item_id) REFERENCES shopping_items(id) ON DELETE CASCADE;
ALTER TABLE public."shopping_item_sources" ADD CONSTRAINT "shopping_item_sources_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."shopping_items" ADD CONSTRAINT "shopping_items_workspace_id_fkey" FOREIGN KEY (workspace_id) REFERENCES workspaces(id) ON DELETE CASCADE;
ALTER TABLE public."sticky_items" ADD CONSTRAINT "sticky_items_sticky_id_fkey" FOREIGN KEY (sticky_id) REFERENCES stickies(id) ON DELETE CASCADE;
ALTER TABLE public."user_workspaces" ADD CONSTRAINT "user_workspaces_user_id_fkey" FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;
CREATE OR REPLACE FUNCTION private.assert_workspace_member(p_workspace_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  if auth.uid() is null or not exists (
    select 1
    from public.user_workspaces uw
    where uw.user_id = auth.uid()
      and uw.workspace_id = p_workspace_id
  ) then
    raise exception 'workspace access denied' using errcode = '42501';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION private.generate_bill_instances(p_period date DEFAULT CURRENT_DATE)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'private', 'public', 'pg_temp'
AS $function$
declare
  v_period_start date := date_trunc('month', p_period)::date;
  v_period_end date := (date_trunc('month', p_period) + interval '1 month - 1 day')::date;
  v_inserted integer;
begin
  insert into public.bill_instances (
    workspace_id,
    template_id,
    period,
    due_date,
    name_snapshot,
    amount_due,
    status,
    paid_total,
    billing_start,
    billing_end,
    source,
    payment_mode
  )
  select
    template.workspace_id,
    template.id,
    to_char(v_period_start, 'YYYY-MM'),
    case
      when template.due_day is null then null
      else v_period_start + (
        least(template.due_day, extract(day from v_period_end)::integer) - 1
      )
    end,
    template.name,
    case
      when template.amount_mode = 'fixed' then template.amount_default
      else null
    end,
    case
      when template.amount_mode = 'variable' or template.due_day is null
        then 'awaiting_details'
      else 'unpaid'
    end,
    0,
    v_period_start,
    v_period_end,
    'template',
    template.payment_mode
  from public.bill_templates as template
  where template.active
    and template.starts_on <= v_period_end
    and (template.ends_on is null or template.ends_on >= v_period_start)
    and (
      template.schedule_type = 'monthly'
      or (
        template.schedule_type = 'months'
        and extract(month from v_period_start)::smallint = any(template.schedule_months)
      )
    )
  on conflict (workspace_id, template_id, period)
    where template_id is not null
    do nothing;

  get diagnostics v_inserted = row_count;
  return v_inserted;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog'
AS $function$
begin
  new.updated_at = now();
  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recalc_bill_status_on_update()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update bill_instances
  set status = case
    when paid_total <= 0 then 'unpaid'
    when paid_total < amount_due then 'partial'
    else 'paid'
  end
  where id = new.id;

  return new;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.recalc_paid_total()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public'
AS $function$
begin
  update bill_instances bi
  set paid_total = coalesce((
    select sum(p.amount_paid) from payments p where p.bill_instance_id = bi.id
  ), 0)
  where bi.id = coalesce(new.bill_instance_id, old.bill_instance_id);

  update bill_instances
  set status = case
    when paid_total <= 0 then 'unpaid'
    when paid_total < amount_due then 'partial'
    else 'paid'
  end
  where id = coalesce(new.bill_instance_id, old.bill_instance_id);

  return null;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_ledger_entry_atomic(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_entry_id uuid;
  v_split_total numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_entry_date is null or p_type not in ('expense', 'income') or p_amount <= 0 then
    raise exception 'invalid ledger entry';
  end if;

  if p_request_key is not null then
    select id into v_entry_id
    from public.ledger_entries
    where workspace_id = p_workspace_id
      and request_key = p_request_key;
    if v_entry_id is not null then
      return v_entry_id;
    end if;
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.ledger_categories
    where id = p_category_id and workspace_id = p_workspace_id
  ) then
    raise exception 'category does not belong to workspace';
  end if;

  if p_payer_id is not null and not exists (
    select 1 from public.payers
    where id = p_payer_id and workspace_id = p_workspace_id
  ) then
    raise exception 'payer does not belong to workspace';
  end if;

  if coalesce(jsonb_typeof(p_splits), 'array') <> 'array' then
    raise exception 'splits must be an array';
  end if;

  select coalesce(sum(x.amount), 0)
    into v_split_total
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if v_split_total > 0 then
    if p_type <> 'expense' or p_payer_id is null or v_split_total > p_amount then
      raise exception 'invalid split allocation';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_splits) as x(payer_id uuid, amount numeric)
      where x.payer_id is null
        or x.payer_id = p_payer_id
        or x.amount <= 0
        or not exists (
          select 1 from public.payers p
          where p.id = x.payer_id and p.workspace_id = p_workspace_id
        )
    ) then
      raise exception 'invalid split participant';
    end if;

    if exists (
      select 1
      from jsonb_to_recordset(p_splits) as x(payer_id uuid, amount numeric)
      group by x.payer_id
      having count(*) > 1
    ) then
      raise exception 'duplicate split participant';
    end if;
  end if;

  insert into public.ledger_entries (
    workspace_id, entry_date, type, amount, category_id, pay_method,
    merchant, note, bill_instance_id, payer_id, request_key
  ) values (
    p_workspace_id, p_entry_date, p_type, p_amount, p_category_id, p_pay_method,
    p_merchant, p_note, p_bill_instance_id, p_payer_id, p_request_key
  )
  returning id into v_entry_id;

  insert into public.ledger_splits (workspace_id, entry_id, payer_id, amount)
  select p_workspace_id, v_entry_id, x.payer_id, x.amount
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  return v_entry_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_ledger_entry_atomic(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_locked_id uuid;
  v_split_total numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  select id into v_locked_id
  from public.ledger_entries
  where id = p_entry_id and workspace_id = p_workspace_id
  for update;

  if v_locked_id is null then
    raise exception 'ledger entry not found';
  end if;

  if exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) then
    raise exception 'settled ledger entry cannot be edited';
  end if;

  if p_entry_date is null or p_type not in ('expense', 'income') or p_amount <= 0 then
    raise exception 'invalid ledger entry';
  end if;

  if p_category_id is not null and not exists (
    select 1 from public.ledger_categories
    where id = p_category_id and workspace_id = p_workspace_id
  ) then
    raise exception 'category does not belong to workspace';
  end if;

  if p_payer_id is not null and not exists (
    select 1 from public.payers
    where id = p_payer_id and workspace_id = p_workspace_id
  ) then
    raise exception 'payer does not belong to workspace';
  end if;

  select coalesce(sum(x.amount), 0)
    into v_split_total
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if v_split_total > 0 and (
    p_type <> 'expense' or p_payer_id is null or v_split_total > p_amount
  ) then
    raise exception 'invalid split allocation';
  end if;

  if exists (
    select 1
    from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
      as x(payer_id uuid, amount numeric)
    where x.payer_id is null
      or x.payer_id = p_payer_id
      or x.amount <= 0
      or not exists (
        select 1 from public.payers p
        where p.id = x.payer_id and p.workspace_id = p_workspace_id
      )
  ) then
    raise exception 'invalid split participant';
  end if;

  update public.ledger_entries
  set entry_date = p_entry_date,
      type = p_type,
      amount = p_amount,
      category_id = p_category_id,
      pay_method = p_pay_method,
      merchant = p_merchant,
      note = p_note,
      payer_id = p_payer_id
  where id = p_entry_id and workspace_id = p_workspace_id;

  delete from public.ledger_splits
  where workspace_id = p_workspace_id and entry_id = p_entry_id;

  insert into public.ledger_splits (workspace_id, entry_id, payer_id, amount)
  select p_workspace_id, p_entry_id, x.payer_id, x.amount
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_ledger_entry_atomic(p_workspace_id uuid, p_entry_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  perform private.assert_workspace_member(p_workspace_id);

  if exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) then
    raise exception 'settled ledger entry cannot be deleted';
  end if;

  delete from public.ledger_entries
  where workspace_id = p_workspace_id and id = p_entry_id;

  if not found then
    raise exception 'ledger entry not found';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_settlement_atomic(p_workspace_id uuid, p_from date, p_to date, p_debtor_id uuid, p_creditor_id uuid, p_amount numeric, p_note text, p_split_id uuid, p_request_key text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_settlement_id uuid;
  v_remaining numeric := p_amount;
  v_take numeric;
  v_split record;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_request_key is null or length(p_request_key) < 16 then
    raise exception 'request key is required';
  end if;

  if p_from is null or p_to is null or p_from > p_to
     or p_amount <= 0 or p_debtor_id = p_creditor_id then
    raise exception 'invalid settlement';
  end if;

  if not exists (
    select 1 from public.payers
    where id = p_debtor_id and workspace_id = p_workspace_id
  ) or not exists (
    select 1 from public.payers
    where id = p_creditor_id and workspace_id = p_workspace_id
  ) then
    raise exception 'settlement participant does not belong to workspace';
  end if;

  select id into v_settlement_id
  from public.settlements
  where workspace_id = p_workspace_id and request_key = p_request_key;
  if v_settlement_id is not null then
    return v_settlement_id;
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended(
      p_workspace_id::text || ':' || p_debtor_id::text || ':' || p_creditor_id::text,
      0
    )
  );

  select id into v_settlement_id
  from public.settlements
  where workspace_id = p_workspace_id and request_key = p_request_key;
  if v_settlement_id is not null then
    return v_settlement_id;
  end if;

  insert into public.settlements (
    workspace_id, debtor_id, creditor_id, amount, from_date, to_date,
    note, from_payer_id, to_payer_id, request_key
  ) values (
    p_workspace_id, p_debtor_id, p_creditor_id, p_amount, p_from, p_to,
    p_note, p_debtor_id, p_creditor_id, p_request_key
  )
  returning id into v_settlement_id;

  for v_split in
    select
      ls.id,
      greatest(
        ls.amount - coalesce((
          select sum(si.amount)
          from public.settlement_items si
          where si.workspace_id = p_workspace_id and si.split_id = ls.id
        ), 0),
        0
      ) as remaining_amount
    from public.ledger_splits ls
    join public.ledger_entries le
      on le.workspace_id = ls.workspace_id and le.id = ls.entry_id
    where ls.workspace_id = p_workspace_id
      and le.type = 'expense'
      and le.entry_date between p_from and p_to
      and ls.payer_id = p_debtor_id
      and le.payer_id = p_creditor_id
      and (p_split_id is null or ls.id = p_split_id)
    order by le.entry_date, ls.id
    for update of ls
  loop
    exit when v_remaining <= 0;
    v_take := least(v_remaining, v_split.remaining_amount);
    if v_take > 0 then
      insert into public.settlement_items (
        workspace_id, settlement_id, split_id, amount
      ) values (
        p_workspace_id, v_settlement_id, v_split.id, v_take
      );
      v_remaining := round(v_remaining - v_take, 2);
    end if;
  end loop;

  if p_split_id is not null and v_remaining > 0 then
    raise exception 'settlement exceeds split remaining amount';
  end if;

  return v_settlement_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.undo_settlement_item_atomic(p_workspace_id uuid, p_item_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_item public.settlement_items%rowtype;
  v_header public.settlements%rowtype;
  v_next_amount numeric;
begin
  perform private.assert_workspace_member(p_workspace_id);

  select * into v_item
  from public.settlement_items
  where id = p_item_id and workspace_id = p_workspace_id
  for update;
  if v_item.id is null then
    raise exception 'settlement item not found';
  end if;

  select * into v_header
  from public.settlements
  where id = v_item.settlement_id and workspace_id = p_workspace_id
  for update;

  delete from public.settlement_items
  where id = v_item.id and workspace_id = p_workspace_id;

  v_next_amount := round(v_header.amount - v_item.amount, 2);
  if v_next_amount <= 0 then
    delete from public.settlements
    where id = v_header.id and workspace_id = p_workspace_id;
  else
    update public.settlements
    set amount = v_next_amount
    where id = v_header.id and workspace_id = p_workspace_id;
  end if;

  return v_header.id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.delete_settlement_atomic(p_workspace_id uuid, p_settlement_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
begin
  perform private.assert_workspace_member(p_workspace_id);

  delete from public.settlements
  where id = p_settlement_id and workspace_id = p_workspace_id;
  if not found then
    raise exception 'settlement not found';
  end if;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.create_ledger_entry_with_details(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text, p_consumption_content text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare v_id uuid;
begin
  perform private.assert_workspace_member(p_workspace_id);
  if char_length(p_consumption_content) > 1000 then raise exception 'consumption content too long'; end if;
  if p_request_key is not null then
    perform pg_advisory_xact_lock(hashtextextended(p_workspace_id::text || ':' || p_request_key, 0));
    select id into v_id from public.ledger_entries
      where workspace_id = p_workspace_id and request_key = p_request_key;
    if v_id is not null then return v_id; end if;
  end if;
  v_id := public.create_ledger_entry_atomic(p_workspace_id, p_entry_date, p_type, p_amount,
    p_category_id, p_pay_method, p_merchant, p_note, p_bill_instance_id, p_payer_id, p_splits, p_request_key);
  update public.ledger_entries set consumption_content = nullif(btrim(p_consumption_content), '')
    where id = v_id and workspace_id = p_workspace_id;
  return v_id;
end;
$function$
;
CREATE OR REPLACE FUNCTION public.pay_bill_to_ledger_atomic(p_workspace_id uuid, p_bill_instance_id uuid, p_pay_amount numeric, p_entry_date date, p_payer_id uuid, p_pay_method text, p_category_id uuid, p_merchant text, p_note text, p_splits jsonb, p_request_key text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_bill public.bill_instances%rowtype;
  v_entry_id uuid;
  v_next_paid numeric;
  v_next_status text;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if p_request_key is null or length(p_request_key) < 16 then
    raise exception 'request key is required';
  end if;

  select * into v_bill
  from public.bill_instances
  where id = p_bill_instance_id and workspace_id = p_workspace_id
  for update;

  if v_bill.id is null then
    raise exception 'bill not found';
  end if;

  if v_bill.payment_mode = 'status_only' then
    raise exception 'status-only bill cannot create ledger entry';
  end if;

  select id into v_entry_id
  from public.ledger_entries
  where workspace_id = p_workspace_id and request_key = p_request_key;

  if v_entry_id is not null then
    return jsonb_build_object(
      'ledger_entry_id', v_entry_id,
      'bill_instance_id', v_bill.id,
      'paid_total', v_bill.paid_total,
      'status', v_bill.status,
      'remaining', greatest(coalesce(v_bill.amount_due, 0) - v_bill.paid_total, 0),
      'already_processed', true
    );
  end if;

  if p_pay_amount <= 0
     or v_bill.amount_due is null
     or p_pay_amount > v_bill.amount_due - v_bill.paid_total then
    raise exception 'invalid payment amount';
  end if;

  v_entry_id := public.create_ledger_entry_with_details(
    p_workspace_id,
    p_entry_date,
    'expense',
    p_pay_amount,
    p_category_id,
    p_pay_method,
    p_merchant,
    p_note,
    p_bill_instance_id,
    p_payer_id,
    p_splits,
    p_request_key,
    left('Bill payment: ' || v_bill.name_snapshot, 1000)
  );

  v_next_paid := round(v_bill.paid_total + p_pay_amount, 2);
  v_next_status := case
    when v_next_paid >= v_bill.amount_due then 'paid'
    else 'partial'
  end;

  update public.bill_instances
  set paid_total = v_next_paid,
      status = v_next_status,
      paid_at = case when v_next_status = 'paid' then now() else paid_at end
  where id = v_bill.id and workspace_id = p_workspace_id;

  return jsonb_build_object(
    'ledger_entry_id', v_entry_id,
    'bill_instance_id', v_bill.id,
    'paid_total', v_next_paid,
    'status', v_next_status,
    'remaining', greatest(v_bill.amount_due - v_next_paid, 0),
    'already_processed', false
  );
end;
$function$
;
CREATE OR REPLACE FUNCTION public.update_ledger_entry_with_details(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb, p_consumption_content text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'private'
AS $function$
declare
  v_entry public.ledger_entries%rowtype;
  v_is_settled boolean;
  v_existing_splits jsonb;
  v_requested_splits jsonb;
begin
  perform private.assert_workspace_member(p_workspace_id);

  if char_length(p_consumption_content) > 1000 then
    raise exception 'consumption content too long';
  end if;

  if coalesce(jsonb_typeof(p_splits), 'array') <> 'array' then
    raise exception 'splits must be an array';
  end if;

  select * into v_entry
  from public.ledger_entries
  where id = p_entry_id and workspace_id = p_workspace_id
  for update;

  if v_entry.id is null then
    raise exception 'ledger entry not found';
  end if;

  select exists (
    select 1
    from public.ledger_splits ls
    join public.settlement_items si
      on si.workspace_id = ls.workspace_id and si.split_id = ls.id
    where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id
  ) into v_is_settled;

  if not v_is_settled then
    perform public.update_ledger_entry_atomic(
      p_workspace_id, p_entry_id, p_entry_date, p_type, p_amount,
      p_category_id, p_pay_method, p_merchant, p_note, p_payer_id, p_splits
    );
    update public.ledger_entries
    set consumption_content = nullif(btrim(p_consumption_content), '')
    where id = p_entry_id and workspace_id = p_workspace_id;
    return;
  end if;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('payer_id', ls.payer_id, 'amount', ls.amount)
      order by ls.payer_id, ls.amount
    ),
    '[]'::jsonb
  ) into v_existing_splits
  from public.ledger_splits ls
  where ls.workspace_id = p_workspace_id and ls.entry_id = p_entry_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object('payer_id', x.payer_id, 'amount', x.amount)
      order by x.payer_id, x.amount
    ),
    '[]'::jsonb
  ) into v_requested_splits
  from jsonb_to_recordset(coalesce(p_splits, '[]'::jsonb))
    as x(payer_id uuid, amount numeric);

  if p_entry_date is distinct from v_entry.entry_date
     or p_type is distinct from v_entry.type
     or p_amount is distinct from v_entry.amount
     or p_category_id is distinct from v_entry.category_id
     or p_pay_method is distinct from v_entry.pay_method
     or p_payer_id is distinct from v_entry.payer_id
     or v_requested_splits is distinct from v_existing_splits then
    raise exception 'settled ledger entry financial fields cannot be edited';
  end if;

  update public.ledger_entries
  set merchant = p_merchant,
      note = p_note,
      consumption_content = nullif(btrim(p_consumption_content), '')
  where id = p_entry_id and workspace_id = p_workspace_id;
end;
$function$
;
CREATE TRIGGER trg_recalc_paid_total_ins AFTER INSERT ON public.payments FOR EACH ROW EXECUTE FUNCTION recalc_paid_total();
CREATE TRIGGER trg_recalc_paid_total_del AFTER DELETE ON public.payments FOR EACH ROW EXECUTE FUNCTION recalc_paid_total();
CREATE TRIGGER trg_bill_status_upd AFTER UPDATE OF amount_due ON public.bill_instances FOR EACH ROW EXECUTE FUNCTION recalc_bill_status_on_update();
CREATE TRIGGER trg_notes_updated_at BEFORE UPDATE ON public.notes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_calendar_events_updated_at BEFORE UPDATE ON public.calendar_events FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_stickies_updated_at BEFORE UPDATE ON public.stickies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_sticky_items_updated_at BEFORE UPDATE ON public.sticky_items FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE POLICY "bill_instances_workspace_member_all" ON public."bill_instances" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "bill_templates_workspace_member_all" ON public."bill_templates" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "settlement_items_workspace_member_all" ON public."settlement_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "ledger_entries_workspace_member_all" ON public."ledger_entries" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "calendar_events_workspace_member_all" ON public."calendar_events" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "ledger_categories_workspace_member_all" ON public."ledger_categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "notes_workspace_member_all" ON public."notes" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "payers_workspace_member_all" ON public."payers" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "payment_methods_workspace_member_all" ON public."payment_methods" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "settlement_split_links_workspace_member_all" ON public."settlement_split_links" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "stickies_workspace_member_all" ON public."stickies" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "account_records_workspace_member_all" ON public."account_records" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "accounts_workspace_member_all" ON public."accounts" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "categories_workspace_member_all" ON public."categories" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "category_groups_workspace_member_all" ON public."category_groups" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "payments_workspace_member_all" ON public."payments" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "sticky_items_workspace_member_all" ON public."sticky_items" AS PERMISSIVE FOR ALL TO "authenticated" USING ((EXISTS ( SELECT 1
   FROM stickies s
  WHERE ((s.id = sticky_items.sticky_id) AND (s.workspace_id IN ( SELECT uw.workspace_id
           FROM user_workspaces uw
          WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM stickies s
  WHERE ((s.id = sticky_items.sticky_id) AND (s.workspace_id IN ( SELECT uw.workspace_id
           FROM user_workspaces uw
          WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))))));
CREATE POLICY "members_select_workspace_member" ON public."members" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "user_workspaces_select_own" ON public."user_workspaces" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((user_id = ( SELECT auth.uid() AS uid)));
CREATE POLICY "workspaces_select_member" ON public."workspaces" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "ledger_splits_workspace_member_all" ON public."ledger_splits" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "settlements_workspace_member_all" ON public."settlements" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "ledger_merchants_workspace_access" ON public."ledger_merchants" AS PERMISSIVE FOR ALL TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_items_delete_workspace_member" ON public."shopping_items" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_items_insert_workspace_member" ON public."shopping_items" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_items_select_workspace_member" ON public."shopping_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_items_update_workspace_member" ON public."shopping_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_accounts_delete_workspace_member" ON public."investment_accounts" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_accounts_insert_workspace_member" ON public."investment_accounts" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_accounts_select_workspace_member" ON public."investment_accounts" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_accounts_update_workspace_member" ON public."investment_accounts" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_securities_delete_workspace_member" ON public."investment_securities" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_securities_insert_workspace_member" ON public."investment_securities" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_securities_select_workspace_member" ON public."investment_securities" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_securities_update_workspace_member" ON public."investment_securities" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_item_sources_delete_workspace_member" ON public."shopping_item_sources" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_item_sources_insert_workspace_member" ON public."shopping_item_sources" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM shopping_items item
  WHERE ((item.id = shopping_item_sources.shopping_item_id) AND (item.workspace_id = item.workspace_id) AND (item.deleted_at IS NULL))))));
CREATE POLICY "shopping_item_sources_select_workspace_member" ON public."shopping_item_sources" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "shopping_item_sources_update_workspace_member" ON public."shopping_item_sources" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM shopping_items item
  WHERE ((item.id = shopping_item_sources.shopping_item_id) AND (item.workspace_id = item.workspace_id) AND (item.deleted_at IS NULL))))));
CREATE POLICY "investment_transactions_delete_workspace_member" ON public."investment_transactions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_transactions_insert_workspace_member" ON public."investment_transactions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_transactions.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_transactions.security_id) AND (s.workspace_id = s.workspace_id))))));
CREATE POLICY "investment_transactions_select_workspace_member" ON public."investment_transactions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_transactions_update_workspace_member" ON public."investment_transactions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_transactions.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_transactions.security_id) AND (s.workspace_id = s.workspace_id))))));
CREATE POLICY "investment_corporate_actions_delete_workspace_member" ON public."investment_corporate_actions" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_corporate_actions_insert_workspace_member" ON public."investment_corporate_actions" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_corporate_actions.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_corporate_actions.security_id) AND (s.workspace_id = s.workspace_id))))));
CREATE POLICY "investment_corporate_actions_select_workspace_member" ON public."investment_corporate_actions" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_corporate_actions_update_workspace_member" ON public."investment_corporate_actions" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_corporate_actions.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_corporate_actions.security_id) AND (s.workspace_id = s.workspace_id))))));
CREATE POLICY "investment_dividends_delete_workspace_member" ON public."investment_dividends" AS PERMISSIVE FOR DELETE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_dividends_insert_workspace_member" ON public."investment_dividends" AS PERMISSIVE FOR INSERT TO "authenticated" WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_dividends.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_dividends.security_id) AND (s.workspace_id = s.workspace_id))))));
CREATE POLICY "investment_dividends_select_workspace_member" ON public."investment_dividends" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))));
CREATE POLICY "investment_dividends_update_workspace_member" ON public."investment_dividends" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid))))) WITH CHECK (((workspace_id IN ( SELECT uw.workspace_id
   FROM user_workspaces uw
  WHERE (uw.user_id = ( SELECT auth.uid() AS uid)))) AND (EXISTS ( SELECT 1
   FROM investment_accounts a
  WHERE ((a.id = investment_dividends.account_id) AND (a.workspace_id = a.workspace_id)))) AND (EXISTS ( SELECT 1
   FROM investment_securities s
  WHERE ((s.id = investment_dividends.security_id) AND (s.workspace_id = s.workspace_id))))));
ALTER TABLE public."bill_instances" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."bill_templates" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."settlement_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_entries" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."calendar_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."notes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payment_methods" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."settlement_split_links" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."stickies" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."account_records" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."categories" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."category_groups" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."payments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."sticky_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."members" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."user_workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."workspaces" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_splits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."settlements" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ledger_merchants" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shopping_items" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investment_accounts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investment_securities" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."shopping_item_sources" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investment_transactions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investment_corporate_actions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."investment_dividends" ENABLE ROW LEVEL SECURITY;
GRANT USAGE ON SCHEMA public TO anon,authenticated;
REVOKE ALL ON SCHEMA private FROM PUBLIC,anon;
GRANT USAGE ON SCHEMA private TO authenticated;
GRANT INSERT ON public."bill_instances" TO "postgres";
GRANT SELECT ON public."bill_instances" TO "postgres";
GRANT UPDATE ON public."bill_instances" TO "postgres";
GRANT DELETE ON public."bill_instances" TO "postgres";
GRANT TRUNCATE ON public."bill_instances" TO "postgres";
GRANT REFERENCES ON public."bill_instances" TO "postgres";
GRANT TRIGGER ON public."bill_instances" TO "postgres";
GRANT INSERT ON public."bill_instances" TO "service_role";
GRANT SELECT ON public."bill_instances" TO "service_role";
GRANT UPDATE ON public."bill_instances" TO "service_role";
GRANT DELETE ON public."bill_instances" TO "service_role";
GRANT TRUNCATE ON public."bill_instances" TO "service_role";
GRANT REFERENCES ON public."bill_instances" TO "service_role";
GRANT TRIGGER ON public."bill_instances" TO "service_role";
GRANT INSERT ON public."bill_instances" TO "authenticated";
GRANT SELECT ON public."bill_instances" TO "authenticated";
GRANT UPDATE ON public."bill_instances" TO "authenticated";
GRANT DELETE ON public."bill_instances" TO "authenticated";
GRANT INSERT ON public."bill_templates" TO "postgres";
GRANT SELECT ON public."bill_templates" TO "postgres";
GRANT UPDATE ON public."bill_templates" TO "postgres";
GRANT DELETE ON public."bill_templates" TO "postgres";
GRANT TRUNCATE ON public."bill_templates" TO "postgres";
GRANT REFERENCES ON public."bill_templates" TO "postgres";
GRANT TRIGGER ON public."bill_templates" TO "postgres";
GRANT INSERT ON public."bill_templates" TO "service_role";
GRANT SELECT ON public."bill_templates" TO "service_role";
GRANT UPDATE ON public."bill_templates" TO "service_role";
GRANT DELETE ON public."bill_templates" TO "service_role";
GRANT TRUNCATE ON public."bill_templates" TO "service_role";
GRANT REFERENCES ON public."bill_templates" TO "service_role";
GRANT TRIGGER ON public."bill_templates" TO "service_role";
GRANT INSERT ON public."bill_templates" TO "authenticated";
GRANT SELECT ON public."bill_templates" TO "authenticated";
GRANT UPDATE ON public."bill_templates" TO "authenticated";
GRANT DELETE ON public."bill_templates" TO "authenticated";
GRANT INSERT ON public."settlement_items" TO "postgres";
GRANT SELECT ON public."settlement_items" TO "postgres";
GRANT UPDATE ON public."settlement_items" TO "postgres";
GRANT DELETE ON public."settlement_items" TO "postgres";
GRANT TRUNCATE ON public."settlement_items" TO "postgres";
GRANT REFERENCES ON public."settlement_items" TO "postgres";
GRANT TRIGGER ON public."settlement_items" TO "postgres";
GRANT INSERT ON public."settlement_items" TO "service_role";
GRANT SELECT ON public."settlement_items" TO "service_role";
GRANT UPDATE ON public."settlement_items" TO "service_role";
GRANT DELETE ON public."settlement_items" TO "service_role";
GRANT TRUNCATE ON public."settlement_items" TO "service_role";
GRANT REFERENCES ON public."settlement_items" TO "service_role";
GRANT TRIGGER ON public."settlement_items" TO "service_role";
GRANT INSERT ON public."settlement_items" TO "authenticated";
GRANT SELECT ON public."settlement_items" TO "authenticated";
GRANT UPDATE ON public."settlement_items" TO "authenticated";
GRANT DELETE ON public."settlement_items" TO "authenticated";
GRANT INSERT ON public."ledger_entries" TO "postgres";
GRANT SELECT ON public."ledger_entries" TO "postgres";
GRANT UPDATE ON public."ledger_entries" TO "postgres";
GRANT DELETE ON public."ledger_entries" TO "postgres";
GRANT TRUNCATE ON public."ledger_entries" TO "postgres";
GRANT REFERENCES ON public."ledger_entries" TO "postgres";
GRANT TRIGGER ON public."ledger_entries" TO "postgres";
GRANT INSERT ON public."ledger_entries" TO "service_role";
GRANT SELECT ON public."ledger_entries" TO "service_role";
GRANT UPDATE ON public."ledger_entries" TO "service_role";
GRANT DELETE ON public."ledger_entries" TO "service_role";
GRANT TRUNCATE ON public."ledger_entries" TO "service_role";
GRANT REFERENCES ON public."ledger_entries" TO "service_role";
GRANT TRIGGER ON public."ledger_entries" TO "service_role";
GRANT INSERT ON public."ledger_entries" TO "authenticated";
GRANT SELECT ON public."ledger_entries" TO "authenticated";
GRANT UPDATE ON public."ledger_entries" TO "authenticated";
GRANT DELETE ON public."ledger_entries" TO "authenticated";
GRANT INSERT ON public."calendar_events" TO "postgres";
GRANT SELECT ON public."calendar_events" TO "postgres";
GRANT UPDATE ON public."calendar_events" TO "postgres";
GRANT DELETE ON public."calendar_events" TO "postgres";
GRANT TRUNCATE ON public."calendar_events" TO "postgres";
GRANT REFERENCES ON public."calendar_events" TO "postgres";
GRANT TRIGGER ON public."calendar_events" TO "postgres";
GRANT INSERT ON public."calendar_events" TO "service_role";
GRANT SELECT ON public."calendar_events" TO "service_role";
GRANT UPDATE ON public."calendar_events" TO "service_role";
GRANT DELETE ON public."calendar_events" TO "service_role";
GRANT TRUNCATE ON public."calendar_events" TO "service_role";
GRANT REFERENCES ON public."calendar_events" TO "service_role";
GRANT TRIGGER ON public."calendar_events" TO "service_role";
GRANT INSERT ON public."calendar_events" TO "authenticated";
GRANT SELECT ON public."calendar_events" TO "authenticated";
GRANT UPDATE ON public."calendar_events" TO "authenticated";
GRANT DELETE ON public."calendar_events" TO "authenticated";
GRANT INSERT ON public."ledger_categories" TO "postgres";
GRANT SELECT ON public."ledger_categories" TO "postgres";
GRANT UPDATE ON public."ledger_categories" TO "postgres";
GRANT DELETE ON public."ledger_categories" TO "postgres";
GRANT TRUNCATE ON public."ledger_categories" TO "postgres";
GRANT REFERENCES ON public."ledger_categories" TO "postgres";
GRANT TRIGGER ON public."ledger_categories" TO "postgres";
GRANT INSERT ON public."ledger_categories" TO "service_role";
GRANT SELECT ON public."ledger_categories" TO "service_role";
GRANT UPDATE ON public."ledger_categories" TO "service_role";
GRANT DELETE ON public."ledger_categories" TO "service_role";
GRANT TRUNCATE ON public."ledger_categories" TO "service_role";
GRANT REFERENCES ON public."ledger_categories" TO "service_role";
GRANT TRIGGER ON public."ledger_categories" TO "service_role";
GRANT INSERT ON public."ledger_categories" TO "authenticated";
GRANT SELECT ON public."ledger_categories" TO "authenticated";
GRANT UPDATE ON public."ledger_categories" TO "authenticated";
GRANT DELETE ON public."ledger_categories" TO "authenticated";
GRANT INSERT ON public."notes" TO "postgres";
GRANT SELECT ON public."notes" TO "postgres";
GRANT UPDATE ON public."notes" TO "postgres";
GRANT DELETE ON public."notes" TO "postgres";
GRANT TRUNCATE ON public."notes" TO "postgres";
GRANT REFERENCES ON public."notes" TO "postgres";
GRANT TRIGGER ON public."notes" TO "postgres";
GRANT INSERT ON public."notes" TO "service_role";
GRANT SELECT ON public."notes" TO "service_role";
GRANT UPDATE ON public."notes" TO "service_role";
GRANT DELETE ON public."notes" TO "service_role";
GRANT TRUNCATE ON public."notes" TO "service_role";
GRANT REFERENCES ON public."notes" TO "service_role";
GRANT TRIGGER ON public."notes" TO "service_role";
GRANT INSERT ON public."notes" TO "authenticated";
GRANT SELECT ON public."notes" TO "authenticated";
GRANT UPDATE ON public."notes" TO "authenticated";
GRANT DELETE ON public."notes" TO "authenticated";
GRANT INSERT ON public."payers" TO "postgres";
GRANT SELECT ON public."payers" TO "postgres";
GRANT UPDATE ON public."payers" TO "postgres";
GRANT DELETE ON public."payers" TO "postgres";
GRANT TRUNCATE ON public."payers" TO "postgres";
GRANT REFERENCES ON public."payers" TO "postgres";
GRANT TRIGGER ON public."payers" TO "postgres";
GRANT INSERT ON public."payers" TO "service_role";
GRANT SELECT ON public."payers" TO "service_role";
GRANT UPDATE ON public."payers" TO "service_role";
GRANT DELETE ON public."payers" TO "service_role";
GRANT TRUNCATE ON public."payers" TO "service_role";
GRANT REFERENCES ON public."payers" TO "service_role";
GRANT TRIGGER ON public."payers" TO "service_role";
GRANT INSERT ON public."payers" TO "authenticated";
GRANT SELECT ON public."payers" TO "authenticated";
GRANT UPDATE ON public."payers" TO "authenticated";
GRANT DELETE ON public."payers" TO "authenticated";
GRANT INSERT ON public."payment_methods" TO "postgres";
GRANT SELECT ON public."payment_methods" TO "postgres";
GRANT UPDATE ON public."payment_methods" TO "postgres";
GRANT DELETE ON public."payment_methods" TO "postgres";
GRANT TRUNCATE ON public."payment_methods" TO "postgres";
GRANT REFERENCES ON public."payment_methods" TO "postgres";
GRANT TRIGGER ON public."payment_methods" TO "postgres";
GRANT INSERT ON public."payment_methods" TO "service_role";
GRANT SELECT ON public."payment_methods" TO "service_role";
GRANT UPDATE ON public."payment_methods" TO "service_role";
GRANT DELETE ON public."payment_methods" TO "service_role";
GRANT TRUNCATE ON public."payment_methods" TO "service_role";
GRANT REFERENCES ON public."payment_methods" TO "service_role";
GRANT TRIGGER ON public."payment_methods" TO "service_role";
GRANT INSERT ON public."payment_methods" TO "authenticated";
GRANT SELECT ON public."payment_methods" TO "authenticated";
GRANT UPDATE ON public."payment_methods" TO "authenticated";
GRANT DELETE ON public."payment_methods" TO "authenticated";
GRANT INSERT ON public."settlement_split_links" TO "postgres";
GRANT SELECT ON public."settlement_split_links" TO "postgres";
GRANT UPDATE ON public."settlement_split_links" TO "postgres";
GRANT DELETE ON public."settlement_split_links" TO "postgres";
GRANT TRUNCATE ON public."settlement_split_links" TO "postgres";
GRANT REFERENCES ON public."settlement_split_links" TO "postgres";
GRANT TRIGGER ON public."settlement_split_links" TO "postgres";
GRANT INSERT ON public."settlement_split_links" TO "service_role";
GRANT SELECT ON public."settlement_split_links" TO "service_role";
GRANT UPDATE ON public."settlement_split_links" TO "service_role";
GRANT DELETE ON public."settlement_split_links" TO "service_role";
GRANT TRUNCATE ON public."settlement_split_links" TO "service_role";
GRANT REFERENCES ON public."settlement_split_links" TO "service_role";
GRANT TRIGGER ON public."settlement_split_links" TO "service_role";
GRANT INSERT ON public."settlement_split_links" TO "authenticated";
GRANT SELECT ON public."settlement_split_links" TO "authenticated";
GRANT UPDATE ON public."settlement_split_links" TO "authenticated";
GRANT DELETE ON public."settlement_split_links" TO "authenticated";
GRANT INSERT ON public."stickies" TO "postgres";
GRANT SELECT ON public."stickies" TO "postgres";
GRANT UPDATE ON public."stickies" TO "postgres";
GRANT DELETE ON public."stickies" TO "postgres";
GRANT TRUNCATE ON public."stickies" TO "postgres";
GRANT REFERENCES ON public."stickies" TO "postgres";
GRANT TRIGGER ON public."stickies" TO "postgres";
GRANT INSERT ON public."stickies" TO "service_role";
GRANT SELECT ON public."stickies" TO "service_role";
GRANT UPDATE ON public."stickies" TO "service_role";
GRANT DELETE ON public."stickies" TO "service_role";
GRANT TRUNCATE ON public."stickies" TO "service_role";
GRANT REFERENCES ON public."stickies" TO "service_role";
GRANT TRIGGER ON public."stickies" TO "service_role";
GRANT INSERT ON public."stickies" TO "authenticated";
GRANT SELECT ON public."stickies" TO "authenticated";
GRANT UPDATE ON public."stickies" TO "authenticated";
GRANT DELETE ON public."stickies" TO "authenticated";
GRANT INSERT ON public."account_records" TO "postgres";
GRANT SELECT ON public."account_records" TO "postgres";
GRANT UPDATE ON public."account_records" TO "postgres";
GRANT DELETE ON public."account_records" TO "postgres";
GRANT TRUNCATE ON public."account_records" TO "postgres";
GRANT REFERENCES ON public."account_records" TO "postgres";
GRANT TRIGGER ON public."account_records" TO "postgres";
GRANT INSERT ON public."account_records" TO "service_role";
GRANT SELECT ON public."account_records" TO "service_role";
GRANT UPDATE ON public."account_records" TO "service_role";
GRANT DELETE ON public."account_records" TO "service_role";
GRANT TRUNCATE ON public."account_records" TO "service_role";
GRANT REFERENCES ON public."account_records" TO "service_role";
GRANT TRIGGER ON public."account_records" TO "service_role";
GRANT INSERT ON public."account_records" TO "authenticated";
GRANT SELECT ON public."account_records" TO "authenticated";
GRANT UPDATE ON public."account_records" TO "authenticated";
GRANT DELETE ON public."account_records" TO "authenticated";
GRANT INSERT ON public."accounts" TO "postgres";
GRANT SELECT ON public."accounts" TO "postgres";
GRANT UPDATE ON public."accounts" TO "postgres";
GRANT DELETE ON public."accounts" TO "postgres";
GRANT TRUNCATE ON public."accounts" TO "postgres";
GRANT REFERENCES ON public."accounts" TO "postgres";
GRANT TRIGGER ON public."accounts" TO "postgres";
GRANT INSERT ON public."accounts" TO "service_role";
GRANT SELECT ON public."accounts" TO "service_role";
GRANT UPDATE ON public."accounts" TO "service_role";
GRANT DELETE ON public."accounts" TO "service_role";
GRANT TRUNCATE ON public."accounts" TO "service_role";
GRANT REFERENCES ON public."accounts" TO "service_role";
GRANT TRIGGER ON public."accounts" TO "service_role";
GRANT INSERT ON public."accounts" TO "authenticated";
GRANT SELECT ON public."accounts" TO "authenticated";
GRANT UPDATE ON public."accounts" TO "authenticated";
GRANT DELETE ON public."accounts" TO "authenticated";
GRANT INSERT ON public."categories" TO "postgres";
GRANT SELECT ON public."categories" TO "postgres";
GRANT UPDATE ON public."categories" TO "postgres";
GRANT DELETE ON public."categories" TO "postgres";
GRANT TRUNCATE ON public."categories" TO "postgres";
GRANT REFERENCES ON public."categories" TO "postgres";
GRANT TRIGGER ON public."categories" TO "postgres";
GRANT INSERT ON public."categories" TO "service_role";
GRANT SELECT ON public."categories" TO "service_role";
GRANT UPDATE ON public."categories" TO "service_role";
GRANT DELETE ON public."categories" TO "service_role";
GRANT TRUNCATE ON public."categories" TO "service_role";
GRANT REFERENCES ON public."categories" TO "service_role";
GRANT TRIGGER ON public."categories" TO "service_role";
GRANT INSERT ON public."categories" TO "authenticated";
GRANT SELECT ON public."categories" TO "authenticated";
GRANT UPDATE ON public."categories" TO "authenticated";
GRANT DELETE ON public."categories" TO "authenticated";
GRANT INSERT ON public."category_groups" TO "postgres";
GRANT SELECT ON public."category_groups" TO "postgres";
GRANT UPDATE ON public."category_groups" TO "postgres";
GRANT DELETE ON public."category_groups" TO "postgres";
GRANT TRUNCATE ON public."category_groups" TO "postgres";
GRANT REFERENCES ON public."category_groups" TO "postgres";
GRANT TRIGGER ON public."category_groups" TO "postgres";
GRANT INSERT ON public."category_groups" TO "service_role";
GRANT SELECT ON public."category_groups" TO "service_role";
GRANT UPDATE ON public."category_groups" TO "service_role";
GRANT DELETE ON public."category_groups" TO "service_role";
GRANT TRUNCATE ON public."category_groups" TO "service_role";
GRANT REFERENCES ON public."category_groups" TO "service_role";
GRANT TRIGGER ON public."category_groups" TO "service_role";
GRANT INSERT ON public."category_groups" TO "authenticated";
GRANT SELECT ON public."category_groups" TO "authenticated";
GRANT UPDATE ON public."category_groups" TO "authenticated";
GRANT DELETE ON public."category_groups" TO "authenticated";
GRANT INSERT ON public."payments" TO "postgres";
GRANT SELECT ON public."payments" TO "postgres";
GRANT UPDATE ON public."payments" TO "postgres";
GRANT DELETE ON public."payments" TO "postgres";
GRANT TRUNCATE ON public."payments" TO "postgres";
GRANT REFERENCES ON public."payments" TO "postgres";
GRANT TRIGGER ON public."payments" TO "postgres";
GRANT INSERT ON public."payments" TO "service_role";
GRANT SELECT ON public."payments" TO "service_role";
GRANT UPDATE ON public."payments" TO "service_role";
GRANT DELETE ON public."payments" TO "service_role";
GRANT TRUNCATE ON public."payments" TO "service_role";
GRANT REFERENCES ON public."payments" TO "service_role";
GRANT TRIGGER ON public."payments" TO "service_role";
GRANT INSERT ON public."payments" TO "authenticated";
GRANT SELECT ON public."payments" TO "authenticated";
GRANT UPDATE ON public."payments" TO "authenticated";
GRANT DELETE ON public."payments" TO "authenticated";
GRANT INSERT ON public."sticky_items" TO "postgres";
GRANT SELECT ON public."sticky_items" TO "postgres";
GRANT UPDATE ON public."sticky_items" TO "postgres";
GRANT DELETE ON public."sticky_items" TO "postgres";
GRANT TRUNCATE ON public."sticky_items" TO "postgres";
GRANT REFERENCES ON public."sticky_items" TO "postgres";
GRANT TRIGGER ON public."sticky_items" TO "postgres";
GRANT INSERT ON public."sticky_items" TO "service_role";
GRANT SELECT ON public."sticky_items" TO "service_role";
GRANT UPDATE ON public."sticky_items" TO "service_role";
GRANT DELETE ON public."sticky_items" TO "service_role";
GRANT TRUNCATE ON public."sticky_items" TO "service_role";
GRANT REFERENCES ON public."sticky_items" TO "service_role";
GRANT TRIGGER ON public."sticky_items" TO "service_role";
GRANT INSERT ON public."sticky_items" TO "authenticated";
GRANT SELECT ON public."sticky_items" TO "authenticated";
GRANT UPDATE ON public."sticky_items" TO "authenticated";
GRANT DELETE ON public."sticky_items" TO "authenticated";
GRANT INSERT ON public."members" TO "postgres";
GRANT SELECT ON public."members" TO "postgres";
GRANT UPDATE ON public."members" TO "postgres";
GRANT DELETE ON public."members" TO "postgres";
GRANT TRUNCATE ON public."members" TO "postgres";
GRANT REFERENCES ON public."members" TO "postgres";
GRANT TRIGGER ON public."members" TO "postgres";
GRANT INSERT ON public."members" TO "service_role";
GRANT SELECT ON public."members" TO "service_role";
GRANT UPDATE ON public."members" TO "service_role";
GRANT DELETE ON public."members" TO "service_role";
GRANT TRUNCATE ON public."members" TO "service_role";
GRANT REFERENCES ON public."members" TO "service_role";
GRANT TRIGGER ON public."members" TO "service_role";
GRANT SELECT ON public."members" TO "authenticated";
GRANT INSERT ON public."user_workspaces" TO "postgres";
GRANT SELECT ON public."user_workspaces" TO "postgres";
GRANT UPDATE ON public."user_workspaces" TO "postgres";
GRANT DELETE ON public."user_workspaces" TO "postgres";
GRANT TRUNCATE ON public."user_workspaces" TO "postgres";
GRANT REFERENCES ON public."user_workspaces" TO "postgres";
GRANT TRIGGER ON public."user_workspaces" TO "postgres";
GRANT INSERT ON public."user_workspaces" TO "service_role";
GRANT SELECT ON public."user_workspaces" TO "service_role";
GRANT UPDATE ON public."user_workspaces" TO "service_role";
GRANT DELETE ON public."user_workspaces" TO "service_role";
GRANT TRUNCATE ON public."user_workspaces" TO "service_role";
GRANT REFERENCES ON public."user_workspaces" TO "service_role";
GRANT TRIGGER ON public."user_workspaces" TO "service_role";
GRANT SELECT ON public."user_workspaces" TO "authenticated";
GRANT INSERT ON public."workspaces" TO "postgres";
GRANT SELECT ON public."workspaces" TO "postgres";
GRANT UPDATE ON public."workspaces" TO "postgres";
GRANT DELETE ON public."workspaces" TO "postgres";
GRANT TRUNCATE ON public."workspaces" TO "postgres";
GRANT REFERENCES ON public."workspaces" TO "postgres";
GRANT TRIGGER ON public."workspaces" TO "postgres";
GRANT INSERT ON public."workspaces" TO "service_role";
GRANT SELECT ON public."workspaces" TO "service_role";
GRANT UPDATE ON public."workspaces" TO "service_role";
GRANT DELETE ON public."workspaces" TO "service_role";
GRANT TRUNCATE ON public."workspaces" TO "service_role";
GRANT REFERENCES ON public."workspaces" TO "service_role";
GRANT TRIGGER ON public."workspaces" TO "service_role";
GRANT SELECT ON public."workspaces" TO "authenticated";
GRANT INSERT ON public."ledger_splits" TO "postgres";
GRANT SELECT ON public."ledger_splits" TO "postgres";
GRANT UPDATE ON public."ledger_splits" TO "postgres";
GRANT DELETE ON public."ledger_splits" TO "postgres";
GRANT TRUNCATE ON public."ledger_splits" TO "postgres";
GRANT REFERENCES ON public."ledger_splits" TO "postgres";
GRANT TRIGGER ON public."ledger_splits" TO "postgres";
GRANT INSERT ON public."ledger_splits" TO "service_role";
GRANT SELECT ON public."ledger_splits" TO "service_role";
GRANT UPDATE ON public."ledger_splits" TO "service_role";
GRANT DELETE ON public."ledger_splits" TO "service_role";
GRANT TRUNCATE ON public."ledger_splits" TO "service_role";
GRANT REFERENCES ON public."ledger_splits" TO "service_role";
GRANT TRIGGER ON public."ledger_splits" TO "service_role";
GRANT INSERT ON public."ledger_splits" TO "authenticated";
GRANT SELECT ON public."ledger_splits" TO "authenticated";
GRANT UPDATE ON public."ledger_splits" TO "authenticated";
GRANT DELETE ON public."ledger_splits" TO "authenticated";
GRANT INSERT ON public."settlements" TO "postgres";
GRANT SELECT ON public."settlements" TO "postgres";
GRANT UPDATE ON public."settlements" TO "postgres";
GRANT DELETE ON public."settlements" TO "postgres";
GRANT TRUNCATE ON public."settlements" TO "postgres";
GRANT REFERENCES ON public."settlements" TO "postgres";
GRANT TRIGGER ON public."settlements" TO "postgres";
GRANT INSERT ON public."settlements" TO "service_role";
GRANT SELECT ON public."settlements" TO "service_role";
GRANT UPDATE ON public."settlements" TO "service_role";
GRANT DELETE ON public."settlements" TO "service_role";
GRANT TRUNCATE ON public."settlements" TO "service_role";
GRANT REFERENCES ON public."settlements" TO "service_role";
GRANT TRIGGER ON public."settlements" TO "service_role";
GRANT INSERT ON public."settlements" TO "authenticated";
GRANT SELECT ON public."settlements" TO "authenticated";
GRANT UPDATE ON public."settlements" TO "authenticated";
GRANT DELETE ON public."settlements" TO "authenticated";
GRANT INSERT ON public."ledger_merchants" TO "postgres";
GRANT SELECT ON public."ledger_merchants" TO "postgres";
GRANT UPDATE ON public."ledger_merchants" TO "postgres";
GRANT DELETE ON public."ledger_merchants" TO "postgres";
GRANT TRUNCATE ON public."ledger_merchants" TO "postgres";
GRANT REFERENCES ON public."ledger_merchants" TO "postgres";
GRANT TRIGGER ON public."ledger_merchants" TO "postgres";
GRANT INSERT ON public."ledger_merchants" TO "service_role";
GRANT SELECT ON public."ledger_merchants" TO "service_role";
GRANT UPDATE ON public."ledger_merchants" TO "service_role";
GRANT DELETE ON public."ledger_merchants" TO "service_role";
GRANT TRUNCATE ON public."ledger_merchants" TO "service_role";
GRANT REFERENCES ON public."ledger_merchants" TO "service_role";
GRANT TRIGGER ON public."ledger_merchants" TO "service_role";
GRANT INSERT ON public."ledger_merchants" TO "authenticated";
GRANT SELECT ON public."ledger_merchants" TO "authenticated";
GRANT UPDATE ON public."ledger_merchants" TO "authenticated";
GRANT INSERT ON public."shopping_items" TO "postgres";
GRANT SELECT ON public."shopping_items" TO "postgres";
GRANT UPDATE ON public."shopping_items" TO "postgres";
GRANT DELETE ON public."shopping_items" TO "postgres";
GRANT TRUNCATE ON public."shopping_items" TO "postgres";
GRANT REFERENCES ON public."shopping_items" TO "postgres";
GRANT TRIGGER ON public."shopping_items" TO "postgres";
GRANT INSERT ON public."shopping_items" TO "service_role";
GRANT SELECT ON public."shopping_items" TO "service_role";
GRANT UPDATE ON public."shopping_items" TO "service_role";
GRANT DELETE ON public."shopping_items" TO "service_role";
GRANT TRUNCATE ON public."shopping_items" TO "service_role";
GRANT REFERENCES ON public."shopping_items" TO "service_role";
GRANT TRIGGER ON public."shopping_items" TO "service_role";
GRANT INSERT ON public."shopping_items" TO "authenticated";
GRANT SELECT ON public."shopping_items" TO "authenticated";
GRANT UPDATE ON public."shopping_items" TO "authenticated";
GRANT DELETE ON public."shopping_items" TO "authenticated";
GRANT INSERT ON public."investment_accounts" TO "postgres";
GRANT SELECT ON public."investment_accounts" TO "postgres";
GRANT UPDATE ON public."investment_accounts" TO "postgres";
GRANT DELETE ON public."investment_accounts" TO "postgres";
GRANT TRUNCATE ON public."investment_accounts" TO "postgres";
GRANT REFERENCES ON public."investment_accounts" TO "postgres";
GRANT TRIGGER ON public."investment_accounts" TO "postgres";
GRANT INSERT ON public."investment_accounts" TO "authenticated";
GRANT SELECT ON public."investment_accounts" TO "authenticated";
GRANT UPDATE ON public."investment_accounts" TO "authenticated";
GRANT DELETE ON public."investment_accounts" TO "authenticated";
GRANT TRUNCATE ON public."investment_accounts" TO "authenticated";
GRANT REFERENCES ON public."investment_accounts" TO "authenticated";
GRANT TRIGGER ON public."investment_accounts" TO "authenticated";
GRANT INSERT ON public."investment_accounts" TO "service_role";
GRANT SELECT ON public."investment_accounts" TO "service_role";
GRANT UPDATE ON public."investment_accounts" TO "service_role";
GRANT DELETE ON public."investment_accounts" TO "service_role";
GRANT TRUNCATE ON public."investment_accounts" TO "service_role";
GRANT REFERENCES ON public."investment_accounts" TO "service_role";
GRANT TRIGGER ON public."investment_accounts" TO "service_role";
GRANT INSERT ON public."investment_securities" TO "postgres";
GRANT SELECT ON public."investment_securities" TO "postgres";
GRANT UPDATE ON public."investment_securities" TO "postgres";
GRANT DELETE ON public."investment_securities" TO "postgres";
GRANT TRUNCATE ON public."investment_securities" TO "postgres";
GRANT REFERENCES ON public."investment_securities" TO "postgres";
GRANT TRIGGER ON public."investment_securities" TO "postgres";
GRANT INSERT ON public."investment_securities" TO "authenticated";
GRANT SELECT ON public."investment_securities" TO "authenticated";
GRANT UPDATE ON public."investment_securities" TO "authenticated";
GRANT DELETE ON public."investment_securities" TO "authenticated";
GRANT TRUNCATE ON public."investment_securities" TO "authenticated";
GRANT REFERENCES ON public."investment_securities" TO "authenticated";
GRANT TRIGGER ON public."investment_securities" TO "authenticated";
GRANT INSERT ON public."investment_securities" TO "service_role";
GRANT SELECT ON public."investment_securities" TO "service_role";
GRANT UPDATE ON public."investment_securities" TO "service_role";
GRANT DELETE ON public."investment_securities" TO "service_role";
GRANT TRUNCATE ON public."investment_securities" TO "service_role";
GRANT REFERENCES ON public."investment_securities" TO "service_role";
GRANT TRIGGER ON public."investment_securities" TO "service_role";
GRANT INSERT ON public."shopping_item_sources" TO "postgres";
GRANT SELECT ON public."shopping_item_sources" TO "postgres";
GRANT UPDATE ON public."shopping_item_sources" TO "postgres";
GRANT DELETE ON public."shopping_item_sources" TO "postgres";
GRANT TRUNCATE ON public."shopping_item_sources" TO "postgres";
GRANT REFERENCES ON public."shopping_item_sources" TO "postgres";
GRANT TRIGGER ON public."shopping_item_sources" TO "postgres";
GRANT INSERT ON public."shopping_item_sources" TO "service_role";
GRANT SELECT ON public."shopping_item_sources" TO "service_role";
GRANT UPDATE ON public."shopping_item_sources" TO "service_role";
GRANT DELETE ON public."shopping_item_sources" TO "service_role";
GRANT TRUNCATE ON public."shopping_item_sources" TO "service_role";
GRANT REFERENCES ON public."shopping_item_sources" TO "service_role";
GRANT TRIGGER ON public."shopping_item_sources" TO "service_role";
GRANT INSERT ON public."shopping_item_sources" TO "authenticated";
GRANT SELECT ON public."shopping_item_sources" TO "authenticated";
GRANT UPDATE ON public."shopping_item_sources" TO "authenticated";
GRANT DELETE ON public."shopping_item_sources" TO "authenticated";
GRANT INSERT ON public."investment_transactions" TO "postgres";
GRANT SELECT ON public."investment_transactions" TO "postgres";
GRANT UPDATE ON public."investment_transactions" TO "postgres";
GRANT DELETE ON public."investment_transactions" TO "postgres";
GRANT TRUNCATE ON public."investment_transactions" TO "postgres";
GRANT REFERENCES ON public."investment_transactions" TO "postgres";
GRANT TRIGGER ON public."investment_transactions" TO "postgres";
GRANT INSERT ON public."investment_transactions" TO "authenticated";
GRANT SELECT ON public."investment_transactions" TO "authenticated";
GRANT UPDATE ON public."investment_transactions" TO "authenticated";
GRANT DELETE ON public."investment_transactions" TO "authenticated";
GRANT TRUNCATE ON public."investment_transactions" TO "authenticated";
GRANT REFERENCES ON public."investment_transactions" TO "authenticated";
GRANT TRIGGER ON public."investment_transactions" TO "authenticated";
GRANT INSERT ON public."investment_transactions" TO "service_role";
GRANT SELECT ON public."investment_transactions" TO "service_role";
GRANT UPDATE ON public."investment_transactions" TO "service_role";
GRANT DELETE ON public."investment_transactions" TO "service_role";
GRANT TRUNCATE ON public."investment_transactions" TO "service_role";
GRANT REFERENCES ON public."investment_transactions" TO "service_role";
GRANT TRIGGER ON public."investment_transactions" TO "service_role";
GRANT INSERT ON public."investment_corporate_actions" TO "postgres";
GRANT SELECT ON public."investment_corporate_actions" TO "postgres";
GRANT UPDATE ON public."investment_corporate_actions" TO "postgres";
GRANT DELETE ON public."investment_corporate_actions" TO "postgres";
GRANT TRUNCATE ON public."investment_corporate_actions" TO "postgres";
GRANT REFERENCES ON public."investment_corporate_actions" TO "postgres";
GRANT TRIGGER ON public."investment_corporate_actions" TO "postgres";
GRANT INSERT ON public."investment_corporate_actions" TO "authenticated";
GRANT SELECT ON public."investment_corporate_actions" TO "authenticated";
GRANT UPDATE ON public."investment_corporate_actions" TO "authenticated";
GRANT DELETE ON public."investment_corporate_actions" TO "authenticated";
GRANT TRUNCATE ON public."investment_corporate_actions" TO "authenticated";
GRANT REFERENCES ON public."investment_corporate_actions" TO "authenticated";
GRANT TRIGGER ON public."investment_corporate_actions" TO "authenticated";
GRANT INSERT ON public."investment_corporate_actions" TO "service_role";
GRANT SELECT ON public."investment_corporate_actions" TO "service_role";
GRANT UPDATE ON public."investment_corporate_actions" TO "service_role";
GRANT DELETE ON public."investment_corporate_actions" TO "service_role";
GRANT TRUNCATE ON public."investment_corporate_actions" TO "service_role";
GRANT REFERENCES ON public."investment_corporate_actions" TO "service_role";
GRANT TRIGGER ON public."investment_corporate_actions" TO "service_role";
GRANT INSERT ON public."investment_dividends" TO "postgres";
GRANT SELECT ON public."investment_dividends" TO "postgres";
GRANT UPDATE ON public."investment_dividends" TO "postgres";
GRANT DELETE ON public."investment_dividends" TO "postgres";
GRANT TRUNCATE ON public."investment_dividends" TO "postgres";
GRANT REFERENCES ON public."investment_dividends" TO "postgres";
GRANT TRIGGER ON public."investment_dividends" TO "postgres";
GRANT INSERT ON public."investment_dividends" TO "authenticated";
GRANT SELECT ON public."investment_dividends" TO "authenticated";
GRANT UPDATE ON public."investment_dividends" TO "authenticated";
GRANT DELETE ON public."investment_dividends" TO "authenticated";
GRANT TRUNCATE ON public."investment_dividends" TO "authenticated";
GRANT REFERENCES ON public."investment_dividends" TO "authenticated";
GRANT TRIGGER ON public."investment_dividends" TO "authenticated";
GRANT INSERT ON public."investment_dividends" TO "service_role";
GRANT SELECT ON public."investment_dividends" TO "service_role";
GRANT UPDATE ON public."investment_dividends" TO "service_role";
GRANT DELETE ON public."investment_dividends" TO "service_role";
GRANT TRUNCATE ON public."investment_dividends" TO "service_role";
GRANT REFERENCES ON public."investment_dividends" TO "service_role";
GRANT TRIGGER ON public."investment_dividends" TO "service_role";
REVOKE ALL ON FUNCTION "public"."set_updated_at"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."set_updated_at"() TO "service_role";
REVOKE ALL ON FUNCTION "private"."assert_workspace_member"(p_workspace_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "private"."assert_workspace_member"(p_workspace_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "private"."assert_workspace_member"(p_workspace_id uuid) TO "authenticated";
REVOKE ALL ON FUNCTION "public"."recalc_bill_status_on_update"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."recalc_bill_status_on_update"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."recalc_bill_status_on_update"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."recalc_bill_status_on_update"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."recalc_bill_status_on_update"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."recalc_bill_status_on_update"() TO "service_role";
REVOKE ALL ON FUNCTION "public"."recalc_paid_total"() FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."recalc_paid_total"() TO PUBLIC;
GRANT EXECUTE ON FUNCTION "public"."recalc_paid_total"() TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."recalc_paid_total"() TO "anon";
GRANT EXECUTE ON FUNCTION "public"."recalc_paid_total"() TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."recalc_paid_total"() TO "service_role";
REVOKE ALL ON FUNCTION "private"."generate_bill_instances"(p_period date) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "private"."generate_bill_instances"(p_period date) TO "postgres";
REVOKE ALL ON FUNCTION "public"."create_ledger_entry_atomic"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_atomic"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_atomic"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_atomic"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text) TO "service_role";
REVOKE ALL ON FUNCTION "public"."update_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb) TO "service_role";
REVOKE ALL ON FUNCTION "public"."delete_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."delete_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."delete_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."delete_ledger_entry_atomic"(p_workspace_id uuid, p_entry_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."create_settlement_atomic"(p_workspace_id uuid, p_from date, p_to date, p_debtor_id uuid, p_creditor_id uuid, p_amount numeric, p_note text, p_split_id uuid, p_request_key text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."create_settlement_atomic"(p_workspace_id uuid, p_from date, p_to date, p_debtor_id uuid, p_creditor_id uuid, p_amount numeric, p_note text, p_split_id uuid, p_request_key text) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."create_settlement_atomic"(p_workspace_id uuid, p_from date, p_to date, p_debtor_id uuid, p_creditor_id uuid, p_amount numeric, p_note text, p_split_id uuid, p_request_key text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_settlement_atomic"(p_workspace_id uuid, p_from date, p_to date, p_debtor_id uuid, p_creditor_id uuid, p_amount numeric, p_note text, p_split_id uuid, p_request_key text) TO "service_role";
REVOKE ALL ON FUNCTION "public"."undo_settlement_item_atomic"(p_workspace_id uuid, p_item_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."undo_settlement_item_atomic"(p_workspace_id uuid, p_item_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."undo_settlement_item_atomic"(p_workspace_id uuid, p_item_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."undo_settlement_item_atomic"(p_workspace_id uuid, p_item_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."delete_settlement_atomic"(p_workspace_id uuid, p_settlement_id uuid) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."delete_settlement_atomic"(p_workspace_id uuid, p_settlement_id uuid) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."delete_settlement_atomic"(p_workspace_id uuid, p_settlement_id uuid) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."delete_settlement_atomic"(p_workspace_id uuid, p_settlement_id uuid) TO "service_role";
REVOKE ALL ON FUNCTION "public"."create_ledger_entry_with_details"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text, p_consumption_content text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_with_details"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text, p_consumption_content text) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_with_details"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text, p_consumption_content text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."create_ledger_entry_with_details"(p_workspace_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_bill_instance_id uuid, p_payer_id uuid, p_splits jsonb, p_request_key text, p_consumption_content text) TO "service_role";
REVOKE ALL ON FUNCTION "public"."pay_bill_to_ledger_atomic"(p_workspace_id uuid, p_bill_instance_id uuid, p_pay_amount numeric, p_entry_date date, p_payer_id uuid, p_pay_method text, p_category_id uuid, p_merchant text, p_note text, p_splits jsonb, p_request_key text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."pay_bill_to_ledger_atomic"(p_workspace_id uuid, p_bill_instance_id uuid, p_pay_amount numeric, p_entry_date date, p_payer_id uuid, p_pay_method text, p_category_id uuid, p_merchant text, p_note text, p_splits jsonb, p_request_key text) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."pay_bill_to_ledger_atomic"(p_workspace_id uuid, p_bill_instance_id uuid, p_pay_amount numeric, p_entry_date date, p_payer_id uuid, p_pay_method text, p_category_id uuid, p_merchant text, p_note text, p_splits jsonb, p_request_key text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."pay_bill_to_ledger_atomic"(p_workspace_id uuid, p_bill_instance_id uuid, p_pay_amount numeric, p_entry_date date, p_payer_id uuid, p_pay_method text, p_category_id uuid, p_merchant text, p_note text, p_splits jsonb, p_request_key text) TO "service_role";
REVOKE ALL ON FUNCTION "public"."update_ledger_entry_with_details"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb, p_consumption_content text) FROM PUBLIC,anon,authenticated,service_role;
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_with_details"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb, p_consumption_content text) TO "postgres";
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_with_details"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb, p_consumption_content text) TO "authenticated";
GRANT EXECUTE ON FUNCTION "public"."update_ledger_entry_with_details"(p_workspace_id uuid, p_entry_id uuid, p_entry_date date, p_type text, p_amount numeric, p_category_id uuid, p_pay_method text, p_merchant text, p_note text, p_payer_id uuid, p_splits jsonb, p_consumption_content text) TO "service_role";
COMMIT;
