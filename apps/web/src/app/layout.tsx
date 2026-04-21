import type { Metadata, Viewport } from 'next';
import { Cormorant_Garamond, Jost } from 'next/font/google';
import { Providers } from '../components/providers';
import './globals.css';

const cormorant = Cormorant_Garamond({
  subsets: ['cyrillic', 'latin'],
  weight: ['400', '600', '700'],
  variable: '--font-heading',
  display: 'swap',
});

const jost = Jost({
  subsets: ['cyrillic', 'latin'],
  weight: ['300', '400', '500', '600'],
  variable: '--font-body',
  display: 'swap',
});

export const metadata: Metadata = {
  title: {
    default: 'PsyhoCourse | Онлайн-курс по психологии',
    template: '%s | PsyhoCourse',
  },
  description: 'Видеокурс по психологии от практикующего специалиста. Когнитивная психология, эмоциональный интеллект, практические навыки.',
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? 'https://psyhocourse.ru'),
  openGraph: {
    type: 'website',
    locale: 'ru_RU',
    siteName: 'PsyhoCourse',
    title: 'PsyhoCourse | Онлайн-курс по психологии',
    description: 'Видеокурс по психологии от практикующего специалиста.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'PsyhoCourse | Онлайн-курс по психологии',
    description: 'Видеокурс по психологии от практикующего специалиста.',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className={`dark ${cormorant.variable} ${jost.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('theme');if(t==='light'){document.documentElement.classList.remove('dark')}else if(!t&&!window.matchMedia('(prefers-color-scheme: dark)').matches){document.documentElement.classList.remove('dark')}}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
