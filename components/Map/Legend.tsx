export default function Legend() {
  const items = [
    { label: 'Low', color: '#4caf50' },
    { label: 'Moderate', color: '#ffb300' },
    { label: 'High', color: '#fb8c00' },
    { label: 'Very High', color: '#e53935' },
    { label: 'No data', color: '#9e9e9e' },
  ];
  return (
    <div className="max-w-[calc(100vw-1.5rem)] rounded-xl bg-slate-950/80 px-3 py-2.5 text-slate-50 shadow-xl backdrop-blur-md sm:max-w-[calc(100vw-6rem)] sm:rounded-2xl sm:px-4 sm:py-3">
      <strong className="text-[10px] font-semibold uppercase tracking-wide text-slate-300 sm:text-xs">
        Daily peak risk
      </strong>
      <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 sm:mt-2 sm:gap-3">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-1.5">
            <span
              aria-hidden
              className="inline-block h-2.5 w-2.5 rounded-sm sm:h-3 sm:w-3"
              style={{ background: it.color }}
            />
            <span className="text-[10px] sm:text-xs">{it.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
