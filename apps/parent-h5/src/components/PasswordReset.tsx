'use client';
import { useEffect, useRef, useState } from 'react';
import { IconCheck, IconPaw } from './Icons';
import { beginPasswordRecovery, Recovery, RecoveryStatus } from '../services/passwordRecovery';

const errors: Record<RecoveryStatus, string> = {
  invalid: '请从重置密码邮件中打开完整链接。',
  expired: '重置链接已过期或已使用，请重新申请邮件。',
  failed: '暂时无法连接验证服务，请检查网络后重试。',
  unconfigured: '登录服务尚未配置，请稍后重试。',
};
export function PasswordReset() {
  const [recovery, setRecovery] = useState<Recovery | null>(null);
  const [password, setPassword] = useState(''), [confirmation, setConfirmation] = useState('');
  const [show, setShow] = useState(false), [busy, setBusy] = useState(false), [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const callback = useRef(''), loading = useRef<Promise<Recovery> | null>(null), submitting = useRef(false);
  useEffect(() => {
    let active = true;
    if (!loading.current) {
      callback.current = window.location.href;
      window.history.replaceState(window.history.state, '', window.location.pathname);
      loading.current = beginPasswordRecovery(callback.current);
    }
    loading.current.then(next => { if (active) setRecovery(next); });
    return () => { active = false; };
  }, []);
  const retry = async () => { setRecovery(null); setRecovery(await beginPasswordRecovery(callback.current)); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (submitting.current || recovery?.status !== 'ready') return;
    if (password.length < 8 || password.length > 72) { setError('新密码需为 8–72 个字符。'); return; }
    if (password !== confirmation) { setError('两次输入的密码不一致。'); return; }
    submitting.current = true; setBusy(true); setError('');
    try {
      const result = await recovery.save(password);
      if (result === 'success') {
        // Clear the normal parent session only when it belongs to the account
        // just reset. A different account in this browser is left untouched.
        try {
          const { supabase } = await import('../services/supabase');
          const session = await supabase?.auth.getSession();
          if (session?.data.session?.user.id === recovery.userId) await supabase?.auth.signOut({ scope: 'local' });
        } catch { /* A completed password change must still be shown as success. */ }
        setPassword(''); setConfirmation(''); setSuccess(true);
      } else if (result === 'expired') { setRecovery({ status: 'expired' }); setPassword(''); setConfirmation(''); }
      else setError(result === 'weak' ? '请换一个更安全、与旧密码不同的新密码。' : '暂时无法修改密码，请检查网络后重试。');
    } finally { submitting.current = false; setBusy(false); }
  };
  return <main className="parent-app-shell min-h-screen flex items-center justify-center px-5 py-10">
    <div className="w-full max-w-sm space-y-6">
      <div className="flex justify-center items-center gap-2 text-sm font-semibold"><IconPaw className="w-5 h-5" />学习宠物助手</div>
      <section className="kid-card !p-6 space-y-5" aria-live="polite">
        {success ? <><IconCheck className="w-12 h-12 mx-auto text-[#4C7866]" /><h1 className="text-xl font-bold text-center">密码修改成功</h1><p className="text-sm leading-6 text-[#77786F]">请返回家长端，使用新密码登录。</p><a href="/" className="kid-btn kid-btn-primary w-full">前往登录</a></> : <>
          <h1 className="text-xl font-bold">设置新密码</h1>
          {!recovery ? <p role="status">正在验证重置链接…</p> : recovery.status !== 'ready' ? <><p className="text-sm leading-6">{errors[recovery.status]}</p>{recovery.status === 'failed' && <button type="button" className="kid-btn kid-btn-primary w-full" onClick={retry}>重试验证</button>}<a href="/?auth=forgot" className="kid-btn kid-btn-ghost w-full">重新申请重置邮件</a></> : <form onSubmit={save} className="space-y-4">
            <p className="text-sm text-[#77786F]">设置 8–72 个字符的新密码，此页面不会进入家庭空间。</p>
            <label className="block text-sm">新密码<input className="kid-input mt-2" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} required disabled={busy} value={password} onChange={e => setPassword(e.target.value)} /></label>
            <label className="block text-sm">再次输入新密码<input className="kid-input mt-2" type={show ? 'text' : 'password'} autoComplete="new-password" minLength={8} maxLength={72} required disabled={busy} value={confirmation} onChange={e => setConfirmation(e.target.value)} /></label>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={show} onChange={e => setShow(e.target.checked)} />显示密码</label>
            {error && <p role="alert" className="text-sm text-[#B45309]">{error}</p>}
            <button className="kid-btn kid-btn-primary w-full" disabled={busy} type="submit">{busy ? '正在保存…' : '保存新密码'}</button>
            <a href="/" className="kid-btn kid-btn-ghost w-full">返回登录</a>
          </form>}
        </>}
      </section>
    </div>
  </main>;
}
