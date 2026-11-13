'use client';
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconClose, IconPaw } from './Icons';
import { verifyEmailCallback, VerificationResult } from '../services/emailVerification';

const copy: Record<VerificationResult | 'checking', { title: string; body: string }> = {
  checking: { title: '正在确认邮箱', body: '请稍候，正在确认你的邮箱验证结果。' },
  success: { title: '邮箱验证成功', body: '你的邮箱已完成验证。请返回家长端，使用注册时的邮箱和密码登录。' },
  expired: { title: '验证链接已过期或已使用', body: '如果你已经完成验证，可以直接登录；尚未验证，请返回注册页重新获取验证邮件。' },
  invalid: { title: '无法确认验证结果', body: '请从注册邮件中打开完整的验证链接。如果此前已经验证成功，可以直接登录。' },
  failed: { title: '暂时无法连接验证服务', body: '请检查网络后重试。如果邮箱已经验证，也可以直接前往登录。' },
  unconfigured: { title: '验证服务尚未配置', body: '请稍后再次打开邮件中的链接，或联系管理员。' },
};
export function EmailVerification() {
  const [result, setResult] = useState<VerificationResult | 'checking'>('checking');
  const initial = useRef<Promise<VerificationResult> | null>(null);
  const callback = useRef('');
  useEffect(() => {
    let alive = true;
    if (!initial.current) {
      callback.current = window.location.href;
      const callbackUrl = new URL(callback.current);
      const verifiedAt = Number(window.history.state?.emailVerifiedAt || 0);
      const recentlyVerified = verifiedAt > 0 && Date.now() - verifiedAt >= 0 && Date.now() - verifiedAt < 30 * 60 * 1000;
      // Remove tokens and errors from the address bar before making a request.
      window.history.replaceState(window.history.state, '', window.location.pathname);
      initial.current = recentlyVerified && !callbackUrl.hash && !callbackUrl.search
        ? Promise.resolve('success')
        : verifyEmailCallback(callback.current);
    }
    initial.current.then(next => {
      if (!alive) return;
      if (next === 'success') window.history.replaceState({ ...window.history.state, emailVerifiedAt: Date.now() }, '', window.location.pathname);
      setResult(next);
    });
    return () => { alive = false; };
  }, []);
  const retry = async () => {
    setResult('checking');
    const next = await verifyEmailCallback(callback.current);
    if (next === 'success') window.history.replaceState({ ...window.history.state, emailVerifiedAt: Date.now() }, '', window.location.pathname);
    setResult(next);
  };
  const success = result === 'success';
  const checking = result === 'checking';
  return <main className="parent-app-shell min-h-screen flex items-center justify-center px-5 py-12">
    <div className="w-full max-w-sm space-y-7">
      <div className="flex items-center justify-center gap-2 text-sm font-semibold text-[#77786F]">
        <IconPaw className="w-5 h-5 text-[#3E493F]" />学习宠物助手
      </div>
      <section className="kid-card !px-6 !py-8 text-center space-y-5" aria-live="polite" aria-busy={checking}>
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${success ? 'bg-[#E9F2EC] text-[#4C7866]' : checking ? 'bg-[#F7EBE5] text-[#B96043]' : 'bg-[#FBF3E2] text-[#A87525]'}`}>
          {success ? <IconCheck className="w-8 h-8" /> : checking ? <span className="w-7 h-7 rounded-full border-2 border-current border-t-transparent animate-spin" aria-hidden="true" /> : <IconClose className="w-7 h-7" />}
        </div>
        <h1 className="text-xl font-bold text-[#242620]">{copy[result].title}</h1>
        <p className="text-sm leading-7 text-[#77786F]">{copy[result].body}</p>
        {!checking && <div className="pt-2 space-y-3">
          {result === 'failed' && <button className="kid-btn kid-btn-primary w-full" onClick={retry}>重试验证</button>}
          <a className={`kid-btn ${result === 'failed' ? 'kid-btn-ghost' : 'kid-btn-primary'} w-full`} href="/">{success ? '前往登录' : '返回登录 / 注册'}</a>
        </div>}
      </section>
      {success && <p className="text-center text-xs text-[#77786F]">此链接仅用于验证邮箱，不会自动登录家长端。</p>}
    </div>
  </main>;
}
