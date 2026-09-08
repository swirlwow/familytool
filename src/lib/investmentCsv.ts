import type { InvestmentSnapshot, InvestmentTransactionType } from "./investments";

export type InvestmentCsvScope = "transactions" | "dividends" | "corporate_actions";

type InvestmentCsvOptions = {
  scope: InvestmentCsvScope;
  accountId?: string | null;
  securityId?: string | null;
  transactionType?: string | null;
  query?: string | null;
};

const csvCell = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;
const csvRow = (values: unknown[]) => values.map(csvCell).join(",");
const transactionTypeLabel: Record<InvestmentTransactionType, string> = { buy: "買進", sell: "賣出", dividend: "股利" };
const dividendTypeLabel = { cash: "現金股利", stock: "股票股利" } as const;
const deductionTypeLabel = { transfer_fee: "匯費", nhi: "補充保費", withholding_tax: "預扣稅", other: "其他", unclassified: "未分類" } as const;
const dividendStatusLabel = { pending: "待發放", received: "已收款" } as const;
const actionTypeLabel = { capital_reduction: "現金減資", loss_reduction: "彌補虧損減資" } as const;
const sourceLabel = { manual: "手動", csv: "CSV", excel: "Excel" } as const;

export function parseInvestmentCsvScope(value: string | null): InvestmentCsvScope {
  return value === "dividends" || value === "corporate_actions" ? value : "transactions";
}

export function investmentCsvFilename(scope: InvestmentCsvScope, date: string) {
  return `familytool_investment_${scope}_${date}.csv`;
}

export function buildInvestmentCsv(snapshot: InvestmentSnapshot, options: InvestmentCsvOptions) {
  const accountMap = new Map(snapshot.accounts.map((row) => [row.id, row]));
  const securityMap = new Map(snapshot.securities.map((row) => [row.id, row]));
  const keyword = options.query?.trim().toLowerCase() ?? "";
  const matches = (accountId: string, securityId: string, note?: string | null) => {
    const account = accountMap.get(accountId);
    const security = securityMap.get(securityId);
    return (!options.accountId || accountId === options.accountId)
      && (!options.securityId || securityId === options.securityId)
      && (!keyword || [account?.name, security?.symbol, security?.name, security?.market, note]
        .some((value) => String(value ?? "").toLowerCase().includes(keyword)));
  };

  if (options.scope === "dividends") {
    const headers = ["除權息日期", "股利類型", "券商帳戶", "市場", "股票代號", "股票名稱", "計算股數", "每股現金股利", "配股率", "預計股利", "預計配股", "實際收款日期", "實際收款金額", "實際配股股數", "扣除金額", "扣款類型", "狀態", "資料來源", "備註"];
    const rows = snapshot.dividends.filter((row) => matches(row.account_id, row.security_id, row.note)).map((row) => {
      const account = accountMap.get(row.account_id); const security = securityMap.get(row.security_id);
      return csvRow([row.ex_dividend_date, dividendTypeLabel[row.dividend_type], account?.name, security?.market, security?.symbol, security?.name, row.eligible_quantity, row.dividend_type === "cash" ? row.dividend_per_share : "", row.dividend_type === "stock" ? row.stock_dividend_rate : "", row.dividend_type === "cash" ? row.expected_amount : "", row.dividend_type === "stock" ? row.expected_shares : "", row.payment_date, row.received_amount, row.shares_received, row.deduction_amount || "", row.deduction_type ? deductionTypeLabel[row.deduction_type] : "", dividendStatusLabel[row.status], sourceLabel[row.source], row.note]);
    });
    return [csvRow(headers), ...rows].join("\r\n");
  }

  if (options.scope === "corporate_actions") {
    const headers = ["異動日期", "異動類型", "券商帳戶", "市場", "股票代號", "股票名稱", "異動前股數", "減資比率", "異動後股數", "退還現金", "成本調整", "資料來源", "備註"];
    const rows = snapshot.corporate_actions.filter((row) => matches(row.account_id, row.security_id, row.note)).map((row) => {
      const account = accountMap.get(row.account_id); const security = securityMap.get(row.security_id);
      return csvRow([row.event_date, actionTypeLabel[row.action_type], account?.name, security?.market, security?.symbol, security?.name, row.quantity_before, row.reduction_ratio, row.quantity_after, row.cash_return, row.cost_adjustment, sourceLabel[row.source], row.note]);
    });
    return [csvRow(headers), ...rows].join("\r\n");
  }

  const headers = ["日期", "類型", "券商帳戶", "市場", "股票代號", "股票名稱", "股數", "成交價", "手續費", "交易稅", "成交價金", "實付實收金額", "委託單號", "幣別", "資料來源", "備註"];
  const rows = snapshot.transactions
    .filter((row) => row.transaction_type !== "dividend")
    .filter((row) => !options.transactionType || options.transactionType === "all" || row.transaction_type === options.transactionType)
    .filter((row) => matches(row.account_id, row.security_id, row.note))
    .map((row) => {
      const account = accountMap.get(row.account_id); const security = securityMap.get(row.security_id);
      return csvRow([row.trade_date, transactionTypeLabel[row.transaction_type], account?.name, security?.market, security?.symbol, security?.name, row.quantity, row.price, row.fee, row.tax, row.cash_amount, row.settlement_amount, row.order_number, row.currency, sourceLabel[row.source], row.note]);
    });
  return [csvRow(headers), ...rows].join("\r\n");
}
