"use client";

/**
 * The last resort: an error thrown by the root layout itself.
 *
 * `error.tsx` renders inside the layout, so it cannot catch a failure in the
 * layout. This one replaces the whole document, which is why it has to supply
 * its own `<html>` and `<body>` — and why it uses inline styles rather than
 * Tailwind classes. If the stylesheet is what failed, class names render as
 * unstyled text, and the page that exists to reassure someone looks broken.
 */

export default function GlobalError({ error }: { error: Error & { digest?: string } }) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fafafa",
          color: "#18181b",
        }}
      >
        <main style={{ maxWidth: "28rem", padding: "2rem", lineHeight: 1.6 }}>
          <h1 style={{ fontSize: "1.5rem", margin: "0 0 1rem" }}>Something went wrong</h1>
          <p style={{ margin: "0 0 1rem" }}>
            <strong>Your resume is safe.</strong> It is stored in this browser and was saved as you
            typed. Nothing here has deleted or altered it.
          </p>
          <p style={{ margin: "0 0 1.5rem" }}>Reloading the page usually clears this.</p>
          <a
            href="/builder"
            style={{
              display: "inline-block",
              background: "#0369a1",
              color: "#ffffff",
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              textDecoration: "none",
            }}
          >
            Back to the builder
          </a>
          {error.digest ? (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", color: "#52525b" }}>
              Reference <code>{error.digest}</code>
            </p>
          ) : null}
        </main>
      </body>
    </html>
  );
}
