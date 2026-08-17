export default function Legend() {
  const items = [
    { label: 'Low', color: '#4caf50' },
    { label: 'Moderate', color: '#ffb300' },
    { label: 'High', color: '#fb8c00' },
    { label: 'Very High', color: '#e53935' },
    { label: 'No data', color: '#9e9e9e' },
  ];
  return (
    <div className="rounded-2xl bg-slate-900/75 px-4 py-3 text-slate-50 shadow-xl backdrop-blur-md">
      <strong className="text-xs font-semibold uppercase tracking-wide text-slate-300">Pollen risk</strong>
      <div className="mt-2 flex flex-wrap items-center gap-3">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-3 w-3 rounded-sm"
              style={{ background: it.color }}
            />
            <span className="text-xs">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
