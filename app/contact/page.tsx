import Link from "next/link";

export default function ContactPage() {
  return (
    <main className="flex-1 flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center">
          <h1 className="font-display text-2xl font-bold" style={{ color: "var(--color-fairway)" }}>
            About this app
          </h1>
        </div>

        <div
          className="rounded-xl border p-5 space-y-4 text-sm"
          style={{ borderColor: "var(--color-border)", background: "var(--color-surface)", color: "var(--color-text)" }}
        >
          <div>
            <h2 className="font-semibold mb-1">Who this is for</h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              Golf Round Tracker is a private scorekeeping tool built for a small group of friends. It&apos;s not
              intended for the public. If you&apos;ve found this page without knowing anyone in the group, there&apos;s
              nothing here for you to sign up for — feel free to just close the tab.
            </p>
          </div>

          <div>
            <h2 className="font-semibold mb-1">What data is stored</h2>
            <ul className="list-disc list-inside space-y-1" style={{ color: "var(--color-text-muted)" }}>
              <li>Your email address, used only to log in</li>
              <li>Golfer names and handicaps entered into the app</li>
              <li>Golf rounds and hole-by-hole scores recorded in the app</li>
            </ul>
            <p className="mt-2" style={{ color: "var(--color-text-muted)" }}>
              This data is only visible to approved members of the group and the app&apos;s admin. New accounts must
              be manually approved before they can use the app.
            </p>
          </div>

          <div>
            <h2 className="font-semibold mb-1">How it&apos;s built</h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              The app runs on Vercel and stores data in a Supabase (Postgres) database. It&apos;s a small,
              independently run hobby project, not a commercial product.
            </p>
          </div>

          <div>
            <h2 className="font-semibold mb-1">Contact</h2>
            <p style={{ color: "var(--color-text-muted)" }}>
              Questions, account requests, or concerns about your data:{" "}
              <a href="mailto:luggi360@gmail.com" className="font-medium" style={{ color: "var(--color-fairway)" }}>
                luggi360@gmail.com
              </a>
            </p>
          </div>
        </div>

        <p className="text-center text-sm">
          <Link href="/login" className="font-medium" style={{ color: "var(--color-fairway)" }}>
            Back to login
          </Link>
        </p>
      </div>
    </main>
  );
}