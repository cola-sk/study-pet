'use client';

import dynamic from 'next/dynamic';

const MainLayout = dynamic(
  () => import('../components/Layout').then(mod => mod.Layout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#F4F6F9] flex flex-col items-center justify-center space-y-3">
        <div className="w-10 h-10 rounded-lg bg-slate-900 text-white flex items-center justify-center text-lg font-bold shadow-xs">
          SP
        </div>
        <div className="text-xs text-slate-500 font-medium tracking-wide">
          正在加载 StudyPet 控制台...
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  return <MainLayout />;
}
