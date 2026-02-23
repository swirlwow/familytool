"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = {
  href: string;
  label: string;
};

type Group = {
  title: string;
  items: Item[];
};

const GROUPS: Group[] = [
  {
    title: "記帳與帳單",
    items: [
      { href: "/ledger", label: "記帳" },
      { href: "/bills", label: "帳單" },
    ],
  },
  {
    title: "帳戶",
    items: [
      { href: "/accounts", label: "帳戶紀錄" },
    ],
  },
  {
    title: "設定",
    items: [
      { href: "/settings/categories", label: "分類管理" },
      { href: "/settings/payment-methods", label: "付款方式" },
    ],
  },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/";
  return path === href || path.startsWith(href + "/");
}

export default function SideNav() {
  const pathname = usePathname();

  return (
    <aside className="w-full">
      <ul className="menu rounded-box bg-base-100 text-base-content">
        {GROUPS.map((group) => (
          <li key={group.title}>
            <h2 className="menu-title">{group.title}</h2>
            <ul>
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={active ? "active font-semibold" : ""}
                    >
                      {item.label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ul>
    </aside>
  );
}
