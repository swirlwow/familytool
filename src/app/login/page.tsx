// src/app/login/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { Lock, Mail, UserPlus, LogIn, Sparkles } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { toast } = useToast();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);

  // 取得環境變數設定的預設 WORKSPACE_ID
  const defaultWorkspaceId = process.env.NEXT_PUBLIC_WORKSPACE_ID || "";

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

      if (session && !recoveryUrl) router.push("/");
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session && !recoveryUrl) router.push("/");
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
        title: "請先輸入 Email",
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
        description: "請填寫 Email 與密碼",
      });
      return;
    }

    setLoading(true);

    try {
      if (isRegister) {
        // 註冊流程
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) throw error;

        const user = data.user;
        if (user) {
          // 註冊成功後，自動在 user_workspaces 表中建立預設工作區映射關係
          if (defaultWorkspaceId) {
            const { error: wsError } = await supabase
              .from("user_workspaces")
              .insert({
                user_id: user.id,
                workspace_id: defaultWorkspaceId,
              });
            if (wsError) {
              console.error("建立工作區綁定失敗:", wsError.message);
            }
          }

          toast({
            title: "註冊成功！",
            description: "請前往信箱確認驗證信（若已關閉電子郵件驗證則可直接登入）。",
          });
          setIsRegister(false);
        }
      } else {
        // 登入流程
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
        window.location.href = "/";
      }
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: isRegister ? "註冊失敗" : "登入失敗",
        description: err.message || "請檢查您的帳號密碼",
      });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="family-login min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-8">
      {/* 背景微光漸層裝飾 (Ambient Glow) */}
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-sky-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-amber-500 rounded-full blur-[120px] opacity-20 pointer-events-none"></div>
      
      {/* 玻璃擬態 (Glassmorphic) 登入卡片 */}
      <div className="w-full max-w-md bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 p-6 sm:p-10 rounded-3xl shadow-2xl flex flex-col gap-6 relative z-10 transition-all duration-500">
        
        {/* Header Logo & Title */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center h-12 w-12 rounded-2xl bg-gradient-to-tr from-sky-500 to-indigo-600 text-white shadow-lg mb-2">
            <Sparkles className="w-6 h-6 animate-pulse" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-black text-white tracking-tight leading-none">
            家庭生活工具
          </h1>
          <p className="text-xs sm:text-sm font-medium text-slate-400">
            {isRecovery
              ? "設定新的登入密碼"
              : isRegister
              ? "建立新帳號以加入您的家庭工作區"
              : "登入以管理收支、拆帳與行程規劃"}
          </p>
        </div>

        {isRecovery ? (
          <form onSubmit={handleRecovery} className="space-y-4">
            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block pl-1">
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
                  className="input input-bordered w-full pl-10 bg-slate-800/60 border-slate-700 focus:border-sky-500 rounded-2xl text-white text-sm sm:text-base placeholder-slate-500"
                  placeholder="至少 8 個字元"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block pl-1">
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
                  className="input input-bordered w-full pl-10 bg-slate-800/60 border-slate-700 focus:border-sky-500 rounded-2xl text-white text-sm sm:text-base placeholder-slate-500"
                  placeholder="再次輸入新密碼"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn w-full h-12 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 border-none text-white font-black shadow-lg shadow-sky-500/10 mt-4 disabled:opacity-55"
            >
              {loading ? <span className="loading loading-spinner loading-sm"></span> : "更新密碼"}
            </button>
          </form>
        ) : (
        <>
        {/* Form */}
        <form onSubmit={handleAuth} className="space-y-4">
          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block pl-1">
              Email
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Mail className="w-4 h-4" />
              </span>
              <input
                type="email"
                required
                className="input input-bordered w-full pl-10 bg-slate-800/60 border-slate-700 focus:border-sky-500 rounded-2xl text-white text-sm sm:text-base placeholder-slate-500"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] sm:text-xs font-bold text-slate-400 uppercase tracking-wider block pl-1">
              密碼
            </label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                <Lock className="w-4 h-4" />
              </span>
              <input
                type="password"
                required
                className="input input-bordered w-full pl-10 bg-slate-800/60 border-slate-700 focus:border-sky-500 rounded-2xl text-white text-sm sm:text-base placeholder-slate-500"
                placeholder="請輸入密碼"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn w-full h-12 rounded-2xl bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-600 hover:to-indigo-700 border-none text-white font-black shadow-lg shadow-sky-500/10 mt-4 flex items-center justify-center gap-2 text-sm sm:text-base transition-all duration-300 disabled:opacity-55"
          >
            {loading ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-5 h-5" /> 註冊新帳號
              </>
            ) : (
              <>
                <LogIn className="w-5 h-5" /> 安全登入
              </>
            )}
          </button>
        </form>

        {/* Footer Mode Switcher */}
        <div className="text-center border-t border-slate-700/40 pt-4 mt-2 space-y-3">
          {!isRegister && (
            <button
              type="button"
              className="block w-full text-xs sm:text-sm font-semibold text-slate-300 hover:text-white transition-colors"
              onClick={sendRecoveryEmail}
              disabled={loading}
            >
              忘記密碼？
            </button>
          )}
          <button
            type="button"
            className="text-xs sm:text-sm font-semibold text-sky-400 hover:text-sky-300 transition-colors"
            onClick={() => setIsRegister(!isRegister)}
          >
            {isRegister ? "已有帳號？立即登入" : "沒有帳號？註冊新帳號"}
          </button>
        </div>
        </>
        )}

      </div>
    </main>
  );
}
