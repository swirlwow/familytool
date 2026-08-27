import "./globals.css";
import "./family-theme.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/toaster";

/* Chiron GoRound is self-hosted from /public and intentionally loaded as a document stylesheet. */

export const metadata = {
  title: "家庭生活工具",
  description: "記帳・帳單・帳戶・行事曆",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant" data-theme="light" style={{ colorScheme: "light" }}>
      {/* eslint-disable-next-line @next/next/no-css-tags */}
      <link rel="stylesheet" href="/fonts/chiron-go-round/css/vf.css" />
      <body>
        <AppShell>
          {children}
        </AppShell>

        {/* ✅ 全域 Toast 容器 */}
        <Toaster />
      </body>
    </html>
  );
}
