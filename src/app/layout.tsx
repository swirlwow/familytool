import "./globals.css";
import AppShell from "@/components/AppShell";
import { Toaster } from "@/components/ui/toaster";

export const metadata = {
  title: "家庭生活工具",
  description: "記帳・帳單・帳戶・行事曆",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-Hant">
      <head><link rel="stylesheet" href="/fonts/chiron-go-round/css/vf.css" /></head>
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
