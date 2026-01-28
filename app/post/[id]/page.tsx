'use client'

import React, { useEffect, useState, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useParams } from 'next/navigation';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function FullPostDetailFinalV7() {
  const { id } = useParams();
  const router = useRouter();
  
  // 🔐 권한 및 설정
  const [isAdmin, setIsAdmin] = useState(false);
  const [isDark, setIsDark] = useState(false);

  // 📄 데이터 상태
  const [post, setPost] = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  
  // ✨ 추가 기능 상태
  const [nickname, setNickname] = useState('');
  const [prevPost, setPrevPost] = useState<any>(null);
  const [nextPost, setNextPost] = useState<any>(null);
  const [toast, setToast] = useState({ show: false, msg: '' });
  const [showTopBtn, setShowTopBtn] = useState(false);
  
  // 📊 [NEW] 독서 진행률 상태
  const [readingProgress, setReadingProgress] = useState(0);

  // 🔢 카운터
  const [views, setViews] = useState(0);
  const [likes, setLikes] = useState(0);

  // 🎛️ UI 모드
  const [isFocusMode, setIsFocusMode] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');

  const viewCounted = useRef(false);
  const likeClicked = useRef(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    // 1. 설정 로드
    const savedTheme = localStorage.getItem('blog_theme');
    if (savedTheme === 'dark') setIsDark(true);
    
    const savedNick = localStorage.getItem('comment_nickname');
    if (savedNick) setNickname(savedNick);

    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setIsAdmin(!!session);
    };
    checkAuth();

    // 📜 스크롤 이벤트 (진행률 바 + 탑 버튼)
    const handleScroll = () => {
      // Top 버튼
      if (window.scrollY > 300) setShowTopBtn(true);
      else setShowTopBtn(false);

      // 독서 진행률 계산
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

      // 1. 본문 가져오기
      const { data: postData, error: postError } = await supabase.from('memos').select('*').eq('id', id).single();

      if (postError || !postData) {
        setErrorMsg("글을 불러올 수 없습니다. (삭제되었거나 존재하지 않음)");
        return;
      }

      setPost(postData);
      setViews(postData.views || 0);
      setLikes(postData.likes || 0);
      setEditTitle(postData.title);
      setEditContent(postData.content);

      // 2. 댓글 목록 가져오기
      const { data: commentData } = await supabase.from('comments').select('*').eq('memo_id', id).order('created_at', { ascending: false });
      setComments(commentData || []);

      // 3. 시리즈/카테고리 네비게이션 (삭제된 글 제외)
      if (postData.series_name) {
        // 시리즈 모드
        const { data: seriesPosts } = await supabase.from('memos')
          .select('id, title, series_order')
          .eq('series_name', postData.series_name)
          .eq('is_draft', false)
          .is('deleted_at', null) // 삭제된 글 건너뛰기
          .order('series_order', { ascending: true });

        if (seriesPosts) {
          const idx = seriesPosts.findIndex(item => item.id === Number(id));
          if (idx !== -1) {
            setPrevPost(idx > 0 ? seriesPosts[idx - 1] : null); 
            setNextPost(idx < seriesPosts.length - 1 ? seriesPosts[idx + 1] : null); 
          }
        }
      } else {
        // 일반 모드 (카테고리 최신순)
        const { data: categoryPosts } = await supabase.from('memos')
          .select('id, title')
          .eq('category_name', postData.category_name)
          .eq('is_draft', false)
          .is('deleted_at', null) // 삭제된 글 건너뛰기
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
      await supabase.rpc('increment_view', { row_id: id });
      setViews((prev) => prev + 1);
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
    if (!confirm("수정하시겠습니까?")) return;

    const { error } = await supabase.from('memos').update({
      title: editTitle,
      content: editContent,
      updated_at: new Date().toISOString()
    }).eq('id', id);

    if (error) {
      showToast("수정 실패: " + error.message);
    } else {
      showToast("수정 완료!");
      setIsEditing(false);
      fetchPostAndComments();
    }
  };

  // 🗑️ [변경] 휴지통으로 이동 (Soft Delete)
  const handleDelete = async () => {
    if (!isAdmin) return;
    if (!confirm("이 글을 휴지통으로 이동하시겠습니까?")) return;
    
    // deleted_at 타임스탬프만 찍음 (관리자 페이지 휴지통에서 확인 가능)
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
      await fetchPostAndComments(); // 댓글 목록 새로고침
      
    } catch (e: any) {
      showToast("등록 실패. (관리자 문의 필요)");
    } finally {
      setLoading(false);
    }
  };

  if (errorMsg) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-mono"><h1 className="text-3xl font-bold text-red-500 mb-4">ERROR</h1><p>{errorMsg}</p><button onClick={() => router.push('/')} className="mt-8 bg-white text-black px-6 py-3 rounded-full font-bold">홈으로 돌아가기</button></div>;
  if (!post) return <div className="min-h-screen bg-black text-white flex flex-col items-center justify-center font-black"><div className="animate-spin text-4xl mb-4">⏳</div><p>LOADING...</p></div>;

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
      
      {/* 📊 [NEW] 독서 진행률 바 */}
      <div className="fixed top-0 left-0 h-1 bg-indigo-600 z-[200] transition-all duration-300 ease-out" style={{ width: `${readingProgress}%` }} />

      {/* 🍞 토스트 알림 */}
      <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-300 pointer-events-none flex items-center gap-2 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <span>🔔</span> <span className="text-xs font-bold">{toast.msg}</span>
      </div>

      {/* 1. 상단 네비게이션 */}
      {!isFocusMode && (
        <nav className={`fixed top-0 w-full backdrop-blur-md border-b z-40 px-6 py-4 flex justify-between items-center transition-all ${navBg}`}>
          <button onClick={() => router.push('/')} className="text-xs font-black hover:text-indigo-600 transition-colors flex items-center gap-1">
            <span>←</span> BACK
          </button>
          
          <div className="flex items-center gap-4">
            <button onClick={handleShare} className="text-lg hover:scale-110 transition-transform" title="링크 공유">🔗</button>
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

      {/* 🟢 2. 플로팅 집중모드 버튼 */}
      <button 
        onClick={() => setIsFocusMode(!isFocusMode)}
        className={`fixed bottom-8 right-6 md:bottom-12 md:right-12 z-50 flex items-center gap-2 px-6 py-4 rounded-full shadow-2xl transition-all duration-300 font-black text-xs hover:scale-105 active:scale-95 ${
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

      {/* ⬆️ Top 버튼 */}
      {showTopBtn && (
        <button 
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-24 right-6 md:bottom-32 md:right-12 z-50 w-10 h-10 md:w-12 md:h-12 bg-white text-black border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-100 transition-all animate-in fade-in slide-in-from-bottom-5"
        >
          ⬆️
        </button>
      )}

      {/* 🕵️‍♂️ [NEW] 정주행 네비게이터 (플로팅) */}
      {(prevPost || nextPost) && !isFocusMode && (
        <div className="fixed bottom-24 right-20 md:bottom-32 md:right-28 z-40 flex flex-col gap-2 items-end">
          {nextPost && (
            <button onClick={() => router.push(`/post/${nextPost.id}`)} className="group flex items-center gap-2 bg-indigo-600 text-white px-4 py-3 rounded-full shadow-xl hover:scale-105 transition-all">
              <span className="hidden group-hover:block text-[10px] font-bold max-w-[100px] truncate">{nextPost.title}</span>
              <span className="text-xs font-black">다음화 ▶</span>
            </button>
          )}
          {prevPost && (
            <button onClick={() => router.push(`/post/${prevPost.id}`)} className="group flex items-center gap-2 bg-gray-200 text-gray-600 px-4 py-3 rounded-full shadow-xl hover:scale-105 transition-all">
              <span className="text-xs font-black">◀ 이전화</span>
              <span className="hidden group-hover:block text-[10px] font-bold max-w-[100px] truncate">{prevPost.title}</span>
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
          
          {/* 시리즈 정보 표시 */}
          {post.series_name && (
            <div className="mb-6 inline-block bg-indigo-600 text-white px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-wider shadow-lg">
               📚 {post.series_name} Series #{post.series_order}
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

        {/* 본문 (다크모드 시 prose-invert 적용) */}
        <div className={`prose prose-lg prose-indigo mx-auto font-medium leading-loose whitespace-pre-wrap mb-20 ${isDark ? 'prose-invert text-gray-300' : 'text-gray-800'}`}>
          {post.content}
        </div>

        {/* 좋아요 버튼 */}
        {!isFocusMode && (
          <>
            <div className="flex justify-center mb-16">
              <button onClick={handleLike} className={`group flex items-center gap-3 px-8 py-4 rounded-full border transition-all hover:scale-105 active:scale-95 ${cardBg} hover:border-red-500/50`}>
                <span className="text-2xl group-hover:animate-bounce">❤️</span>
                <span className={`font-black text-sm group-hover:text-red-500 ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>이 글이 재밌었다면 ({likes})</span>
              </button>
            </div>

            {/* 📚 시리즈 네비게이션 (Previous / Next) */}
            <div className="grid grid-cols-2 gap-4 mb-16">
              {prevPost ? (
                <div onClick={() => router.push(`/post/${prevPost.id}`)} className={`cursor-pointer p-6 rounded-3xl border transition-all hover:border-indigo-500 hover:shadow-lg ${cardBg}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">PREVIOUS</span>
                  <p className={`font-bold text-sm line-clamp-1 mt-1 ${themeText}`}>{prevPost.title}</p>
                </div>
              ) : <div />}

              {nextPost ? (
                <div onClick={() => router.push(`/post/${nextPost.id}`)} className={`cursor-pointer p-6 rounded-3xl border transition-all hover:border-indigo-500 hover:shadow-lg text-right ${cardBg}`}>
                  <span className="text-[9px] font-bold text-gray-400 uppercase">NEXT</span>
                  <p className={`font-bold text-sm line-clamp-1 mt-1 ${themeText}`}>{nextPost.title}</p>
                </div>
              ) : <div />}
            </div>

            <hr className={`my-16 ${isDark ? 'border-[#333]' : 'border-gray-100'}`} />

            {/* 댓글 영역 */}
            <div className={`p-8 md:p-12 rounded-[2.5rem] border ${cardBg}`}>
              <h3 className="text-xl font-black italic mb-6">💬 댓글 ({comments.length})</h3>
              
              {/* 🏷️ 닉네임 입력칸 */}
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
                  아직 작성된 댓글이 없습니다. 첫 댓글의 주인공이 되어보세요!
                </div>
              )}
            </div>
          </>
        )}
      </main>

      {/* ✏️ 수정 모달 */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-6 animate-in fade-in">
          <div className={`w-full max-w-4xl h-[80vh] rounded-[2rem] shadow-2xl flex flex-col overflow-hidden ${isDark ? 'bg-[#222] text-white' : 'bg-white text-black'}`}>
            <div className={`p-6 border-b flex justify-between items-center ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-100'}`}>
              <h3 className="font-black italic text-xl">📝 원고 수정</h3>
              <button onClick={() => setIsEditing(false)} className="text-2xl hover:rotate-90 transition-transform">✕</button>
            </div>
            <div className="flex-1 p-8 overflow-y-auto flex flex-col gap-6">
              <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} className={`text-3xl font-black border-b pb-2 outline-none transition-colors ${isDark ? 'bg-transparent border-[#444] focus:border-white' : 'border-gray-200 focus:border-black'}`} placeholder="제목" />
              <textarea value={editContent} onChange={(e) => setEditContent(e.target.value)} className={`flex-1 text-lg font-medium resize-none outline-none leading-loose bg-transparent`} placeholder="내용" />
            </div>
            <div className={`p-6 border-t flex justify-end gap-3 ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50'}`}>
              <button onClick={() => setIsEditing(false)} className={`px-6 py-3 rounded-xl font-bold transition-colors ${isDark ? 'text-gray-400 hover:bg-[#333]' : 'text-gray-500 hover:bg-gray-200'}`}>취소</button>
              <button onClick={handleUpdate} className="px-8 py-3 rounded-xl font-black text-white bg-indigo-600 hover:bg-indigo-700 transition-colors shadow-lg">수정 완료</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}