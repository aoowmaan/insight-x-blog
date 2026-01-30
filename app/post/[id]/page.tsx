'use client'

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function FullPostDetailFixedLayout() {
  const { id } = useParams();
  const router = useRouter();
  
  // 🔐 권한 및 설정
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // 📄 데이터 상태
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]); 
  const [newComment, setNewComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // 👥 [NEW] 등장인물 관련 상태
  const [relatedChars, setRelatedChars] = useState<any[]>([]);
  const [showCharSidebar, setShowCharSidebar] = useState(false);

  // ✨ 추가 기능 상태
  const [nickname, setNickname] = useState('');
  const [prevPost, setPrevPost] = useState<any>(null);
  const [nextPost, setNextPost] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [showTopBtn, setShowTopBtn] = useState(false);
  
  // 📊 독서 진행률 상태
  const [readingProgress, setReadingProgress] = useState(0);

  // 🔢 카운터
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);

  // 🎛️ UI 모드
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  // ✏️ 수정용 상태
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editImage, setEditImage] = useState<File | null>(null);

  const viewCounted = useRef(false);
  const likeClicked = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedTheme = localStorage.getItem('blog_theme');
    if (savedTheme === 'dark') setIsDark(true);
    
    const savedNick = localStorage.getItem('comment_nickname');
    if (savedNick) setNickname(savedNick);

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdmin(!!session);
    };
    checkAuth();

    const fetchCategories = async () => {
      const { data } = await supabase.from('categories').select('*');
      if (data) setCategories(data);
    };
    fetchCategories();

    const handleScroll = () => {
      if (window.scrollY > 300) setShowTopBtn(true);
      else setShowTopBtn(false);

      const totalHeight = document.body.scrollHeight - window.innerHeight;
      if (totalHeight > 0) {
        const progress = (window.scrollY / totalHeight) * 100;
        setReadingProgress(Math.min(100, Math.max(0, progress)));
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (id) {
      fetchPostAndComments();
      incrementViewCount();
    }
  }, [id]);

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const fetchPostAndComments = async () => {
    try {
      if (!id) return;

      const { data: postData, error: postError } = await supabase.from('memos').select('*').eq('id', id).single();

      if (postError || !postData) {
        setErrorMsg("글을 불러올 수 없습니다.");
        return;
      }

      setPost(postData);
      setViews(postData.views || 0);
      setLikes(postData.likes || 0);
      
      setEditTitle(postData.title);
      setEditContent(postData.content);
      setEditCategory(postData.category_name);

      // 👥 [NEW] 이 소설(시리즈)에 등장하는 인물 가져오기
      if (postData.series_name) {
        const { data: charData } = await supabase
          .from('characters')
          .select('*')
          .eq('series', postData.series_name);
        
        if (charData) setRelatedChars(charData);
      }

      const { data: commentData } = await supabase.from('comments').select('*').eq('memo_id', id).order('created_at', { ascending: false });
      setComments(commentData || []);

      if (postData.series_name) {
        const { data: seriesPosts } = await supabase.from('memos')
          .select('id, title, series_order')
          .eq('series_name', postData.series_name)
          .eq('is_draft', false)
          .is('deleted_at', null)
          .order('series_order', { ascending: true });

        if (seriesPosts) {
          const idx = seriesPosts.findIndex(item => item.id === Number(id));
          if (idx !== -1) {
            setPrevPost(idx > 0 ? seriesPosts[idx - 1] : null); 
            setNextPost(idx < seriesPosts.length - 1 ? seriesPosts[idx + 1] : null); 
          }
        }
      } else {
        const { data: categoryPosts } = await supabase.from('memos')
          .select('id, title')
          .eq('category_name', postData.category_name)
          .eq('is_draft', false)
          .is('deleted_at', null)
          .order('created_at', { ascending: false });

        if (categoryPosts) {
          const idx = categoryPosts.findIndex(item => item.id === Number(id));
          if (idx !== -1) {
            setNextPost(idx > 0 ? categoryPosts[idx - 1] : null); 
            setPrevPost(idx < categoryPosts.length - 1 ? categoryPosts[idx + 1] : null); 
          }
        }
      }
    } catch (e: any) {
      setErrorMsg(`오류가 발생했습니다: ${e.message}`);
    }
  };

  const incrementViewCount = async () => {
    if (!viewCounted.current) {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.rpc('increment_view', { row_id: id });
        setViews((prev) => prev + 1);
      }
      viewCounted.current = true;
    }
  };

  const handleLike = async () => {
    if (likeClicked.current) return showToast("이미 좋아요를 눌렀습니다! ❤️");
    setLikes(prev => prev + 1);
    likeClicked.current = true;
    await supabase.from('memos').update({ likes: likes + 1 }).eq('id', id);
    showToast("이 글을 추천했습니다! 👍");
  };

  const handleShare = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      showToast("링크가 복사되었습니다! 🔗");
    } catch (e) { showToast("복사 실패"); }
  };

  const handleUpdate = async () => {
    if (!isAdmin) return;
    if (!confirm("수정사항을 저장하시겠습니까?")) return;

    let finalImageUrl = post.image_url;

    if (editImage) {
      const fileName = `${Date.now()}_edit_img`;
      const { data } = await supabase.storage.from('blog_images').upload(fileName, editImage);
      if (data) {
        const { data: publicUrl } = supabase.storage.from('blog_images').getPublicUrl(fileName);
        finalImageUrl = publicUrl.publicUrl;
      }
    }

    const { error } = await supabase.from('memos').update({
      title: editTitle,
      content: editContent,
      category_name: editCategory,
      image_url: finalImageUrl,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      showToast("수정 실패: " + error.message);
    } else {
      showToast("수정 완료!");
      setEditImage(null);
      setIsEditing(false);
      fetchPostAndComments();
    }
  };

  const handleDelete = async () => {
    if (!isAdmin) return;
    if (!confirm("이 글을 휴지통으로 이동하시겠습니까?")) return;
    
    await supabase.from('memos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
    router.push('/');
  };

  const handleSubmitComment = async () => {
    if (!newComment.trim()) return showToast("내용을 입력해주세요.");
    setLoading(true);
    
    const finalNickname = nickname.trim() || "익명";
    localStorage.setItem('comment_nickname', finalNickname);

    try {
      const postId = Number(id);
      const { error } = await supabase
        .from('comments')
        .insert([{ 
          memo_id: postId, 
          content: newComment.trim(),
          nickname: finalNickname 
        }]);

      if (error) throw error;
      showToast("댓글이 등록되었습니다. 💬");
      setNewComment('');
      await fetchPostAndComments(); 
    } catch (e: any) {
      showToast("등록 실패. (관리자 문의 필요)");
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-mono"><h1 className="text-3xl font-bold text-red-500 mb-4">ERROR</h1><p>{errorMsg}</p><button onClick={() => router.push('/')} className="mt-8 bg-white text-black px-6 py-3 rounded-full font-bold">홈으로 돌아가기</button></div>;
  if (!post) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-black"><div className="animate-spin text-4xl mb-4">⏳</div><p>데이터 로딩 중...</p></div>;

  const themeBg = isDark ? 'bg-[#111]' : 'bg-white';
  const themeText = isDark ? 'text-white' : 'text-black';
  const navBg = isDark ? 'bg-black/80 border-[#333]' : 'bg-white/80 border-gray-100';
  const inputBg = isDark ? 'bg-[#222] text-white' : 'bg-white text-black';
  const cardBg = isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-100';

  return (
    <div 
      onContextMenu={(e) => !isAdmin && e.preventDefault()} 
      className={`min-h-screen font-sans selection:bg-indigo-600 selection:text-white transition-colors duration-300 ${!isAdmin ? 'select-none' : ''} ${themeBg} ${themeText}`}
    >
      
      {/* 📊 독서 진행률 바 */}
      <div className="fixed top-0 left-0 h-1 bg-indigo-600 z-[200] transition-all duration-300 ease-out" style={{ width: `${readingProgress}%` }} />

      {/* 🍞 토스트 알림 */}
      <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-300 pointer-events-none flex items-center gap-2 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <span>🔔</span> <span className="text-xs font-bold">{toast.msg}</span>
      </div>

      {/* 1. 상단 네비게이션 */}
      {!isFocusMode && (
        <nav className={`fixed top-0 w-full backdrop-blur-md border-b z-40 px-6 py-4 flex justify-between items-center transition-all ${navBg}`}>
          <button onClick={() => router.push('/')} className="text-xs font-black hover:text-indigo-600 transition-colors flex items-center gap-1">
            <span>←</span> 목록으로
          </button>
          
          <div className="flex items-center gap-4">
            <button onClick={handleShare} className="text-lg hover:scale-110 transition-transform" title="링크 복사">🔗</button>
            <button onClick={() => { setIsDark(!isDark); localStorage.setItem('blog_theme', !isDark ? 'dark' : 'light'); }} className="text-lg">
              {isDark ? '☀️' : '🌙'}
            </button>
            {isAdmin && (
              <div className="flex gap-2">
                <button onClick={() => setIsEditing(true)} className="text-[10px] font-black text-indigo-600 hover:bg-indigo-50 px-3 py-1 rounded-full transition-colors">✏️ 수정</button>
                <button onClick={handleDelete} className="text-[10px] font-black text-red-500 hover:bg-red-50 px-3 py-1 rounded-full transition-colors">🗑️ 삭제</button>
              </div>
            )}
          </div>
        </nav>
      )}

      {/* 🟢 2. 우측 하단 플로팅 버튼 (기능 버튼들) */}
      <div className="fixed bottom-8 right-6 md:bottom-12 md:right-12 z-50 flex flex-col items-end gap-3">
        
        {/* 👥 등장인물 버튼 (시리즈 글이면 무조건 보임) */}
        {post.series_name && !isFocusMode && (
          <button 
            onClick={() => setShowCharSidebar(true)}
            className="h-10 px-4 md:h-12 md:px-5 bg-red-600 text-white rounded-full shadow-2xl font-black text-xs hover:scale-105 transition-all flex items-center justify-center gap-2 animate-in fade-in slide-in-from-right-10"
          >
            <span className="text-lg">👥</span>
            <span className="hidden md:inline">인물 파일</span>
          </button>
        )}

        {/* ⬆️ Top 버튼 */}
        {showTopBtn && (
          <button 
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="w-10 h-10 md:w-12 md:h-12 bg-white text-black border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-100 transition-all"
          >
            ⬆️
          </button>
        )}

        {/* 📖 읽기 모드 버튼 */}
        <button 
          onClick={() => setIsFocusMode(!isFocusMode)}
          className={`flex items-center gap-2 px-6 py-4 rounded-full shadow-2xl transition-all duration-300 font-black text-xs hover:scale-105 active:scale-95 ${
            isFocusMode 
              ? 'bg-gray-100 text-black border border-gray-300' 
              : `text-white hover:bg-indigo-600 ${isDark ? 'bg-[#333] border border-gray-600' : 'bg-black'}`
          }`}
        >
          {isFocusMode ? (
            <><span>✕</span> <span>모드 해제</span></>
          ) : (
            <><span>📖</span> <span>읽기 모드</span></>
          )}
        </button>
      </div>

      {/* 🔵 3. 좌측 하단 네비게이터 (이전글/다음글 - 겹침 방지를 위해 왼쪽으로 이동) */}
      {(prevPost || nextPost) && !isFocusMode && (
        <div className="fixed bottom-8 left-6 md:bottom-12 md:left-12 z-40 flex flex-col gap-2 items-start">
          {prevPost && (
            <button onClick={() => router.push(`/post/${prevPost.id}`)} className="group flex items-center gap-2 bg-gray-200 text-gray-600 px-4 py-3 rounded-full shadow-xl hover:scale-105 transition-all">
              <span className="text-xs font-black">◀ 이전화</span>
              <span className="hidden group-hover:block text-[10px] font-bold max-w-[100px] truncate">{prevPost.title}</span>
            </button>
          )}
          {nextPost && (
            <button onClick={() => router.push(`/post/${nextPost.id}`)} className="group flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-xl hover:scale-105 transition-all">
              <span className="text-xs font-black">다음화 ▶</span>
              <span className="hidden group-hover:block text-[10px] font-bold max-w-[100px] truncate">{nextPost.title}</span>
            </button>
          )}
        </div>
      )}

      {/* 3. 메인 콘텐츠 */}
      <main className={`max-w-3xl mx-auto px-6 ${isFocusMode ? 'pt-20 pb-20' : 'pt-32 pb-40'} animate-in fade-in slide-in-from-bottom-4 duration-700`}>
        {/* 헤더 */}
        <div className="text-center mb-16">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-4 inline-block">{post.category_name}</span>
          <h1 className={`text-4xl md:text-6xl font-black italic tracking-tighter mb-6 leading-tight break-keep ${themeText}`}>"{post.title}"</h1>
          
          {post.series_name && (
            <div className="mb-6 inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
               📚 {post.series_name} 제{post.series_order}화
            </div>
          )}

          <div className="flex justify-center items-center gap-4 text-[10px] font-bold text-gray-400 uppercase tracking-widest">
            <span>{new Date(post.created_at).toLocaleDateString()}</span>
            <span>•</span>
            <span className="flex items-center gap-1">👁️ {views}</span>
            <span>•</span>
            <button onClick={handleLike} className={`flex items-center gap-1 hover:text-red-500 transition-colors ${likes > 0 ? 'text-red-500' : ''}`}>
              ❤️ {likes}
            </button>
          </div>
        </div>

        {/* 이미지 */}
        {post.image_url && (
          <div className={`rounded-[2.5rem] overflow-hidden shadow-2xl mb-16 border group ${isDark ? 'border-[#333]' : 'border-gray-100'}`}>
            <img src={post.image_url} alt="Cover" className="w-full object-cover transition-transform duration-700 group-hover:scale-105" />
          </div>
        )}

        {/* 본문 */}
        <div className={`prose prose-lg prose-indigo mx-auto font-medium leading-loose whitespace-pre-wrap mb-20 ${isDark ? 'prose-invert text-gray-300' : 'text-gray-800'}`}>
          {post.content}
        </div>

        {/* 하단 요소들 (좋아요, 댓글 등) */}
        {!isFocusMode && (
          <>
            <div className="flex justify-center mb-16">
              <button onClick={handleLike} className={`group flex items-center gap-3 px-8 py-4 rounded-full border transition-all hover:scale-105 active:scale-95 ${cardBg} hover:border-red-500/50`}>
                <span className="text-2xl group-hover:animate-bounce">❤️</span>
                <span className={`font-black text-sm group-hover:text-red-500 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>이 글이 재밌었다면 ({likes})</span>
              </button>
            </div>
             {/* 📚 시리즈 네비게이션 (본문 하단 고정) */}
             <div className="grid grid-cols-2 gap-4 mb-16">
              {prevPost ? (
                <div onClick={() => router.push(`/post/${prevPost.id}`)} className={`cursor-pointer p-6 rounded-3xl border transition-all hover:border-indigo-500 hover:shadow-lg ${cardBg}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">이전 글</span>
                  <p className={`font-bold text-sm line-clamp-1 mt-1 ${themeText}`}>{prevPost.title}</p>
                </div>
              ) : <div />}

              {nextPost ? (
                <div onClick={() => router.push(`/post/${nextPost.id}`)} className={`cursor-pointer p-6 rounded-3xl border transition-all hover:border-indigo-500 hover:shadow-lg text-right ${cardBg}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">다음 글</span>
                  <p className={`font-bold text-sm line-clamp-1 mt-1 ${themeText}`}>{nextPost.title}</p>
                </div>
              ) : <div />}
            </div>

            <hr className={`my-16 ${isDark ? 'border-[#333]' : 'border-gray-100'}`} />

            {/* 댓글 영역 */}
            <div className={`p-8 md:p-12 rounded-[2.5rem] border ${cardBg}`}>
              <h3 className="text-xl font-black italic mb-6">💬 댓글 ({comments.length})</h3>
              
              <input 
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
                className={`w-full mb-3 rounded-xl p-4 border-none outline-none font-bold text-sm ${inputBg} ${isDark ? 'placeholder:text-gray-600' : 'placeholder:text-gray-300'}`}
                placeholder="닉네임 (미입력시 익명)"
              />
              <textarea 
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                className={`w-full h-32 rounded-2xl p-6 border-none outline-none focus:ring-2 focus:ring-indigo-500 transition-all resize-none mb-4 font-bold text-sm ${inputBg} ${isDark ? 'placeholder:text-gray-600' : 'placeholder:text-gray-300'}`}
                placeholder="댓글을 남겨주세요."
              />
              <div className="flex justify-end">
                <button onClick={handleSubmitComment} disabled={loading} className="bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black text-xs uppercase hover:bg-indigo-500 transition-all shadow-lg">
                  {loading ? '...' : '등록'}
                </button>
              </div>
            </div>

            <div className="mt-16 space-y-6">
              {comments.length > 0 ? (
                comments.map(c => (
                  <div key={c.id} className={`flex gap-4 p-6 rounded-3xl transition-colors ${isDark ? 'hover:bg-[#1a1a1a]' : 'hover:bg-gray-50'}`}>
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-xs shrink-0 ${isDark ? 'bg-[#333] text-indigo-400' : 'bg-indigo-100 text-indigo-600'}`}>
                      {c.nickname ? c.nickname.slice(0, 1) : '익'}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[11px] font-black ${isDark ? 'text-gray-300' : 'text-gray-800'}`}>{c.nickname || '익명'}</span>
                        <span className="text-[9px] text-gray-500">• {new Date(c.created_at).toLocaleDateString()}</span>
                        {isAdmin && <button onClick={async () => { if(confirm('삭제?')) { await supabase.from('comments').delete().eq('id', c.id); fetchPostAndComments(); }}} className="text-[8px] text-red-400 ml-2">삭제</button>}
                      </div>
                      <p className={`text-sm font-bold leading-relaxed ${isDark ? 'text-gray-300' : 'text-gray-700'}`}>{c.content}</p>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-10 text-gray-400 text-sm font-bold opacity-50">
                  아직 작성된 댓글이 없습니다.
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* 👥 [NEW] 등장인물 사이드바 (슬라이드 모달) */}
      <div 
        className={`fixed inset-0 z-[100] bg-black/50 transition-opacity duration-300 ${showCharSidebar ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setShowCharSidebar(false)}
      >
        <div 
          className={`absolute right-0 top-0 h-full w-full md:w-[400px] bg-[#111] border-l border-gray-800 p-6 shadow-2xl transition-transform duration-300 transform overflow-y-auto ${showCharSidebar ? 'translate-x-0' : 'translate-x-full'}`}
          onClick={e => e.stopPropagation()}
        >
          <div className="flex justify-between items-center mb-8">
            <h3 className="text-xl font-black italic text-white uppercase tracking-tighter">👥 기밀 인물 파일</h3>
            <button onClick={() => setShowCharSidebar(false)} className="text-2xl text-gray-500 hover:text-white">✕</button>
          </div>

          <div className="mb-6 p-4 bg-gray-900/50 rounded-xl border border-gray-800 text-center">
             <span className="text-[10px] text-gray-400 block mb-1">TARGET SERIES</span>
             <span className="text-sm font-bold text-indigo-400">"{post.series_name}"</span>
          </div>

          <div className="space-y-6">
            {relatedChars.map(char => (
              <div key={char.id} className="bg-[#1a1a1a] border border-gray-800 p-4 rounded-xl hover:border-red-600/50 transition-colors">
                <div className="flex items-start gap-4 mb-4">
                  <div className="w-16 h-16 bg-gray-900 rounded-lg overflow-hidden shrink-0">
                    {char.image_url ? <img src={char.image_url} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-2xl">👤</div>}
                  </div>
                  <div>
                    <h4 className="text-lg font-black text-white">{char.name}</h4>
                    <p className="text-xs font-bold text-red-500 uppercase">{char.role}</p>
                    <div className="mt-2 text-[10px] space-y-1 text-gray-400">
                      {char.stats && Object.entries(char.stats).map(([k, v]: any) => (
                        <span key={k} className="mr-2 uppercase font-bold">{k}: {v}</span>
                      ))}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-gray-400 leading-relaxed mb-3">{char.description}</p>
                {char.secret && (
                   <div className="p-2 bg-red-900/10 border border-red-900/20 rounded text-[10px] text-red-400/50 cursor-help hover:text-red-300 transition-colors select-none">
                     ⚠️ 기밀: {char.secret}
                   </div>
                )}
              </div>
            ))}
            {relatedChars.length === 0 && (
              <div className="text-center py-10 border border-dashed border-gray-800 rounded-xl">
                <p className="text-gray-500 text-xs mb-2">등록된 인물이 없습니다.</p>
                <p className="text-[10px] text-gray-600">
                  (인물 페이지에서 시리즈 이름을<br/>
                  <span className="text-indigo-400">"{post.series_name}"</span>(으)로 등록하세요)
                </p>
              </div>
            )}
          </div>
          
          <button 
            onClick={() => router.push('/characters')} 
            className="w-full mt-6 py-4 border border-gray-700 rounded-xl text-xs font-black text-gray-400 hover:bg-white hover:text-black transition-all uppercase"
          >
            전체 인물 열람실 이동 →
          </button>
        </div>
      </div>

      {/* ✏️ 수정 모달 */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className={`w-full max-w-4xl h-[90vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-[#222] text-white' : 'bg-white text-black'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
              <h3 className="font-black italic text-xl">📝 원고 수정</h3>
              <button onClick={() => setIsEditing(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6">
              <div className="space-y-2">
                 <label className="text-xs font-black text-gray-500 uppercase tracking-widest">카테고리 변경</label>
                 <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                    {categories.map(c => (
                      <button 
                        key={c.id} 
                        onClick={() => setEditCategory(c.name)}
                        className={`px-4 py-2 rounded-full text-xs font-black border transition-all whitespace-nowrap ${
                          editCategory === c.name 
                            ? 'bg-indigo-600 text-white border-indigo-600' 
                            : 'border-gray-300 text-gray-400 hover:border-indigo-600 hover:text-indigo-600'
                        }`}
                      >
                        {c.name}
                      </button>
                    ))}
                 </div>
              </div>
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`text-3xl font-black border-b pb-2 outline-none transition-colors ${isDark ? 'bg-transparent border-[#444] focus:border-white' : 'border-gray-200 focus:border-black'}`} placeholder="제목" />
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`flex-1 text-lg font-medium resize-none outline-none leading-loose bg-transparent min-h-[300px]`} placeholder="내용" />
              <div className="space-y-2 pt-4 border-t border-gray-500/20">
                 <label className="text-xs font-black text-gray-500 uppercase tracking-widest">대표 이미지 교체</label>
                 <input type="file" onChange={(e) => setEditImage(e.target.files?.[0] || null)} className="block w-full text-xs text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100"/>
              </div>
            </div>
            <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50'}`}>
              <button onClick={() => setIsEditing(false)} className={`px-6 py-3 rounded-xl font-bold transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333]' : 'text-gray-500 hover:bg-gray-200'}`}>취소</button>
              <button onClick={handleUpdate} className="px-8 py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg">저장하기</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}