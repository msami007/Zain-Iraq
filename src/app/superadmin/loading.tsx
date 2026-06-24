export default function SuperAdminLoading() {
  return (
    <div className="flex h-screen w-full font-sans">
      {/* Sidebar skeleton */}
      <aside className="w-[220px] flex-shrink-0 bg-[#0c0c14] flex flex-col shadow-[4px_0_24px_rgba(0,0,0,0.35)]">
        <div className="h-16 flex items-center px-5 border-b border-white/10">
          <div className="h-4 w-28 rounded bg-white/10 animate-pulse" />
        </div>
        <div className="flex-1 px-3 pt-5 space-y-1">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="h-9 rounded-lg bg-white/5 animate-pulse" style={{ animationDelay: `${i * 50}ms` }} />
          ))}
        </div>
        <div className="p-4 border-t border-white/10">
          <div className="h-8 rounded-lg bg-white/5 animate-pulse" />
        </div>
      </aside>

      {/* Main area */}
      <div className="flex-1 flex flex-col bg-zinc-50 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-zinc-200 flex items-center justify-between px-8 flex-shrink-0">
          <div className="h-4 w-44 rounded bg-zinc-200 animate-pulse" />
          <div className="flex items-center gap-3">
            <div className="h-7 w-36 rounded-lg bg-zinc-100 animate-pulse" />
            <div className="h-7 w-20 rounded-lg bg-zinc-100 animate-pulse" />
          </div>
        </header>

        {/* Content */}
        <div className="flex-1 p-8 space-y-6">
          {/* KPI cards — 6 col */}
          <div className="grid grid-cols-6 gap-4">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-[120px] rounded-xl bg-white border border-zinc-200 shadow-sm animate-pulse" style={{ animationDelay: `${i * 60}ms` }} />
            ))}
          </div>
          {/* Charts row */}
          <div className="grid grid-cols-2 gap-6">
            <div className="h-64 rounded-xl bg-white border border-zinc-200 shadow-sm animate-pulse" />
            <div className="h-64 rounded-xl bg-white border border-zinc-200 shadow-sm animate-pulse" style={{ animationDelay: "80ms" }} />
          </div>
          <div className="grid grid-cols-2 gap-6">
            <div className="h-48 rounded-xl bg-white border border-zinc-200 shadow-sm animate-pulse" style={{ animationDelay: "120ms" }} />
            <div className="h-48 rounded-xl bg-white border border-zinc-200 shadow-sm animate-pulse" style={{ animationDelay: "160ms" }} />
          </div>
        </div>
      </div>
    </div>
  );
}
