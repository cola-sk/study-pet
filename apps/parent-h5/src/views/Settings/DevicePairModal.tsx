'use client';

import React, { useState } from 'react';
import { Popup, Button, Toast, Selector, Input } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';

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
      Toast.show({ icon: 'fail', content: '请选择该设备归属的孩子' });
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
    label: `${c.avatarIcon || '🧒'} ${c.nickname}`,
    value: c.id,
  }));

  return (
    <Popup
      visible={visible}
      onMaskClick={onClose}
      position="bottom"
      bodyStyle={{
        borderTopLeftRadius: '24px',
        borderTopRightRadius: '24px',
        padding: '24px 20px',
        background: '#F7F5F0',
      }}
    >
      <div className="flex flex-col items-center text-center text-[#2D2621]">
        <div className="w-14 h-14 bg-[#FEF8ED] border border-[#FCE7C2] text-[#D96B43] rounded-2xl flex items-center justify-center text-3xl mb-2.5 shadow-xs">
          📺
        </div>
        <h3 className="text-lg font-bold text-[#2D2621] mb-1">绑定桌面伴学设备</h3>
        <p className="text-xs text-[#7D7267] mb-4 max-w-xs">
          请开启桌面屏幕进入设置查看 6 位动态配对码，并指派给对应孩子。
        </p>

        {/* 归属孩子选择 */}
        <div className="w-full text-left mb-4 bg-white p-3.5 rounded-2xl border border-[#EAE5DC]">
          <label className="text-xs font-semibold text-[#2D2621] block mb-2">指派归属孩子：</label>
          <Selector
            options={childOptions}
            value={[selectedChildId]}
            onChange={v => v.length && setSelectedChildId(v[0])}
            columns={2}
          />
        </div>

        {/* 6 位配对码输入 */}
        <div className="w-full bg-white p-4 rounded-2xl border border-[#EAE5DC] mb-4">
          <label className="text-xs font-semibold text-[#2D2621] block mb-2 text-left">
            屏幕 6 位数字配对码：
          </label>
          <div className="flex justify-center mb-1">
            <Input
              value={code}
              onChange={val => {
                const clean = val.replace(/\D/g, '').slice(0, 6);
                setCode(clean);
              }}
              placeholder="例如 829103"
              className="text-center font-mono tracking-widest !text-2xl font-bold !h-12 !border-2 !border-[#EAE5DC] !bg-[#F7F5F0] rounded-xl text-[#2D2621]"
              type="number"
            />
          </div>
          <span className="text-[11px] text-[#A89F95]">设备端启动联网后屏幕会自动展示该配对码</span>
        </div>

        {/* 备注名称 */}
        <div className="w-full text-left mb-5 bg-white p-3.5 rounded-2xl border border-[#EAE5DC]">
          <label className="text-xs font-semibold text-[#2D2621] block mb-1">设备备注名称（选填）：</label>
          <Input
            value={alias}
            onChange={setAlias}
            placeholder="例如：大宝书桌上的微雪屏"
            className="!text-xs border-b border-[#EAE5DC] pb-1 text-[#2D2621]"
          />
        </div>

        {/* 操作按钮 */}
        <div className="w-full space-y-2">
          <Button
            block
            loading={loading}
            onClick={handlePair}
            className="!rounded-full font-bold !bg-[#D96B43] hover:!bg-[#C75B34] !text-white !border-0 !py-2.5 shadow-sm"
          >
            确认并完成配对绑定
          </Button>
          <button
            onClick={onClose}
            className="text-xs text-[#7D7267] hover:text-[#2D2621] py-1.5"
          >
            稍后配对
          </button>
        </div>
      </div>
    </Popup>
  );
};
