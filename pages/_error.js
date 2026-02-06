/**
 * Pages Router error page. Next.js looks for this when rendering error responses;
 * without it, the server returns "missing required error components, refreshing...".
 */
function Error({ statusCode, err }) {
  const message = statusCode
    ? `An error (${statusCode}) occurred on the server.`
    : err?.message ?? "An error occurred."
  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1 style={{ fontSize: "1.25rem", marginBottom: "0.5rem" }}>Something went wrong</h1>
      <p style={{ color: "#666", fontSize: "0.875rem" }}>{message}</p>
    </div>
  )
}

Error.getInitialProps = ({ res, err }) => {
  const statusCode = res ? res.statusCode : err ? err.statusCode : 404
  return { statusCode, err: err ?? null }
}

export default Error
