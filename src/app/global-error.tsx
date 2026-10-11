"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", background: "#eee8df", color: "#2b2724", display: "grid", placeItems: "center", minHeight: "100vh", margin: 0 }}>
        <div style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontWeight: 400 }}>Something went wrong</h1>
          <p>Please refresh the page or try again in a moment.</p>
          <button type="button" onClick={reset} style={{ padding: "10px 18px", borderRadius: 999, border: 0, background: "#3e4a2f", color: "#fff", cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
