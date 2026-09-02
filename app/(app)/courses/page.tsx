"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Hole = { hole_number: number; par: string; handicap_index: string };
type Course = { id: string; name: string };
type HoleRow = { hole_number: number; par: number; handicap_index: number };

const BLANK_HOLES: Hole[] = Array.from({ length: 18 }, (_, i) => ({
  hole_number: i + 1,
  par: "",
  handicap_index: "",
}));

export default function CoursesPage() {
  const supabase = useMemo(() => createClient(), []);
  const [courses, setCourses] = useState<Course[]>([]);
  const [holesByCourse, setHolesByCourse] = useState<Record<string, HoleRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [courseName, setCourseName] = useState("");
  const [holes, setHoles] = useState<Hole[]>(BLANK_HOLES);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const totalPar = holes.reduce((sum, h) => sum + (Number(h.par) || 0), 0);

  async function loadCourses() {
    setLoading(true);
    const { data } = await supabase.from("courses").select("*").order("name");
    setCourses(data ?? []);
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadHoles(courseId: string) {
    if (holesByCourse[courseId]) return;
    const { data } = await supabase
      .from("course_holes")
      .select("hole_number, par, handicap_index")
      .eq("course_id", courseId)
      .order("hole_number");
    setHolesByCourse((prev) => ({ ...prev, [courseId]: data ?? [] }));
  }

  function toggleExpand(course: Course) {
    if (expanded === course.id) {
      setExpanded(null);
    } else {
      setExpanded(course.id);
      loadHoles(course.id);
    }
  }

  function updateHole(index: number, field: "par" | "handicap_index", value: string) {
    setHoles((prev) =>
      prev.map((h, i) => (i === index ? { ...h, [field]: value } : h))
    );
  }

  function isDuplicateCourseName(candidate: string) {
    const normalized = candidate.trim().toLowerCase();
    return courses.some((c) => c.name.trim().toLowerCase() === normalized);
  }

  function validateHoles(): string | null {
    if (!courseName.trim()) return "Enter a course name.";
    if (isDuplicateCourseName(courseName)) return "A course with this name already exists.";

    const pars: number[] = [];
    const indexes: number[] = [];
    for (const h of holes) {
      const par = Number(h.par);
      const idx = Number(h.handicap_index);
      if (!h.par || Number.isNaN(par) || par < 3 || par > 6) {
        return `Hole ${h.hole_number}: enter a valid par (3–6).`;
      }
      if (!h.handicap_index || Number.isNaN(idx) || idx < 1 || idx > 18) {
        return `Hole ${h.hole_number}: enter a handicap index (1–18).`;
      }
      pars.push(par);
      indexes.push(idx);
    }

    const uniqueIndexes = new Set(indexes);
    if (uniqueIndexes.size !== 18) {
      return "Handicap indexes must cover 1–18 with no duplicates.";
    }
    for (let i = 1; i <= 18; i++) {
      if (!uniqueIndexes.has(i)) return `Handicap index ${i} is missing.`;
    }

    return null;
  }

  async function handleAddCourse(e: React.FormEvent) {
    e.preventDefault();
    setFormError(null);

    const err = validateHoles();
    if (err) {
      setFormError(err);
      return;
    }

    setSaving(true);
    const { data: course, error } = await supabase
      .from("courses")
      .insert({ name: courseName.trim() })
      .select()
      .single();

    if (error || !course) {
      setSaving(false);
      setFormError(
        error?.code === "23505" ? "A course with this name already exists." : error?.message ?? "Could not save course."
      );
      return;
    }

    const holeRows = holes.map((h) => ({
      course_id: course.id,
      hole_number: h.hole_number,
      par: Number(h.par),
      handicap_index: Number(h.handicap_index),
    }));
    const { error: holesError } = await supabase.from("course_holes").insert(holeRows);
    setSaving(false);

    if (holesError) {
      setFormError(holesError.message);
      // roll back the course record so we don't leave an 18-hole-less course behind
      await supabase.from("courses").delete().eq("id", course.id);
      return;
    }

    setCourseName("");
    setHoles(BLANK_HOLES);
    setShowForm(false);
    loadCourses();
  }

  async function handleDelete(id: string) {
    setDeleteError(null);
    const { count } = await supabase
      .from("rounds")
      .select("*", { count: "exact", head: true })
      .eq("course_id", id);

    if (count && count > 0) {
      setDeleteError("This course is used in a saved round and can't be deleted.");
      setConfirmDeleteId(null);
      return;
    }

    const { error } = await supabase.from("courses").delete().eq("id", id);
    if (error) {
      setDeleteError(error.message);
      return;
    }
    setConfirmDeleteId(null);
    loadCourses();
  }

  const filtered = courses.filter((c) =>
    c.name.toLowerCase().includes(search.trim().toLowerCase())
  );

  return (
    <div className="mx-auto max-w-lg px-4 py-5 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold" style={{ color: "var(--color-fairway)" }}>
            Courses
          </h1>
          <p className="text-sm mt-0.5" style={{ color: "var(--color-text-muted)" }}>
            {courses.length} course{courses.length === 1 ? "" : "s"} saved
          </p>
        </div>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg px-3 py-2 text-xs font-semibold text-white"
          style={{ background: "var(--color-fairway)" }}
        >
          {showForm ? "Cancel" : "+ Add course"}
        </button>
      </div>

      {showForm && (
        <form
          onSubmit={handleAddCourse}
          className="rounded-xl border p-4 space-y-3"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
        >
          <input
            value={courseName}
            onChange={(e) => setCourseName(e.target.value)}
            placeholder="Course name"
            className="w-full rounded-lg border px-3 py-2 text-sm outline-none"
            style={{ borderColor: "var(--color-border)" }}
          />

          <div>
            <div className="grid grid-cols-[2rem_1fr_1fr] gap-1.5 text-[11px] font-semibold px-1 mb-1" style={{ color: "var(--color-text-muted)" }}>
              <span>Hole</span>
              <span>Par</span>
              <span>Hcp index</span>
            </div>
            <div className="max-h-72 overflow-y-auto space-y-1 pr-1">
              {holes.map((h, i) => (
                <div key={h.hole_number} className="grid grid-cols-[2rem_1fr_1fr] gap-1.5 items-center">
                  <span className="text-xs tabular text-center" style={{ color: "var(--color-text-muted)" }}>
                    {h.hole_number}
                  </span>
                  <input
                    value={h.par}
                    onChange={(e) => updateHole(i, "par", e.target.value)}
                    inputMode="numeric"
                    className="rounded-md border px-2 py-1.5 text-sm tabular outline-none"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                  <input
                    value={h.handicap_index}
                    onChange={(e) => updateHole(i, "handicap_index", e.target.value)}
                    inputMode="numeric"
                    className="rounded-md border px-2 py-1.5 text-sm tabular outline-none"
                    style={{ borderColor: "var(--color-border)" }}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between text-sm px-1">
            <span style={{ color: "var(--color-text-muted)" }}>Total par</span>
            <span className="font-semibold tabular">{totalPar}</span>
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
            {saving ? "Saving…" : "Save course"}
          </button>
        </form>
      )}

      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search courses…"
        className="w-full rounded-lg border px-3.5 py-2.5 text-sm outline-none"
        style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
      />

      {deleteError && (
        <p className="text-sm rounded-lg px-3 py-2" style={{ background: "var(--color-flag-soft)", color: "var(--color-flag)" }}>
          {deleteError}
        </p>
      )}

      {loading ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>Loading courses…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--color-text-muted)" }}>
          {courses.length === 0 ? "No courses yet — add your first one above." : "No courses match your search."}
        </p>
      ) : (
        <ul className="space-y-2">
          {filtered.map((c) => {
            const courseHoles = holesByCourse[c.id];
            const par = courseHoles?.reduce((s, h) => s + h.par, 0);
            return (
              <li
                key={c.id}
                className="rounded-xl border p-3.5"
                style={{ borderColor: "var(--color-border)", background: "var(--color-surface)" }}
              >
                <div className="flex items-center justify-between">
                  <button onClick={() => toggleExpand(c)} className="text-left flex-1">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-xs tabular" style={{ color: "var(--color-text-muted)" }}>
                      18 holes{par !== undefined ? ` · Par ${par}` : ""}
                    </p>
                  </button>
                  {confirmDeleteId === c.id ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => handleDelete(c.id)} className="text-xs font-medium" style={{ color: "var(--color-flag)" }}>
                        Confirm
                      </button>
                      <button onClick={() => setConfirmDeleteId(null)} className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <button onClick={() => setConfirmDeleteId(c.id)} className="text-xs font-medium" style={{ color: "var(--color-text-muted)" }}>
                      Delete
                    </button>
                  )}
                </div>

                {expanded === c.id && (
                  <div className="mt-3 pt-3 border-t" style={{ borderColor: "var(--color-border)" }}>
                    {!courseHoles ? (
                      <p className="text-xs" style={{ color: "var(--color-text-muted)" }}>Loading holes…</p>
                    ) : (
                      <div className="grid grid-cols-3 gap-x-3 gap-y-1 text-xs tabular">
                        <span className="font-semibold" style={{ color: "var(--color-text-muted)" }}>Hole</span>
                        <span className="font-semibold" style={{ color: "var(--color-text-muted)" }}>Par</span>
                        <span className="font-semibold" style={{ color: "var(--color-text-muted)" }}>Hcp</span>
                        {courseHoles.map((h) => (
                          <>
                            <span key={`n${h.hole_number}`}>{h.hole_number}</span>
                            <span key={`p${h.hole_number}`}>{h.par}</span>
                            <span key={`i${h.hole_number}`}>{h.handicap_index}</span>
                          </>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
