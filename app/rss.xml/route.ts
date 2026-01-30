import { createClient } from '@supabase/supabase-js';
import RSS from 'rss';

export async function GET() {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const { data: posts } = await supabase
    .from('memos')
    .select('*')
    .eq('is_draft', false)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  const feed = new RSS({
    title: 'AooW_X',
    description: '대한민국 정치 소설과 개발 로그',
    site_url: 'https://insight-x-blog.vercel.app', // ⚠️ 도메인 생기면 수정
    feed_url: 'https://insight-x-blog.vercel.app/rss.xml',
    language: 'ko',
    pubDate: new Date(),
  });

  posts?.forEach((post) => {
    feed.item({
      title: post.title,
      description: post.content.slice(0, 150) + '...',
      url: `https://insight-x-blog.vercel.app/post/${post.id}`,
      date: new Date(post.created_at),
      author: 'Admin',
    });
  });

  return new Response(feed.xml({ indent: true }), {
    headers: {
      'Content-Type': 'application/xml',
    },
  });
}