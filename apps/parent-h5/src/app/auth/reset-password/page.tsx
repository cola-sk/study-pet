import type { Metadata } from 'next';
import { PasswordReset } from '../../../components/PasswordReset';
export const metadata: Metadata = { title: '重置密码 - 学习宠物助手', robots: { index: false, follow: false }, referrer: 'no-referrer' };
export default function ResetPasswordPage() { return <PasswordReset />; }
