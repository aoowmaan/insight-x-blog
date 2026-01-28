'use client'

import React, { useState, useEffect, useRef } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Supabase 클라이언트 설정
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

// 📅 캘린더 모달 컴포넌트 (메인 페이지 내부 정의)
function CalendarModal({ memos, onClose }: { memos: any[], onClose: () => void }) {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(today);
  
  const getDaysInMonth = (year: number, month: number) => new Date(year, month + 1, 0).getDate();
  const getFirstDayOfMonth = (year: number, month: number) => new Date(year, month, 1).getDay();

  const daysInMonth = getDaysInMonth(currentDate.getFullYear(), currentDate.getMonth());
  const firstDay = getFirstDayOfMonth(currentDate.getFullYear(), currentDate.getMonth());
  
  const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
  const blanks = Array.from({ length: firstDay }, (_, i) => i);

  // 해당 날짜에 작성된 글 필터링
  const getPostsForDay = (day: number) => {
    return memos.filter(m => {
      const d = new Date(m.created_at);
      return d.getFullYear() === currentDate.getFullYear() && 
             d.getMonth() === currentDate.getMonth() && 
             d.getDate() === day;
    });
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[200] flex items-center justify-center p-6 animate-in fade-in">
      <div className="bg-white text-black p-10 rounded-[3rem] shadow-2xl max-w-lg w-full">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-black italic tracking-tighter">
            {currentDate.getFullYear()}.{currentDate.getMonth() + 1} ARCHIVE
          </h2>
          <button onClick={onClose} className="text-2xl hover:rotate-90 transition-transform">✕</button>
        </div>
        
        <div className="grid grid-cols-7 gap-2 mb-4 text-center font-bold text-gray-400 text-xs">
          {['SUN','MON','TUE','WED','THU','FRI','SAT'].map(d => <div key={d}>{d}</div>)}
        </div>
        
        <div className="grid grid-cols-7 gap-2">
          {blanks.map(b => <div key={`blank-${b}`} />)}
          {days.map(day => {
            const posts = getPostsForDay(day);
            const hasPost = posts.length > 0;
            return (
              <div key={day} className={`aspect-square rounded-2xl flex flex-col items-center justify-center relative group transition-all ${hasPost ? 'bg-black text-white cursor-pointer hover:scale-110 shadow-lg' : 'bg-gray-100 text-gray-300'}`}>
                <span className="font-black text-sm">{day}</span>
                {hasPost && <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full mt-1"></div>}
                
                {/* 툴팁: 마우스 올리면 글 제목 표시 */}
                {hasPost && (
                  <div className="absolute bottom-full mb-2 hidden group-hover:block bg-black text-white text-[10px] p-3 rounded-xl whitespace-nowrap z-20 shadow-xl border border-gray-700">
                    {posts.map(p => <div key={p.id} className="mb-1 last:mb-0">• {p.title}</div>)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
        
        <div className="mt-8 flex justify-between">
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="text-xs font-bold text-gray-400 hover:text-black transition-colors">◀ PREV MONTH</button>
          <button onClick={() => setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="text-xs font-bold text-gray-400 hover:text-black transition-colors">NEXT MONTH ▶</button>
        </div>
      </div>
    </div>
  );
}

export default function FullMainPageFinalV8() {
  const [isMounted, setIsMounted] = useState(false);
  const isTracked = useRef(false);
  
  // 📄 데이터 상태
  const [memos, setMemos] = useState<any[]>([]);
  const [drafts, setDrafts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState('전체');
  
  // ⚙️ 설정 상태
  const [config, setConfig] = useState({ hot_threshold: 5, notice_text: '' });
  
  // 🔐 관리자 상태
  const [isAdmin, setIsAdmin] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  // ✍️ 글쓰기 상태
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [writeCat, setWriteCat] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');
  const [seriesName, setSeriesName] = useState('');
  const [seriesOrder, setSeriesOrder] = useState(1);

  // 🎨 UI 상태
  const [searchQuery, setSearchQuery] = useState('');
  const [isDark, setIsDark] = useState(false);
  const [showTopBtn, setShowTopBtn] = useState(false);
  const [toast, setToast] = useState({ show: false, msg: '' });
  
  // 📅 캘린더 모달 상태
  const [showCalendar, setShowCalendar] = useState(false);

  const router = useRouter();

  // ✅ 1. 초기화 및 IP 추적
  useEffect(() => {
    setIsMounted(true);
    
    const trackVisit = async () => {
      if (isTracked.current) return;
      try {
        const res = await fetch('https://api.ipify.org?format=json');
        const data = await res.json();
        const userIp = data.ip || 'Unknown';

        await supabase.from('visits').insert([
          { 
            referrer: document.referrer || '직접 접속 (Direct)', 
            user_agent: navigator.userAgent,
            ip_address: userIp
          }
        ]);
        isTracked.current = true;
      } catch (e) {
        console.error('Tracking Error (Ignored):', e);
      }
    };
    trackVisit();

    const handleScroll = () => {
      if (window.scrollY > 300) setShowTopBtn(true);
      else setShowTopBtn(false);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // ✅ 2. 데이터 및 세션 로드
  useEffect(() => {
    if (!isMounted) return;

    const init = async () => {
      const savedTheme = localStorage.getItem('blog_theme');
      if (savedTheme === 'dark') setIsDark(true);

      const { data: { session } } = await supabase.auth.getSession();
      const userAdmin = !!session;
      setIsAdmin(userAdmin);

      try {
        const { data: conf } = await supabase.from('blog_config').select('*').single();
        if (conf) {
          setConfig({ 
            hot_threshold: conf.hot_threshold ?? 5, 
            notice_text: conf.notice_text ?? '' 
          });
        }
      } catch (e) {
        console.log('Config fetch error (ignored)');
      }

      fetchData(userAdmin);
    };
    init();

    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      const userAdmin = !!session;
      setIsAdmin(userAdmin);
      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        fetchData(userAdmin);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, [isMounted]);

  const showToast = (msg: string) => {
    setToast({ show: true, msg });
    setTimeout(() => setToast({ show: false, msg: '' }), 3000);
  };

  const fetchData = async (isUser: boolean) => {
    try {
      const { data: cats } = await supabase.from('categories').select('*');
      
      // 🚨 댓글 카운트 제거 (요청사항 반영) + 삭제된 글 제외 (deleted_at is null)
      let query = supabase.from('memos')
        .select('*') 
        .eq('is_draft', false)
        .is('deleted_at', null) // 휴지통에 있는 글은 안 가져옴
        .order('created_at', { ascending: false });
      
      if (!isUser) {
        const now = new Date().toISOString();
        query = query.or(`scheduled_at.is.null,scheduled_at.lte.${now}`);
      }
      
      const { data: list, error } = await query;
      if (error) console.error("Fetch Error:", error);

      // 임시저장 목록 (관리자만)
      if (isUser) {
        const { data: draftList } = await supabase.from('memos')
          .select('*')
          .eq('is_draft', true)
          .is('deleted_at', null) // 임시저장 중에서도 삭제 안 된 것만
          .order('created_at', { ascending: false });
        setDrafts(draftList || []);
      } else {
        setDrafts([]);
      }

      if (cats) {
        setCategories(cats);
        if (cats.length > 0 && !writeCat) setWriteCat(cats[0].name);
      }
      setMemos(list || []);

    } catch (e) {
      console.error("Critical Fetch Error:", e);
    }
  };

  const handleLogin = async () => {
    if (!email || !password) return showToast('정보를 입력하세요.');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) showToast('로그인 실패: ' + error.message);
    else {
      setShowLogin(false);
      setEmail(''); setPassword('');
      showToast('관리자님, 환영합니다.');
    }
  };

  const handleLogout = async () => {
    if(!confirm("로그아웃 하시겠습니까?")) return;
    try {
      await supabase.auth.signOut();
      localStorage.clear(); 
      sessionStorage.clear();
      setIsAdmin(false);
      showToast("로그아웃 되었습니다.");
      setTimeout(() => window.location.href = '/', 1000);
    } catch (e) {
      window.location.reload();
    }
  };

  const handleRandomDive = () => {
    if (memos.length === 0) return;
    const randomId = memos[Math.floor(Math.random() * memos.length)].id;
    router.push(`/post/${randomId}`);
  };

  const loadDraft = (draft: any) => {
    if(!confirm(`'${draft.title}' 불러오기?`)) return;
    setEditingId(draft.id); 
    setTitle(draft.title);
    setContent(draft.content);
    setWriteCat(draft.category_name);
    setSeriesName(draft.series_name || '');
    setSeriesOrder(draft.series_order || 1);
    
    setScheduledAt(draft.scheduled_at ? draft.scheduled_at.slice(0, 16) : '');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const savePost = async (asDraft = false) => {
    if (!title.trim() || !content.trim() || !writeCat) return showToast('내용 필수');
    if (!isAdmin) return showToast('관리자 권한이 없습니다.');
    
    setLoading(true);

    try {
      let image_url = null;
      if (imageFile) {
        const fn = `${Date.now()}_img`;
        const { data } = await supabase.storage.from('blog_images').upload(fn, imageFile);
        if (data) image_url = supabase.storage.from('blog_images').getPublicUrl(fn).data.publicUrl;
      }
      
      const finalScheduledAt = asDraft ? (scheduledAt ? new Date(scheduledAt).toISOString() : null) : null;

      const payload: any = { 
        title, content, category_name: writeCat, 
        is_draft: asDraft,
        scheduled_at: finalScheduledAt,
        series_name: seriesName || null,
        series_order: seriesOrder || 1,
        updated_at: new Date().toISOString()
      };
      if (image_url) payload.image_url = image_url;

      if (editingId) {
        const { error } = await supabase.from('memos').update(payload).eq('id', editingId);
        if (error) throw error;
        showToast(asDraft ? '수정: 임시저장됨' : '수정: 발행됨');
      } else {
        const { error } = await supabase.from('memos').insert([payload]);
        if (error) throw error;
        showToast(asDraft ? '신규: 임시저장됨' : '신규: 발행됨');
      }

      setLoading(false);
      setEditingId(null); 
      setTitle(''); setContent(''); setImageFile(null); setScheduledAt('');
      setSeriesName(''); setSeriesOrder(1); 
      fetchData(true); 

    } catch (err: any) {
      showToast(`오류: ${err.message}`);
      setLoading(false);
    }
  };

  const filteredMemos = memos.filter(m => {
    const matchesCat = selectedCat === '전체' || m.category_name === selectedCat;
    return matchesCat && (
      (m.title?.toLowerCase() || "").includes(searchQuery.toLowerCase()) || 
      (m.content?.toLowerCase() || "").includes(searchQuery.toLowerCase())
    );
  });

  const themeText = isDark ? 'text-white' : 'text-black';
  const themeBg = isDark ? 'bg-[#111]' : 'bg-white';
  const navBg = isDark ? 'bg-black/80 border-[#333]' : 'bg-white/80 border-gray-100';
  const cardBg = isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-gray-100';

  if (!isMounted) return <div className="min-h-screen bg-black flex items-center justify-center text-green-500 font-mono">SYSTEM BOOTING...</div>;

  return (
    <div className={`min-h-screen font-sans pb-40 relative overflow-x-hidden transition-colors duration-500 ${themeBg} ${themeText}`}>
      
      {/* 🍞 토스트 알림 */}
      <div className={`fixed top-10 left-1/2 -translate-x-1/2 z-[300] bg-black/80 backdrop-blur-md text-white px-6 py-3 rounded-full shadow-2xl transition-all duration-300 pointer-events-none flex items-center gap-2 ${toast.show ? 'opacity-100 translate-y-0' : 'opacity-0 -translate-y-4'}`}>
        <span className="text-lg">🔔</span>
        <span className="text-xs font-bold tracking-wide">{toast.msg}</span>
      </div>

      {/* 📢 공지사항 */}
      {config.notice_text && (
        <div className="bg-indigo-600 text-white text-center py-3 text-[10px] font-black tracking-widest uppercase relative z-[120] animate-in slide-in-from-top">
          📢 NOTICE : {config.notice_text}
        </div>
      )}

      {/* 1. 마퀴 (티커) */}
      <div className="bg-black text-white py-2 overflow-hidden whitespace-nowrap z-[110] relative text-[9px] font-black tracking-[0.3em] uppercase">
        <div className="inline-block animate-marquee">
          {memos.length > 0 ? memos.map(m => ` • STATUS: ${m.title} `).join(' ') : " • SYSTEM READY • "}
        </div>
      </div>

      {/* 2. 네비게이션 */}
      <nav className={`sticky top-0 backdrop-blur-2xl z-[100] border-b py-4 md:py-6 px-6 md:px-12 transition-colors ${navBg}`}>
        <div className="max-w-[1800px] mx-auto flex justify-between items-center">
          <div className="flex items-center gap-6 md:gap-16">
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter cursor-pointer hover:text-indigo-600 transition-colors"
                onClick={() => window.location.reload()}>
              인사이트<span className="text-indigo-600">.X</span>
            </h1>
            <div className="hidden md:flex gap-10 items-center border-l border-gray-100 pl-16">
              <button onClick={() => router.push('/nexus')} className="text-[11px] font-black tracking-[0.2em] text-gray-400 hover:text-indigo-600 transition-all">🌌 지식 성운</button>
            </div>
          </div>

          <div className="flex items-center gap-4 md:gap-8">
            <button onClick={() => { setIsDark(!isDark); localStorage.setItem('blog_theme', !isDark ? 'dark' : 'light'); }} className={`w-8 h-8 md:w-10 md:h-10 rounded-full flex items-center justify-center border transition-all text-sm md:text-xl ${isDark ? 'border-gray-700 hover:bg-gray-800' : 'border-gray-200 hover:bg-gray-100'}`}>
              {isDark ? '☀️' : '🌙'}
            </button>
            <div className="relative group hidden md:block">
              <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="검색..." className={`border-none rounded-full px-10 py-2.5 text-[11px] font-bold w-64 focus:w-80 transition-all outline-none ${isDark ? 'bg-[#222] text-white placeholder-gray-500' : 'bg-gray-50 text-black placeholder-gray-400'}`} />
            </div>
            
            {isAdmin ? (
               <div className="flex items-center gap-4">
                 <button onClick={() => router.push('/admin')} className="bg-indigo-600 text-white px-4 py-2 md:px-6 md:py-2.5 rounded-full text-[9px] md:text-[10px] font-black">관리</button>
                 <button onClick={handleLogout} className="hidden md:block text-[10px] font-black text-red-500">로그아웃</button>
               </div>
            ) : (
               <button onClick={() => setShowLogin(true)} className="hidden md:block text-[10px] font-bold opacity-50 hover:opacity-100">LOGIN</button>
            )}
          </div>
        </div>
      </nav>

      {/* 3. 카테고리 필터 */}
      <div className="max-w-[1800px] mx-auto px-6 md:px-12 py-6 md:py-10 flex gap-4 md:gap-6 overflow-x-auto no-scrollbar">
        {['전체', ...categories.map(c => c.name)].map(c => (
          <button key={c} onClick={() => setSelectedCat(c)} className={`px-4 py-2 md:px-6 md:py-2 rounded-full text-[9px] md:text-[10px] font-black transition-all border shrink-0 ${selectedCat === c ? 'bg-indigo-600 text-white border-indigo-600' : `${isDark ? 'bg-[#222] border-[#333] text-gray-400' : 'bg-white border-gray-100 text-gray-500'} hover:text-indigo-500`}`}>{c}</button>
        ))}
      </div>

      <main className="max-w-[1800px] mx-auto px-6 md:px-12 pt-6 md:pt-10">
        
        {/* 4. 관리자 글쓰기 영역 */}
        {isAdmin && (
          <section className="mb-20 md:mb-32 max-w-5xl mx-auto animate-in fade-in slide-in-from-bottom-10">
            <div className={`p-8 md:p-16 rounded-[2rem] md:rounded-[4rem] border-2 shadow-2xl transition-colors ${isDark ? 'bg-[#1a1a1a] border-[#333]' : 'bg-gray-50 border-white'}`}>
              <div className="flex justify-between items-center mb-8 md:mb-12">
                <h3 className={`text-xl md:text-3xl font-black italic tracking-tighter ${themeText}`}>
                  {editingId ? '📝 수정 모드' : '✨ 관리자 기록 모드'}
                </h3>
                {drafts.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto max-w-[150px] md:max-w-md no-scrollbar">
                    {drafts.map(d => (
                      <button key={d.id} onClick={() => loadDraft(d)} className="bg-yellow-400/20 text-yellow-600 border border-yellow-400/30 px-3 py-1 rounded-full text-[8px] md:text-[9px] font-bold whitespace-nowrap">
                        📂 {d.title}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2 mb-8 md:mb-10 overflow-x-auto pb-4 no-scrollbar">
                {categories.map(c => (
                  <button key={c.id} onClick={() => setWriteCat(c.name)} className={`px-4 py-2 md:px-6 md:py-2.5 rounded-2xl text-[9px] md:text-[10px] font-black transition-all shrink-0 ${writeCat === c.name ? 'bg-indigo-600 text-white' : 'bg-gray-200 text-gray-500'}`}>{c.name}</button>
                ))}
              </div>
              
              <input value={title} onChange={(e) => setTitle(e.target.value)} className={`w-full bg-transparent text-2xl md:text-4xl font-black border-none focus:ring-0 mb-6 md:mb-8 outline-none ${themeText} ${isDark ? 'placeholder:text-gray-600' : 'placeholder:text-gray-300'}`} placeholder="제목" />
              <textarea value={content} onChange={(e) => setContent(e.target.value)} className={`w-full h-32 md:h-40 bg-transparent text-lg md:text-xl font-medium border-none focus:ring-0 resize-none outline-none ${themeText} ${isDark ? 'placeholder:text-gray-700' : 'placeholder:text-gray-300'}`} placeholder="내용..." />
              
              <div className="flex gap-4 mb-6 items-center bg-black/5 p-4 rounded-2xl w-fit">
                <input value={seriesName} onChange={(e) => setSeriesName(e.target.value)} placeholder="시리즈 이름 (예: 소설)" className={`bg-transparent border-b border-gray-300 py-2 w-40 text-xs font-bold outline-none ${themeText}`} />
                <input type="number" value={seriesOrder} onChange={(e) => setSeriesOrder(Number(e.target.value))} placeholder="순서" className={`bg-transparent border-b border-gray-300 py-2 w-16 text-xs font-bold outline-none ${themeText}`} />
              </div>

              <div className="flex flex-col md:flex-row md:items-center gap-4 mb-8 bg-black/5 p-4 rounded-2xl w-fit">
                <span className={`text-[10px] font-bold ${isDark ? 'text-gray-400' : 'text-gray-600'}`}>📅 예약(선택):</span>
                <input type="datetime-local" value={scheduledAt} onChange={(e) => setScheduledAt(e.target.value)} className={`bg-transparent text-[11px] font-bold outline-none ${themeText}`} />
              </div>

              <div className="flex flex-col md:flex-row justify-between items-center mt-6 pt-6 md:mt-8 md:pt-8 border-t border-gray-200/20 gap-4">
                <label className="w-full md:w-auto cursor-pointer text-[10px] font-black text-gray-400 hover:text-indigo-500 bg-white/10 px-6 py-4 rounded-3xl transition-all border border-gray-200/20 text-center">
                  <input type="file" onChange={(e) => setImageFile(e.target.files?.[0] || null)} className="hidden" />
                  {imageFile ? "✅ 준비됨" : "📷 미디어"}
                </label>
                <div className="flex gap-2 md:gap-4 w-full md:w-auto">
                  {editingId && <button onClick={() => { setEditingId(null); setTitle(''); setContent(''); }} className="flex-1 md:flex-none bg-red-100 text-red-500 px-6 py-4 rounded-[2rem] font-black text-xs">취소</button>}
                  <button onClick={() => savePost(true)} disabled={loading} className="flex-1 md:flex-none bg-gray-200 text-gray-600 px-6 py-4 md:px-8 md:py-5 rounded-[2.5rem] font-black text-xs hover:bg-gray-300 transition-all">임시저장</button>
                  <button onClick={() => savePost(false)} disabled={loading} className="flex-[2] md:flex-none bg-black text-white px-8 py-4 md:px-12 md:py-5 rounded-[2.5rem] font-black text-xs uppercase hover:bg-indigo-600 transition-all shadow-xl">
                    {editingId ? '수정' : '발행'}
                  </button>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* 5. 플로팅 버튼들 (캘린더 / 랜덤 / 탑) */}
        <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 z-50 flex flex-col gap-4 items-end">
          {showTopBtn && (
            <button 
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="w-12 h-12 bg-white text-black border border-gray-200 rounded-full shadow-lg flex items-center justify-center text-lg hover:bg-gray-100 transition-all"
            >
              ⬆️
            </button>
          )}
          
          {/* [NEW] 캘린더 버튼 */}
          <button 
            onClick={() => setShowCalendar(true)} 
            className="px-6 py-3 bg-black text-white rounded-full shadow-2xl font-black text-xs hover:scale-105 transition-all flex items-center gap-2"
          >
            📅 CALENDAR
          </button>
          
          <button onClick={handleRandomDive} className="w-16 h-16 bg-indigo-600 text-white rounded-full shadow-2xl flex items-center justify-center text-2xl hover:rotate-180 transition-transform duration-700 hover:bg-black" title="랜덤 다이브">🎲</button>
        </div>

        {/* 6. 글 목록 (카드) */}
        <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-8 md:gap-16">
          {filteredMemos.map((item) => (
            <article key={item.id} onClick={() => router.push(`/post/${item.id}`)} className="group cursor-pointer">
              <div className={`aspect-[4/5] overflow-hidden rounded-[2.5rem] md:rounded-[4rem] mb-6 md:mb-10 relative transition-all duration-700 group-hover:-translate-y-4 group-hover:shadow-2xl ${cardBg}`}>
                
                {/* 👁️ 조회수, 🔥 HOT 배지 (댓글 수는 삭제됨) */}
                <div className="absolute top-6 right-6 md:top-8 md:right-8 z-20 flex flex-col items-end gap-2">
                   {/* 조회수만 표시 */}
                   <div className="bg-black/40 backdrop-blur-md text-white px-3 py-1 rounded-full text-[9px] font-bold border border-white/10 flex items-center gap-1">
                     👁️ {item.views || 0}
                   </div>
                   {/* HOT 배지 */}
                   {(item.likes || 0) >= config.hot_threshold && (
                     <div className="bg-red-500 text-white px-3 py-1 rounded-full text-[9px] font-black border border-red-400 animate-pulse">
                       🔥 HOT
                     </div>
                   )}
                </div>

                {/* 시리즈 표시 */}
                {item.series_name && (
                   <div className="absolute top-6 left-6 md:top-8 md:left-8 bg-indigo-600 text-white px-3 py-1 rounded-full text-[9px] font-black uppercase z-20 shadow-lg border border-indigo-400 flex items-center gap-1">
                     📚 {item.series_name} #{item.series_order}
                   </div>
                )}

                {item.image_url ? (
                  <>
                    <img src={item.image_url} className="w-full h-full object-cover transition-all duration-1000 group-hover:scale-110" />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent opacity-80" />
                  </>
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-gray-300 text-6xl font-black italic">DATA</div>
                )}
                
                {(item.is_draft || (item.scheduled_at && new Date(item.scheduled_at) > new Date())) && (
                  <div className="absolute top-16 left-6 md:top-20 md:left-8 bg-yellow-400 text-black px-2 py-1 md:px-3 md:py-1 rounded-full text-[8px] md:text-[9px] font-black uppercase z-20">
                    {item.is_draft ? 'DRAFT' : 'SCHEDULED'}
                  </div>
                )}

                <div className="absolute inset-0 bg-indigo-600/90 flex flex-col justify-center p-8 md:p-12 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-all duration-500 backdrop-blur-sm text-center z-10 hidden md:flex">
                  <p className="text-white text-[10px] font-black uppercase tracking-widest mb-4">핵심 요약</p>
                  <p className="text-white text-xl font-bold italic line-clamp-4">{item.content}</p>
                </div>

                <div className="absolute bottom-8 left-6 right-6 md:bottom-12 md:left-10 md:right-10 transition-opacity z-20 md:group-hover:opacity-0">
                  <span className={`px-3 py-1 md:px-4 md:py-1.5 rounded-xl text-[8px] md:text-[9px] font-black tracking-widest uppercase mb-2 md:mb-4 inline-block backdrop-blur-md border ${item.image_url ? 'text-white bg-white/20 border-white/30' : 'text-indigo-500 bg-gray-100 border-gray-200'}`}>{item.category_name}</span>
                  <h3 className={`text-2xl md:text-3xl font-black leading-tight tracking-tighter italic drop-shadow-lg ${item.image_url ? 'text-white' : themeText}`}>"{item.title}"</h3>
                </div>
              </div>
            </article>
          ))}
        </section>
      </main>

      <footer className="py-20 text-center opacity-30 hover:opacity-100 transition-opacity">
        <p className={`text-[10px] font-black cursor-pointer ${themeText}`} onClick={() => !isAdmin && setShowLogin(true)}>
          © 2026 INSIGHT.X
        </p>
      </footer>

      {/* 7. 로그인 모달 */}
      {showLogin && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-[200] flex items-center justify-center animate-in fade-in p-6">
          <div className={`w-full max-w-sm text-center p-10 md:p-16 border rounded-[3rem] md:rounded-[4rem] shadow-2xl ${isDark ? 'bg-[#222] border-[#333]' : 'bg-white border-gray-100'}`}>
            <h2 className={`text-2xl md:text-3xl font-black mb-12 italic tracking-tighter ${themeText}`}>운영자 보안 인증</h2>
            <input 
              type="text" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              className={`w-full border-none rounded-2xl py-4 px-6 mb-4 text-center text-lg font-bold outline-none ${isDark ? 'bg-[#333] text-white' : 'bg-gray-50 text-black'}`} 
              placeholder="이메일" 
            />
            <input 
              type="password" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              onKeyDown={(e) => e.key === 'Enter' && handleLogin()} 
              className={`w-full border-none rounded-2xl py-4 px-6 mb-8 text-center text-lg font-bold outline-none ${isDark ? 'bg-[#333] text-white' : 'bg-gray-50 text-black'}`} 
              placeholder="비밀번호" 
            />
            <button onClick={handleLogin} className="w-full bg-black text-white py-5 md:py-6 rounded-3xl font-black text-xs uppercase hover:bg-indigo-600 transition-all border border-transparent">인증</button>
            <button onClick={() => setShowLogin(false)} className={`mt-6 text-[10px] font-bold hover:opacity-100 opacity-50 ${themeText}`}>닫기</button>
          </div>
        </div>
      )}
      
      {/* 8. 캘린더 모달 */}
      {showCalendar && <CalendarModal memos={memos} onClose={() => setShowCalendar(false)} />}

      <style jsx global>{` @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-50%); } } .animate-marquee { display: inline-block; animation: marquee 50s linear infinite; } .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
}