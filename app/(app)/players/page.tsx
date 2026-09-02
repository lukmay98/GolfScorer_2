"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Golfer = { id: string; name: string; handicap: number };

export default function PlayersPage() {
  const supabase = useMemo(() => createClient(), []);
  const [golfers, setGolfers] = useState<Golfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const [name, setName] = useState("");
  const [handicap, setHandicap] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editHandicap, setEditHandicap] = useState("");
  const [editError, setEditError] = useState<string | null>(null);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  async function loadGolfers() {
    setLoading(true);
    const { data } = await supabase.from("golfers").select("*").order("name");
    setGolfers(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadGolfers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = golfers.filter((g) =>
    g.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  function isDuplicate(candidate: string, excludeId?: string) {
    const normalized = candidate.trim().toLowerCase();
    return golfers.some(
      (g) => g.id !== excludeId && g.name.trim().toLowerCase() === normalized
    );
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const trimmedName = name.trim();
    const hcp = Number(handicap);

    if (!trimmedName) {
      setFormError("Enter a name.");
      return;
    }
    if (Number.isNaN(hcp) || hcp < 0 || hcp > 72) {
      setFormError("Handicap must be between 0 and 72.");
      return;
    }
    if (isDuplicate(trimmedName)) {
      setFormError("A golfer with this name already exists.");
      return;
    }

    setSaving(true);
    const { error } = await supabase
      .from("golfers")
      .insert({ name: trimmedName, handicap: hcp });
    setSaving(false);

    if (error) {
      setFormError(
        error.code === "23505"
          ? "A golfer with this name already exists."
          : error.message
      );
      return;
    }

    setName("");
    setHandicap("");
    loadGolfers();
  }

  function startEdit(g: Golfer) {
    setEditingId(g.id);
    setEditName(g.name);
    setEditHandicap(String(g.handicap));
    setEditError(null);
  }

  async function handleSaveEdit(id: string) {
    setEditError(null);
    const trimmedName = editName.trim();
    const hcp = Number(editHandicap);

    if (!trimmedName) {
      setEditError("Enter a name.");
      return;
    }
    if (Number.isNaN(hcp) || hcp < 0 || hcp > 72) {
      setEditError("Handicap must be between 0 and 72.");
      return;
    }
    if (isDuplicate(trimmedName, id)) {
      setEditError("A golfer with this name already exists.");
      return;
    }

    const { error } = await supabase
      .from("golfers")
      .update({ name: trimmedName, handicap: hcp })
      .eq("id", id);

    if (error) {
      setEditError(
        error.code === "23505"
          ? "A golfer with this name already exists."
          : error.message
      );
      return;
    }

    setEditingId(null);
    loadGolfers();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const { count } = await supabase
      .from("round_players")
      .select("*", { count: "exact", head: true })
      .eq("golfer_id", id);

    if (count && count > 0) {
      setDeleteError(
        "This golfer is used in a saved round and can't be deleted."
      );
      setConfirmDeleteId(null);
      return;
    }

    const { error } = await supabase.from("golfers").delete().eq("id", id);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setConfirmDeleteId(null);
    loadGolfers();
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-6">
      <div>
        <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-fairway)" }}>
          Players
        </h1>
        <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
          {golfers.length} golfer{golfers.length === 1 ? "" : "s"} on the roster
        </p>
      </div>

      {/* Add golfer */}
      <form
        onSubmit={handleAdd}
        className="rounded-xl border p-4 space-y-3"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      >
        <h2 className="text-sm font-semibold">Add a golfer</h2>
        <div className="flex gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Name"
            className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
          <input
            value={handicap}
            onChange={(e) => setHandicap(e.target.value)}
            placeholder="Hcp"
            inputMode="decimal"
            className="w-20 rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />
        </div>
        {formError && (
          <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
            {formError}
          </p>
        )}
        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg py-2 text-sm font-semibold text-white disabled:opacity-60"
          style={{ background: "var(--color-fairway)" }}
        >
          {saving ? "Adding…" : "Add golfer"}
        </button>
      </form>

      {/* Search */}
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search golfers…"
        className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      />

      {deleteError && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
          {deleteError}
        </p>
      )}

      {/* Roster */}
      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading roster…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {golfers.length === 0 ? "No golfers yet — add your first one above." : "No golfers match your search."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((g) => (
            <li
              key={g.id}
              className="rounded-xl border p-3.5"
              style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
            >
              {editingId === g.id ? (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <input
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="flex-1 rounded-lg border px-3 py-1.5 text-sm outline-none"
                      style={{ borderColor: "var(--color-border)" }}
                    />
                    <input
                      value={editHandicap}
                      onChange={(e) => setEditHandicap(e.target.value)}
                      inputMode="decimal"
                      className="w-20 rounded-lg border px-3 py-1.5 text-sm outline-none tabular"
                      style={{ borderColor: "var(--color-border)" }}
                    />
                  </div>
                  {editError && (
                    <p className="text-xs rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
                      {editError}
                    </p>
                  )}
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleSaveEdit(g.id)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold text-white"
                      style={{ background: "var(--color-fairway)" }}
                    >
                      Save
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="flex-1 rounded-lg py-1.5 text-xs font-semibold"
                      style={{ background: "var(--color-surface-tan)" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{g.name}</p>
                    <p className="text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
                      Handicap {g.handicap}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => startEdit(g)}
                      className="text-xs font-medium"
                      style={{ color: "var(--color-fairway)" }}
                    >
                      Edit
                    </button>
                    {confirmDeleteId === g.id ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleDelete(g.id)}
                          className="text-xs font-medium"
                          style={{ color: "var(--color-flag)" }}
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDeleteId(null)}
                          className="text-xs font-medium"
                          style={{ color: "var(--color-text-muted)" }}
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setConfirmDeleteId(g.id)}
                        className="text-xs font-medium"
                        style={{ color: "var(--color-text-muted)" }}
                      >
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
