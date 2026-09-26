import Link from "next/link";
import "./ledger-tabs.css";

export default function LedgerTabs({ active }: { active: "ledger" | "dashboard" }) {
  return (
    <nav className="ledger-tabs" aria-label="記帳管理分頁">
      <Link href="/ledger" aria-current={active === "ledger" ? "page" : undefined}>記帳</Link>
      <Link href="/ledger/dashboard" aria-current={active === "dashboard" ? "page" : undefined}>財務儀表板</Link>
    </nav>
  );
}
