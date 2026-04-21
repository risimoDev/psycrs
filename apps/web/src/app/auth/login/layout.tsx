import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Вход в аккаунт',
  description: 'Войдите в свой аккаунт PsyhoCourse для доступа к курсу.',
  robots: { index: false, follow: false },
};

export default function AuthLoginLayout({ children }: { children: React.ReactNode }) {
  return children;
}
