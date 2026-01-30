import { MetadataRoute } from 'next';

export default function robots(): MetadataRoute.Robots {
  const baseUrl = 'https://insight-x-blog.vercel.app'; // ⚠️ 나중에 도메인 사면 여기만 바꾸면 됨

  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin', '/private'], // 관리자 페이지 접근 금지
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}