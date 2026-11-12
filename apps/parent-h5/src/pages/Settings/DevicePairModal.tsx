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
      Toast.show({ icon: 'fail', content: '请输入微雪屏幕上的 6 位数字配对码' });
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
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        padding: '24px 20px',
        background: '#ffffff',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-14 h-14 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-2 shadow-inner">
          📺
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">绑定微雪 ESP32 硬件设备</h3>
        <p className="text-xs text-gray-400 mb-4 max-w-xs">
          请开启微雪屏幕进入设置查看 6 位动态配对码，并指派给对应孩子。
        </p>

        {/* 归属孩子选择 */}
        <div className="w-full text-left mb-4">
          <label className="text-xs font-bold text-gray-700 block mb-1.5">1. 选择该设备的主人（孩子）*</label>
          <Selector
            options={childOptions}
            value={[selectedChildId]}
            onChange={v => v.length && setSelectedChildId(v[0])}
            columns={2}
          />
        </div>

        {/* 设备名称设置 */}
        <div className="w-full text-left mb-4">
          <label className="text-xs font-bold text-gray-700 block mb-1.5">2. 给这台设备起个名字（选填）</label>
          <Input
            placeholder="例如：天天的书桌设备"
            value={alias}
            onChange={setAlias}
            className="!text-xs bg-slate-50 p-2.5 rounded-xl border border-slate-200"
          />
        </div>

        {/* 6 位验证码输入框 */}
        <div className="w-full mb-6 text-left">
          <label className="text-xs font-bold text-gray-700 block mb-1.5">3. 输入微雪屏幕上的 6 位配对码 *</label>
          <input
            type="text"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="6 位配对码"
            className="w-full text-center tracking-[10px] text-2xl font-mono font-bold py-2.5 bg-slate-50 border-2 border-blue-200 rounded-xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all"
          />
          <div className="text-[11px] text-gray-400 mt-1.5 text-center">配对码有效时间 5 分钟，绑定后设备将展示专属宠物</div>
        </div>

        <div className="w-full space-y-2">
          <Button
            block
            color="primary"
            size="large"
            loading={loading}
            onClick={handlePair}
            className="!rounded-xl font-bold shadow-sm"
          >
            确认绑定此设备
          </Button>
          <Button block fill="none" size="middle" onClick={onClose} className="!text-gray-400">
            取消
          </Button>
        </div>
      </div>
    </Popup>
  );
};
