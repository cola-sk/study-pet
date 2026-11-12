'use client';

import dynamic from 'next/dynamic';

const MainLayout = dynamic(
  () => import('../components/Layout').then(mod => mod.Layout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-3xl font-bold shadow-[0_4px_0_#B91C1C]">
          🐾
        </div>
        <div className="text-body font-bold text-[#1F2937]">
          正在进入学习宠物乐园...
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <MainLayout />;
}
