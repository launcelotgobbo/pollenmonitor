export default function Legend() {
  const items = [
    { label: 'Low', color: '#4caf50' },
    { label: 'Moderate', color: '#ffb300' },
    { label: 'High', color: '#fb8c00' },
    { label: 'Very High', color: '#e53935' },
  ];
  return (
    <div
      style={{
        position: 'relative',
        marginTop: 8,
        background: '#fff',
        border: '1px solid #e0e0e0',
        borderRadius: 6,
        padding: '8px 10px',
        width: 'fit-content',
      }}
    >
      <strong style={{ fontSize: 12 }}>Pollen Severity</strong>
      <div style={{ display: 'flex', gap: 12, marginTop: 6 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span
              aria-hidden
              style={{
                width: 12,
                height: 12,
                background: it.color,
                borderRadius: 2,
                display: 'inline-block',
              }}
            />
            <span style={{ fontSize: 12 }}>{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

