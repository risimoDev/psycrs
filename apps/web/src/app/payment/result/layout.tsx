import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Результат оплаты',
  robots: { index: false, follow: false },
};

export default function PaymentResultLayout({ children }: { children: React.ReactNode }) {
  return children;
}
