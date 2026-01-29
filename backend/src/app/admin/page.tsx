'use client';

export default function AdminDashboard() {
  return (
    <div style={{ padding: '20px' }}>
      <h1>Welcome to Admin Dashboard</h1>
      <p>Select an option from the sidebar to get started.</p>

      <div
        style={{
          marginTop: '30px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '20px',
        }}
      >
        <div
          style={{
            background: 'white',
            padding: '20px',
            borderRadius: '4px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          }}
        >
          <h3>💼 Workspaces</h3>
          <p>Create, edit, and manage workspaces</p>
          <a
            href="/admin/workspaces"
            style={{
              display: 'inline-block',
              marginTop: '10px',
              padding: '8px 12px',
              backgroundColor: '#3498db',
              color: 'white',
              textDecoration: 'none',
              borderRadius: '4px',
            }}
          >
            Go to Workspaces →
          </a>
        </div>
      </div>
    </div>
  );
}
