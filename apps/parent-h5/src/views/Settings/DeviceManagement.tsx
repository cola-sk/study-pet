'use client';
import { useRef, useState } from 'react';
import { Popup, Toast } from 'antd-mobile';
import { familyApi, FamilyApiError, FamilyChild, FamilyDevice } from '../../services/familyApi';

type Props = { device: FamilyDevice; children: FamilyChild[]; onClose: () => void; onChanged: () => void };
export function DeviceManagement({ device, children, onClose, onChanged }: Props) {
  const [alias, setAlias] = useState(device.alias), [childId, setChildId] = useState(device.child_id || '');
  const [confirm, setConfirm] = useState<'assign' | 'unlink' | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState(''), [stale, setStale] = useState(false);
  const running = useRef(false);
  const child = children.find(item => item.id === childId);
  const save = async (action: 'rename' | 'assign' | 'unlink') => {
    if (running.current || stale) return;
    running.current = true; setPending(true); setError('');
    try {
      await familyApi(`/api/v1/devices/${device.id}${action === 'assign' ? '/child' : ''}`, {
        method: action === 'unlink' ? 'DELETE' : 'PATCH',
        body: JSON.stringify({ expectedVersion: device.updated_at, ...(action === 'rename' ? { alias: alias.trim() } : action === 'assign' ? { childId } : {}) }),
      });
      Toast.show({ content: action === 'rename' ? '设备名称已保存' : action === 'assign' ? '设备归属已更新' : '设备已解绑，历史记录已保留' });
      onChanged();
    } catch (failure) {
      setStale(failure instanceof FamilyApiError && [404, 409].includes(failure.status));
      setError(failure instanceof Error ? failure.message : '尚未确认操作结果，请刷新列表查看。');
    } finally { running.current = false; setPending(false); }
  };
  return <Popup visible onMaskClick={() => !pending && onClose()} bodyStyle={{ borderRadius: '20px 20px 0 0', maxHeight: '90vh', overflowY: 'auto' }}>
    <div className="p-5 pb-8 space-y-5 max-w-xl mx-auto">
      <div className="flex items-center justify-between gap-3"><h2 className="text-lg font-bold">管理设备</h2><button className="kid-btn kid-btn-ghost kid-btn-sm" type="button" disabled={pending} onClick={onClose}>关闭</button></div>
      <p className="text-xs text-[#77786F]">设备编号尾号 {device.id.slice(-6)}</p>
      {confirm ? <div className="space-y-4">
        <h3 className="font-semibold">{confirm === 'assign' ? `确认将设备交给 ${child?.nickname || '这个宝贝'}？` : '确认解除家庭绑定？'}</h3>
        <p className="text-sm leading-7 text-[#77786F]">{confirm === 'assign' ? '后续任务和消费会使用所选宝贝的账户。原宝贝的金币、任务和消费记录会保留。' : '设备将无法继续访问本家庭的数据。重新使用时，需要在设备 Settings → Device 输入家庭码，再选择宝贝。已有金币和历史记录会保留。'}</p>
        <div className="flex gap-3"><button type="button" className="kid-btn kid-btn-ghost flex-1" disabled={pending} onClick={() => { setConfirm(null); setError(''); }}>返回</button><button type="button" className="kid-btn kid-btn-primary flex-1" disabled={pending || stale} onClick={() => save(confirm)}>{pending ? '正在处理…' : confirm === 'assign' ? '确认更换' : '确认解绑'}</button></div>
      </div> : <>
        <form className="space-y-3" onSubmit={event => { event.preventDefault(); void save('rename'); }}>
          <label htmlFor="device-alias" className="block text-sm font-semibold">设备名称</label><input id="device-alias" className="kid-input" value={alias} maxLength={50} required disabled={pending || stale} onChange={event => setAlias(event.target.value)} />
          <button type="submit" className="kid-btn kid-btn-primary w-full" disabled={pending || stale || !alias.trim() || alias.trim() === device.alias}>保存名称</button>
        </form>
        <div className="space-y-3 border-t border-[#E5E7EB] pt-4"><label htmlFor="device-child" className="block text-sm font-semibold">归属宝贝</label>
          <select id="device-child" className="kid-input" value={childId} disabled={pending || stale} onChange={event => setChildId(event.target.value)}><option value="" disabled>请选择宝贝</option>{children.map(item => <option key={item.id} value={item.id}>{item.nickname}</option>)}</select>
          {!children.length && <p className="text-sm text-[#77786F]">请先到“宝贝与小宠”添加宝贝。</p>}
          <button type="button" className="kid-btn kid-btn-secondary w-full" disabled={pending || stale || !childId || childId === device.child_id} onClick={() => setConfirm('assign')}>{device.child_id ? '更换归属宝贝' : '绑定所选宝贝'}</button>
        </div>
        <div className="border-t border-[#E5E7EB] pt-4"><button type="button" className="kid-btn kid-btn-ghost w-full !text-[#B45339]" disabled={pending || stale} onClick={() => setConfirm('unlink')}>解除家庭绑定</button></div>
      </>}
      {error && <p className="text-sm text-[#B45309]" role="alert">{error}</p>}
      {stale && <button type="button" className="kid-btn kid-btn-ghost w-full" onClick={onChanged}>刷新并返回设备列表</button>}
    </div>
  </Popup>;
}
