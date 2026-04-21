import { type MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://psyhocourse.ru';

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/payment/', '/course/'],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
