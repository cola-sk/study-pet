'use client';

import dynamic from 'next/dynamic';

const MainLayout = dynamic(
  () => import('../components/Layout').then(mod => mod.Layout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-blue-600 text-white flex items-center justify-center text-3xl shadow-lg animate-pulse">
          🐾
        </div>
        <div className="text-xs text-gray-400 font-medium tracking-wide">
          正在加载学习宠物助手...
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <MainLayout />;
}
