import { Link } from 'react-router-dom';

export default function PlaceholderPage({ title, phase, children }) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-10">
      <p className="text-xs uppercase tracking-wide text-indigo-600 mb-2">{phase}</p>
      <h1 className="text-2xl font-bold text-slate-900 mb-3">{title}</h1>
      <div className="text-slate-600 space-y-2">{children}</div>
      <Link to="/" className="inline-block mt-6 text-indigo-600 hover:underline">
        返回首页
      </Link>
    </div>
  );
}
