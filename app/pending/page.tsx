"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function PendingPage() {
  const router = useRouter();
  const [status, setStatus] = useState<"pending" | "rejected" | null>(null);

  useEffect(() => {
    async function loadStatus() {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: profile } = await supabase
        .from("profiles")
        .select("status")
        .eq("id", user.id)
        .maybeSingle();

      setStatus(profile?.status === "rejected" ? "rejected" : "pending");
    }
    loadStatus();
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  const isRejected = status === "rejected";

  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12 text-center">
      <div className="max-w-sm">
        <div
          className="mx-auto mb-4 h-12 w-12 rounded-full flex items-center justify-center text-xl"
          style={{ background: isRejected ? "var(--color-flag)" : "var(--color-fairway)" }}
        >
          {isRejected ? "✕" : "⏳"}
        </div>
        <h1
          className="font-display text-xl font-bold mb-2"
          style={{ color: isRejected ? "var(--color-flag)" : "var(--color-fairway)" }}
        >
          {isRejected ? "Access denied" : "Waiting for approval"}
        </h1>
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {isRejected
            ? "Your account request was declined. If you think this is a mistake, please contact an admin directly."
            : "Your account has been created and is waiting for an admin to approve it. You'll be able to use the app as soon as that happens — no need to sign up again."}
        </p>
        <button onClick={handleLogout} className="mt-6 text-sm font-medium" style={{ color: "var(--color-fairway)" }}>
          Log out
        </button>
      </div>
    </main>
  );
}