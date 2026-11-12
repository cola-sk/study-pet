'use client';

import React, { useState } from 'react';
import { Popup, Toast, Selector, Input } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';
import { IconDevice } from '../../components/Icons';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const DevicePairModal: React.FC<Props> = ({ visible, onClose }) => {
  const { children, pairDevice } = useAppStore();
  const [code, setCode] = useState('');
  const [alias, setAlias] = useState('');
  const [selectedChildId, setSelectedChildId] = useState<string>(children[0]?.id || '');
  const [loading, setLoading] = useState(false);

  React.useEffect(() => {
    if (visible && children.length > 0 && !selectedChildId) {
      setSelectedChildId(children[0].id);
    }
  }, [visible, children, selectedChildId]);

  const handlePair = async () => {
    if (code.length !== 6) {
      Toast.show({ icon: 'fail', content: '请输入桌面屏幕上的 6 位数字配对码' });
      return;
    }

    if (!selectedChildId) {
      Toast.show({ icon: 'fail', content: '请选择该设备归属的成员' });
      return;
    }

    const targetChild = children.find(c => c.id === selectedChildId);
    const finalAlias = alias.trim() || `${targetChild?.nickname || '孩子'}的桌面设备`;

    setLoading(true);
    const res = await pairDevice(code, finalAlias, selectedChildId);
    setLoading(false);

    if (res.success) {
      Toast.show({ icon: 'success', content: res.message });
      setCode('');
      setAlias('');
      onClose();
    } else {
      Toast.show({ icon: 'fail', content: res.message });
    }
  };

  const childOptions = children.map(c => ({
    label: c.nickname,
    value: c.id,
  }));

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: '14px',
        borderTopRightRadius: '14px',
        padding: '20px 16px',
        background: '#F4F6F9',
      }}
    >
      <div className="flex flex-col text-slate-900">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 bg-indigo-600 text-white rounded-lg flex items-center justify-center shrink-0 shadow-xs">
            <IconDevice className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900">配对绑定 ESP32 桌面硬件终端</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              开启硬件屏幕查看 6 位动态配对码，并关联至指定成员
            </p>
          </div>
        </div>

        {/* 归属成员选择 */}
        <div className="card-surface w-full bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-card mb-3">
          <label className="text-xs font-bold text-slate-800 block mb-2">1. 指派归属成员：</label>
          <Selector
            options={childOptions}
            value={[selectedChildId]}
            onChange={v => v.length && setSelectedChildId(v[0])}
            columns={2}
          />
        </div>

        {/* 6 位配对码输入 */}
        <div className="card-surface w-full bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-card mb-3">
          <label className="text-xs font-bold text-slate-800 block mb-2">
            2. 输入终端 6 位数字配对码：
          </label>
          <Input
            value={code}
            onChange={val => {
              const clean = val.replace(/\D/g, '').slice(0, 6);
              setCode(clean);
            }}
            placeholder="例如 829103"
            className="text-center font-mono tracking-widest !text-xl font-bold !h-11 !border !border-slate-300 !bg-slate-50 rounded-lg text-slate-900"
            type="number"
          />
          <span className="text-[11px] text-slate-400 block mt-1.5">终端联网后屏幕将自动显示 6 位配对码</span>
        </div>

        {/* 备注名称 */}
        <div className="card-surface w-full bg-white p-3.5 rounded-xl border border-slate-200/90 shadow-card mb-4">
          <label className="text-xs font-bold text-slate-800 block mb-1.5">3. 终端备注名称（选填）：</label>
          <Input
            value={alias}
            onChange={setAlias}
            placeholder="例如：大宝书桌终端"
            className="!text-xs border border-slate-200 bg-slate-50 px-2.5 py-1.5 rounded-lg text-slate-900"
          />
        </div>

        {/* 操作按钮 */}
        <div className="w-full flex items-center gap-2.5 select-none">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-xs font-semibold text-slate-700 transition-colors"
          >
            取消
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handlePair}
            className="flex-[2] py-2.5 rounded-lg font-semibold text-xs bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] text-white shadow-xs transition-all disabled:opacity-50"
          >
            {loading ? '配对连接中...' : '确认并绑定终端'}
          </button>
        </div>
      </div>
    </Popup>
  );
};
