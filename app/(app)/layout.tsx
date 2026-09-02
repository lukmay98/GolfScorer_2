import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import NavBar from "./nav-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  return (
    <div className="flex-1 flex flex-col min-h-screen">
      <header
        className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 border-b"
        style={{ background: "var(--color-fairway)", borderColor: "var(--color-fairway)" }}
      >
        <div className="flex items-center gap-2">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="5" y1="21" x2="5" y2="3" />
            <path d="M5 4h13l-3 4 3 4H5" />
          </svg>
          <span className="font-display font-bold text-white text-sm tracking-tight">
            Golf Round Tracker
          </span>
        </div>
        <span className="text-xs text-white/70">{user.email}</span>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <NavBar />
    </div>
  );
}
