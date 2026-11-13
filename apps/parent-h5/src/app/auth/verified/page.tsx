import type { Metadata } from 'next';
import { EmailVerification } from '../../../components/EmailVerification';
export const metadata: Metadata = {
  title: '邮箱验证 - 哈小伴',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function VerifiedPage() { return <EmailVerification />; }
