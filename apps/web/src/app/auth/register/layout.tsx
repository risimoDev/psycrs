import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Регистрация',
  description: 'Создайте аккаунт PsyhoCourse и начните обучение.',
  robots: { index: false, follow: false },
};

export default function AuthRegisterLayout({ children }: { children: React.ReactNode }) {
  return children;
}
