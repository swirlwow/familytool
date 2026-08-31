import Link from "next/link";
import { Calculator, History } from "lucide-react";

const sections = [
  { key: "settlement", label: "拆帳結算", href: "/settlement", icon: Calculator },
  { key: "history", label: "結清紀錄", href: "/settlement/history", icon: History },
] as const;

export function SettlementNav({ active }: { active: typeof sections[number]["key"] }) {
  return <nav className="ledger-settings-nav" aria-label="拆帳管理" style={{ marginBottom: 0 }}>
    {sections.map(({ key, label, href, icon: Icon }) => <Link key={key} href={href}
      aria-current={active === key ? "page" : undefined}>
      <Icon size={18} aria-hidden="true" /><span>{label}</span>
    </Link>)}
  </nav>;
}
