'use client';

import React, { useState } from 'react';
import { Popup, Toast } from 'antd-mobile';
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
      Toast.show({ icon: 'fail', content: '请输入设备屏幕上的 6 位数字配对码哦！' });
      return;
    }

    if (!selectedChildId) {
      Toast.show({ icon: 'fail', content: '请选择这台设备属于哪位宝贝！' });
      return;
    }

    const targetChild = children.find(c => c.id === selectedChildId);
    const finalAlias = alias.trim() || `${targetChild?.nickname || '宝贝'}的桌面设备`;

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

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: '28px',
        borderTopRightRadius: '28px',
        padding: '24px',
        background: '#FFFFFF',
      }}
    >
      <div className="flex flex-col text-[#1F2937] space-y-6">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-[#EF4444] text-white rounded-full flex items-center justify-center shrink-0 shadow-[0_4px_0_#B91C1C]">
            <IconDevice className="w-7 h-7" />
          </div>
          <div>
            <h3 className="text-h3 text-[#1F2937]">连接新的桌面伙伴设备</h3>
            <p className="text-caption text-[#6B7280] mt-0.5">
              打开微雪硬件屏幕查看 6 位数字配对码
            </p>
          </div>
        </div>

        {/* 1. 选择归属宝贝 (KidLearn Radio Buttons 28px) */}
        <div className="kid-card space-y-3">
          <div className="text-caption text-[#1F2937]">1. 这台设备属于哪位宝贝？</div>
          <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="选择宝贝">
            {children.map(child => {
              const selected = selectedChildId === child.id;
              return (
                <button
                  key={child.id}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setSelectedChildId(child.id)}
                  className="min-h-[48px] p-3 rounded-[20px] bg-white border-2 border-[#E5E7EB] flex items-center gap-3 text-left"
                >
                  <span
                    className={`w-[28px] h-[28px] rounded-full flex items-center justify-center border-2 shrink-0 ${
                      selected ? 'border-[#EF4444] bg-white' : 'border-[#9CA3AF] bg-white'
                    }`}
                  >
                    {selected && <span className="w-[14px] h-[14px] rounded-full bg-[#EF4444]" />}
                  </span>
                  <span className="text-body font-bold text-[#1F2937] truncate">
                    {child.nickname}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. 6 位配对码输入 */}
        <div className="kid-card space-y-2">
          <label htmlFor="pair-code-input" className="text-caption text-[#1F2937] block">
            2. 输入屏幕上的 6 位数字配对码：
          </label>
          <input
            id="pair-code-input"
            type="text"
            inputMode="numeric"
            value={code}
            onChange={e => {
              const clean = e.target.value.replace(/\D/g, '').slice(0, 6);
              setCode(clean);
            }}
            placeholder="例如 829103"
            className="kid-input text-center font-mono !text-[24px] font-bold tracking-widest"
          />
        </div>

        {/* 3. 设备名称 */}
        <div className="kid-card space-y-2">
          <label htmlFor="device-alias-input" className="text-caption text-[#1F2937] block">
            3. 给设备起个名字（选填）：
          </label>
          <input
            id="device-alias-input"
            type="text"
            value={alias}
            onChange={e => setAlias(e.target.value)}
            placeholder="例如：大宝书桌的小宠屏幕"
            className="kid-input"
          />
        </div>

        {/* 操作按钮 */}
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 kid-btn kid-btn-ghost kid-btn-lg"
          >
            稍后再连
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handlePair}
            className="flex-[2] kid-btn kid-btn-primary kid-btn-lg"
          >
            {loading ? '正在连接...' : '确认连接设备！'}
          </button>
        </div>
      </div>
    </Popup>
  );
};
