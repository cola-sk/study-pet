'use client';

import dynamic from 'next/dynamic';
import { useEffect, useState } from 'react';
import { EMAIL_VERIFICATION_PATH, PASSWORD_RESET_PATH } from '../services/supabaseConfig';
import { isEmailVerificationCallback } from '../services/emailVerification';
import { isPasswordRecoveryCallback } from '../services/passwordRecovery';
import { IconPaw } from '../components/Icons';

const MainLayout = dynamic(
  () => import('../components/Layout').then(mod => mod.Layout),
  {
    ssr: false,
    loading: () => (
      <div className="min-h-screen bg-[#FFFFFF] flex flex-col items-center justify-center space-y-4">
        <div className="w-16 h-16 rounded-full bg-[#EF4444] text-white flex items-center justify-center text-3xl font-bold shadow-[0_4px_0_#B91C1C]">
          <IconPaw className="w-8 h-8" />
        </div>
        <div className="text-body font-bold text-[#1F2937]">
          正在进入哈小伴乐园...
        </div>
      </div>
    ),
  }
);

export default function HomePage() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    // Old registration emails still land on /. Forward them before mounting
    // the normal Auth client, so it cannot adopt the email-link session.
    if (isPasswordRecoveryCallback(window.location.href)) {
      window.location.replace(`${PASSWORD_RESET_PATH}${window.location.search}${window.location.hash}`);
      return;
    }
    if (isEmailVerificationCallback(window.location.href)) {
      window.location.replace(`${EMAIL_VERIFICATION_PATH}${window.location.search}${window.location.hash}`);
      return;
    }
    setReady(true);
  }, []);
  return ready ? <MainLayout /> : <main className="parent-app-shell min-h-screen flex items-center justify-center" role="status">正在加载…</main>;
}
