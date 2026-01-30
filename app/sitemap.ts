import { MetadataRoute } from 'next';
import { createClient } from '@supabase/supabase-js';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // 모든 글 ID 가져오기
  const { data: posts } = await supabase
    .from('memos')
    .select('id, updated_at')
    .eq('is_draft', false)
    .is('deleted_at', null);

  // ⚠️ 나중에 도메인 사면 여기 수정! (지금은 Vercel 기본 주소 쓰자)
  // 주소가 없으면 일단 빈 문자열로 두거나, 배포 후 생성된 주소를 넣어야 함
  const baseUrl = 'https://insight-x-blog.vercel.app'; 

  const postUrls = (posts || []).map((post) => ({
    url: `${baseUrl}/post/${post.id}`,
    lastModified: new Date(post.updated_at),
    priority: 0.8,
  }));

  return [
    { url: baseUrl, lastModified: new Date(), priority: 1 },
    { url: `${baseUrl}/nexus`, lastModified: new Date(), priority: 0.5 },
    ...postUrls,
  ];
}