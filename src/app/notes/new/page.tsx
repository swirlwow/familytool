// src/app/notes/new/page.tsx
import { Suspense } from "react";
import NotesNewClient from "./NotesNewClient";

export default function NotesNewPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <div className="text-slate-400">建立記事中…</div>
        </main>
      }
    >
      <NotesNewClient />
    </Suspense>
  );
}
