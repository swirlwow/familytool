import Link from "next/link";
import { CreditCard, Store, Tags } from "lucide-react";

const sections = [
  { key: "categories", label: "分類管理", icon: Tags },
  { key: "payment-methods", label: "付款方式", icon: CreditCard },
  { key: "merchants", label: "店家管理", icon: Store },
] as const;

export function LedgerSettingsNav({ active }: { active: typeof sections[number]["key"] }) {
  return <nav className="ledger-settings-nav" aria-label="記帳設定">
    {sections.map(({ key, label, icon: Icon }) => <Link key={key} href={`/settings/${key}`}
      aria-current={active === key ? "page" : undefined}>
      <Icon size={18} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
