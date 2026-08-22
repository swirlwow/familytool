import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

const scopeLabels: Record<string, string> = {
  openid: "確認你的登入身分",
  email: "讀取登入電子郵件",
  profile: "讀取顯示名稱與基本資料",
};

export default async function OAuthConsentPage({
  searchParams,
}: {
  searchParams: Promise<{ authorization_id?: string }>;
}) {
  const authorizationId = (await searchParams).authorization_id;
  if (!authorizationId) return <ConsentMessage title="授權連結不完整" body="請回到值班休假重新登入。" />;

  const cookieStore = await cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    },
  );

  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    const returnPath = `/oauth/consent?authorization_id=${encodeURIComponent(authorizationId)}`;
    redirect(`/login?redirect=${encodeURIComponent(returnPath)}`);
  }

  const { data: details, error } = await supabase.auth.oauth.getAuthorizationDetails(authorizationId);
  if (error || !details) return <ConsentMessage title="無法讀取授權資料" body={error?.message ?? "請重新開啟登入流程。"} />;
  if (!("authorization_id" in details)) redirect(details.redirect_url);

  const scopes = details.scope?.split(" ").filter(Boolean) ?? [];
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8">
      <section className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-sm font-bold text-rose-500">FAMILYTOOL 共用登入</p>
        <h1 className="mt-2 text-2xl font-black text-slate-900">允許「{details.client.name}」使用你的帳號？</h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">授權後可直接進入值班休假，不會分享 FAMILYTOOL 的家庭帳務或行事曆內容。</p>
        <div className="mt-6 rounded-xl bg-slate-50 p-4">
          <p className="text-xs font-bold uppercase tracking-wide text-slate-500">將提供</p>
          <ul className="mt-3 space-y-2 text-sm text-slate-700">
            {scopes.map((scope) => <li key={scope}>✓ {scopeLabels[scope] ?? scope}</li>)}
          </ul>
        </div>
        <form action="/api/oauth/decision" method="post" className="mt-6 grid grid-cols-2 gap-3">
          <input type="hidden" name="authorization_id" value={authorizationId} />
          <button type="submit" name="decision" value="deny" className="rounded-xl border border-slate-300 px-4 py-3 font-bold text-slate-700">取消</button>
          <button type="submit" name="decision" value="approve" className="rounded-xl bg-rose-500 px-4 py-3 font-bold text-white">允許並繼續</button>
        </form>
      </section>
    </main>
  );
}

function ConsentMessage({ title, body }: { title: string; body: string }) {
  return <main className="flex min-h-screen items-center justify-center bg-slate-100 p-6"><section className="max-w-md rounded-2xl bg-white p-8 shadow-sm"><h1 className="text-xl font-black">{title}</h1><p className="mt-3 text-slate-600">{body}</p></section></main>;
}
