'use client';
import { useRef, useState } from 'react';
import { Popup, Toast } from 'antd-mobile';
import { familyApi, FamilyChild } from '../../services/familyApi';
type Props = { child: FamilyChild; onClose: () => void; onSaved: () => void };
export function ChildProfileEditor({ child, onClose, onSaved }: Props) {
  const [nickname, setNickname] = useState(child.nickname), [petName, setPetName] = useState(child.pet_name || '小二哈');
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  const running = useRef(false);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    if (running.current) return;
    running.current = true; setPending(true); setError('');
    try {
      await familyApi(`/api/v1/family/children/${child.id}`, { method: 'PATCH', body: JSON.stringify({ nickname: nickname.trim(), petName: petName.trim() }) });
      Toast.show({ content: '宝贝和小宠昵称已保存' }); onSaved();
    } catch (failure) { setError(failure instanceof Error ? failure.message : '暂时无法保存，请稍后重试'); }
    finally { running.current = false; setPending(false); }
  };
  return <Popup visible onMaskClick={() => !pending && onClose()} bodyStyle={{ borderRadius: '20px 20px 0 0' }}>
    <form className="p-5 pb-8 space-y-4 max-w-xl mx-auto" onSubmit={save}>
      <h2 className="text-lg font-bold">编辑宝贝与小宠</h2>
      <label className="block text-sm">宝贝昵称<input className="kid-input mt-2" required maxLength={50} disabled={pending} value={nickname} onChange={event => setNickname(event.target.value)} /></label>
      <label className="block text-sm">宠物昵称<input className="kid-input mt-2" required maxLength={50} disabled={pending} value={petName} onChange={event => setPetName(event.target.value)} /></label>
      <p className="text-xs leading-6 text-[#77786F]">修改昵称后，已有任务、金币和宠物照顾记录继续保留。</p>
      {error && <p role="alert" className="text-sm text-[#B45309]">{error}</p>}
      <div className="flex gap-3"><button type="button" className="kid-btn kid-btn-ghost flex-1" disabled={pending} onClick={onClose}>取消</button><button type="submit" className="kid-btn kid-btn-primary flex-1" disabled={pending || !nickname.trim() || !petName.trim()}>{pending ? '正在保存…' : '保存昵称'}</button></div>
    </form>
  </Popup>;
}
