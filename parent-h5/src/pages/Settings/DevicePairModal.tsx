import React, { useState } from 'react';
import { Popup, Button, Toast } from 'antd-mobile';
import { useAppStore } from '../../stores/useAppStore';

interface Props {
  visible: boolean;
  onClose: () => void;
}

export const DevicePairModal: React.FC<Props> = ({ visible, onClose }) => {
  const { pairDevice } = useAppStore();
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePair = async () => {
    if (code.length !== 6) {
      Toast.show({ icon: 'fail', content: '请输入微雪屏幕上的 6 位数字配对码' });
      return;
    }

    setLoading(true);
    const res = await pairDevice(code);
    setLoading(false);

    if (res.success) {
      Toast.show({ icon: 'success', content: res.message });
      setCode('');
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
        borderTopLeftRadius: '20px',
        borderTopRightRadius: '20px',
        padding: '24px 20px',
        background: '#ffffff',
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center text-3xl mb-3 shadow-inner">
          📺
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">绑定微雪 ESP32 硬件设备</h3>
        <p className="text-xs text-gray-400 mb-6 max-w-xs">
          请开启微雪 ESP32-S3-Touch-LCD-2.8 屏幕，进入设置菜单查看当前的 6 位动态配对码。
        </p>

        {/* 6 位验证码输入框 */}
        <div className="w-full mb-6">
          <input
            type="text"
            pattern="[0-9]*"
            maxLength={6}
            value={code}
            onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
            placeholder="输入 6 位配对码"
            className="w-full text-center tracking-[12px] text-2xl font-mono font-bold py-3 bg-slate-50 border-2 border-blue-200 rounded-2xl focus:border-blue-600 focus:bg-white focus:outline-none transition-all"
            autoFocus
          />
          <div className="text-[11px] text-gray-400 mt-2">配对码有效时间为 5 分钟，一次性使用</div>
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
            立即绑定设备
          </Button>
          <Button block fill="none" size="middle" onClick={onClose} className="!text-gray-400">
            取消
          </Button>
        </div>
      </div>
    </Popup>
  );
};
