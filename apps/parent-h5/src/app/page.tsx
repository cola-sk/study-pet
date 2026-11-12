'use client';

import dynamic from 'next/dynamic';

const MainLayout = dynamic(
  () => import('../components/Layout').then(mod => mod.Layout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#F7F5F0] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-3xl bg-[#FEF8ED] border border-[#FCE7C2] text-3xl shadow-xs flex items-center justify-center">
          🌱
        </div>
        <div className="text-xs text-[#7D7267] font-medium tracking-wide">
          正在加载伴学小窝...
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <MainLayout />;
}
