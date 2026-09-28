export default function Home() {
  return (
    <main style={{ padding: '2rem' }}>
      <h1>Zalo Permission Backend</h1>
      <p>API Server is running</p>
      <h2>Available Endpoints:</h2>
      <ul>
        <li>POST /api/resolve-workspace-context - Resolve workspace context</li>
        <li>POST /api/sync-user - Sync users to workspace</li>
      </ul>
    </main>
  );
}
