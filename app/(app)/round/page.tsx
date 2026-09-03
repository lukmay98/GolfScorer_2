"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import RoundSetupForm from "./setup-form";
import OnHoldList from "./on-hold-list";
import ActiveRoundCard from "./scorecard";

export default function RoundPage() {
  const supabase = useMemo(() => createClient(), []);
  const [activeRoundId, setActiveRoundId] = useState<string | null | undefined>(undefined);
  const [refreshKey, setRefreshKey] = useState(0);

  async function checkActive() {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("rounds")
      .select("id")
      .eq("status", "active")
      .eq("created_by", user.id)
      .maybeSingle();
    setActiveRoundId(data?.id ?? null);
  }

  useEffect(() => {
    checkActive();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refreshKey]);

  function refresh() {
    setRefreshKey((k) => k + 1);
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-5">
      <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-fairway)" }}>
        Round
      </h1>

      {activeRoundId === undefined ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading…</p>
      ) : activeRoundId ? (
        <ActiveRoundCard roundId={activeRoundId} onChanged={refresh} />
      ) : (
        <>
          <OnHoldList onResumed={refresh} />
          <RoundSetupForm onCreated={refresh} />
        </>
      )}
    </div>
  );
}