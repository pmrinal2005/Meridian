export default function PageHeader({ title, subtitle, right }: { title: string; subtitle?: string; right?: React.ReactNode }) {
  return (
    <header className="sticky top-0 z-10 bg-slate-50/90 backdrop-blur border-b border-slate-200 px-8 h-16 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-bold text-ink-900 leading-tight">{title}</h1>
        {subtitle && <p className="text-xs text-slate-500">{subtitle}</p>}
      </div>
      {right}
    </header>
  );
}
