// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, LogIn, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  function getRedirectPath() {
    const redirect = new URLSearchParams(window.location.search).get("redirect");
    return redirect?.startsWith("/") && !redirect.startsWith("//") ? redirect : "/";
  }

  useEffect(() => {
    const recoveryUrl =
      window.location.hash.includes("type=recovery") ||
      new URLSearchParams(window.location.search).get("type") === "recovery";

    if (recoveryUrl) setIsRecovery(true);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsRecovery(true);
        return;
      }

      if (session && !recoveryUrl) router.push(getRedirectPath());
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !recoveryUrl) router.push(getRedirectPath());
    });

    return () => subscription.unsubscribe();
  }, [router]);

  async function handleRecovery(e: React.FormEvent) {
    e.preventDefault();

    if (newPassword.length < 8) {
      toast({
        variant: "destructive",
        title: "密碼長度不足",
        description: "新密碼至少需要 8 個字元。",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        variant: "destructive",
        title: "密碼不一致",
        description: "請重新確認兩次輸入的新密碼。",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;

      await supabase.auth.signOut();
      window.history.replaceState({}, "", "/login");
      setIsRecovery(false);
      setNewPassword("");
      setConfirmPassword("");
      toast({
        title: "密碼已更新",
        description: "請使用新密碼重新登入。",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "更新密碼失敗",
        description: err.message || "重設連結可能已失效，請重新寄送。",
      });
    } finally {
      setLoading(false);
    }
  }

  async function sendRecoveryEmail() {
    if (!email.trim()) {
      toast({
        variant: "destructive",
        title: "請先輸入電子郵件",
        description: "系統會將密碼重設信寄到這個信箱。",
      });
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/login`,
      });
      if (error) throw error;

      toast({
        title: "重設信已寄出",
        description: "請檢查收件匣及垃圾郵件匣。",
      });
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "寄送失敗",
        description: err.message || "請稍後再試。",
      });
    } finally {
      setLoading(false);
    }
  }

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || !password.trim()) {
      toast({
        variant: "destructive",
        title: "輸入欄位不完整",
        description: "請填寫電子郵件與密碼",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      toast({
        title: "登入成功！",
        description: "歡迎回到家庭生活工具系統。",
      });

      // 強制重新導向首頁並重整狀態
      window.location.href = getRedirectPath();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "登入失敗",
        description: err.message || "請檢查您的帳號密碼",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <div className="relative z-10 flex w-full max-w-md flex-col gap-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        
        {/* Header Logo & Title */}
        <div className="text-center space-y-2">
          <div className="mb-2 inline-flex h-12 w-12 items-center justify-center rounded-lg bg-slate-900 text-white">
            <Sparkles className="w-6 h-6" />
          </div>
          <h1 className="text-2xl font-black leading-none text-slate-900 sm:text-3xl">
            家庭生活工具
          </h1>
          <p className="text-xs font-medium text-slate-500 sm:text-sm">
            {isRecovery ? "設定新的登入密碼" : "登入家庭生活工具"}
          </p>
        </div>

        {isRecovery ? (
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-1">
              <label className="block pl-1 text-[10px] font-bold text-slate-500 sm:text-xs">
                新密碼
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input input-bordered w-full rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-800 focus:border-sky-500 sm:text-base"
                  placeholder="至少 8 個字元"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="block pl-1 text-[10px] font-bold text-slate-500 sm:text-xs">
                再次確認
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                  <Lock className="w-4 h-4" />
                </span>
                <input
                  type="password"
                  required
                  minLength={8}
                  className="input input-bordered w-full rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-800 focus:border-sky-500 sm:text-base"
                  placeholder="再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn mt-4 h-12 w-full rounded-lg border-none bg-sky-600 font-black text-white hover:bg-sky-700 disabled:opacity-55"
            >
              {loading ? <span className="loading loading-spinner loading-sm"></span> : "更新密碼"}
            </button>
          </form>
        ) : (
        <>
        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="block pl-1 text-[10px] font-bold text-slate-500 sm:text-xs">
              電子郵件
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                className="input input-bordered w-full rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-800 focus:border-sky-500 sm:text-base"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="block pl-1 text-[10px] font-bold text-slate-500 sm:text-xs">
              密碼
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                className="input input-bordered w-full rounded-lg border-slate-200 bg-white pl-10 text-sm text-slate-800 focus:border-sky-500 sm:text-base"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-lg border-none bg-sky-600 text-sm font-black text-white hover:bg-sky-700 disabled:opacity-55 sm:text-base"
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> 登入
              </>
            )}
          </button>
        </form>

        {/* Footer Mode Switcher */}
        <div className="mt-2 space-y-3 border-t border-slate-200 pt-4 text-center">
          <button
            type="button"
            className="block w-full text-xs font-semibold text-slate-500 hover:text-slate-900 sm:text-sm"
            onClick={sendRecoveryEmail}
            disabled={loading}
          >
            忘記密碼？
          </button>
        </div>
        </>
        )}

      </div>
    </main>
  );
}
