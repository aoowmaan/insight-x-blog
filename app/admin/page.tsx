'use client'

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Supabase 클라이언트 연결
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function SuperAdminFinalMobileFixed() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [activeTab, setActiveTab] = useState('DASHBOARD');
  
  // 📊 데이터 상태
  const [stats, setStats] = useState({ 
    visits: 0, 
    posts: 0, 
    comments: 0, 
    totalLikes: 0 
  });

  const [posts, setPosts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [allComments, setAllComments] = useState<any[]>([]);
  const [referrers, setReferrers] = useState<any[]>([]);
  const [deletedPosts, setDeletedPosts] = useState<any[]>([]);
  
  // ⚙️ 설정 상태
  const [nickname, setNickname] = useState('관리자');
  const [newCat, setNewCat] = useState('');
  const [config, setConfig] = useState({ 
    hot_threshold: 5, 
    notice_text: '',
    timeline_category: ''
  });

  // 📚 시리즈 관리용 필터 상태
  const [seriesTargetCat, setSeriesTargetCat] = useState('전체');

  const router = useRouter();

  // ✅ 1. 관리자 인증 및 데이터 로드
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          alert("🚫 접근 불가: 관리자 로그인이 필요합니다.");
          router.replace('/'); 
          return;
        }
        
        setIsAdmin(true);
        const savedNick = localStorage.getItem('blog_nickname');
        if (savedNick) setNickname(savedNick);

        fetchAllData();
      } catch (e) {
        console.error("인증 에러:", e);
        router.replace('/');
      }
    };
    checkAuth();
  }, []);

  // ✅ 2. 모든 데이터 가져오기
  const fetchAllData = async () => {
    try {
        const { count: pCount } = await supabase.from('memos').select('*', { count: 'exact', head: true }).is('deleted_at', null);
        const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
        
        let vCount = 0;
        try { 
          const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true }); 
          vCount = count || 0; 
        } catch (e) {}

        const { data: list } = await supabase.from('memos').select('*').is('deleted_at', null).order('created_at', { ascending: false });
        const { data: trash } = await supabase.from('memos').select('*').not('deleted_at', 'is', null).order('deleted_at', { ascending: false });
        const { data: cData } = await supabase.from('comments').select('*').order('created_at', { ascending: false });
        const rawComments = cData || [];

        const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        const { data: ref } = await supabase.from('visits').select('*').order('created_at', { ascending: false }).limit(100);
        const { data: conf } = await supabase.from('blog_config').select('*').single();
        
        const activeMemos = list || [];

        const mappedComments = rawComments.map((c: any) => {
          const targetMemo = activeMemos.find((m: any) => m.id === c.memo_id) || (trash || []).find((m: any) => m.id === c.memo_id);
          return {
            ...c,
            memo_title: targetMemo ? targetMemo.title : '🚫 완전 삭제된 글'
          };
        });

        const totalLikesSum = activeMemos.reduce((acc: number, cur: any) => acc + (cur.likes || 0), 0);

        setStats({ 
          visits: vCount, 
          posts: activeMemos.length, 
          comments: rawComments.length, 
          totalLikes: totalLikesSum 
        });

        setPosts(activeMemos);
        setDeletedPosts(trash || []);
        setCategories(cats || []);
        setAllComments(mappedComments);
        setReferrers(ref || []);
        
        if (conf) {
          setConfig({ 
            hot_threshold: conf.hot_threshold ?? 5, 
            notice_text: conf.notice_text ?? '',
            timeline_category: conf.timeline_category ?? ''
          });
        }

    } catch (e) {
        console.error("데이터 로딩 에러:", e);
    }
  };

  // ✅ 3. 시리즈 정보 업데이트
  const updateSeriesInfo = async (id: number, sName: string, sOrder: number) => {
    const nameToSave = sName.trim() === '' ? null : sName;
    await supabase.from('memos').update({ series_name: nameToSave, series_order: sOrder }).eq('id', id);
    fetchAllData(); 
  };

  // ✅ 4. 설정 저장
  const saveConfig = async () => {
    const { error } = await supabase.from('blog_config').update(config).eq('id', 1);
    if(error) await supabase.from('blog_config').insert([{ id: 1, ...config }]);
    alert("✅ 시스템 설정이 저장되었습니다.");
  };

  // ✅ 5. 유입 경로 파싱
  const parseReferrer = (ref: string) => {
    if (!ref || ref.includes('direct') || ref === '') return { icon: '🏠', label: '직접 접속', color: 'text-gray-500' };
    if (ref.includes('google')) return { icon: '🇬', label: 'Google', color: 'text-blue-500' };
    if (ref.includes('naver')) return { icon: '🇳', label: 'Naver', color: 'text-green-500' };
    if (ref.includes('daum')) return { icon: '🇩', label: 'Daum', color: 'text-blue-400' };
    if (ref.includes('kakao')) return { icon: '🟡', label: 'Kakao', color: 'text-yellow-500' };
    return { icon: '🔗', label: '기타', color: 'text-indigo-500' };
  };

  // ✅ 6. 삭제/복구
  const softDeletePost = async (id: number) => { if(confirm('휴지통으로 이동하시겠습니까?')) { await supabase.from('memos').update({ deleted_at: new Date().toISOString() }).eq('id', id); fetchAllData(); } };
  const restorePost = async (id: number) => { if(confirm('이 글을 복구하시겠습니까?')) { await supabase.from('memos').update({ deleted_at: null }).eq('id', id); fetchAllData(); } };
  const hardDeletePost = async (id: number) => { if(confirm('⚠️ 영구 삭제하시겠습니까?')) { await supabase.from('memos').delete().eq('id', id); fetchAllData(); } };

  if (!isAdmin) return <div className="h-screen bg-black text-white flex flex-col items-center justify-center font-mono"><div className="animate-spin text-4xl mb-4">⚙️</div><p className="text-xl font-bold">Loading System...</p></div>;

  return (
    // 📱 [Mobile Fix] flex-col (모바일) -> md:flex-row (PC)
    <div className="min-h-screen bg-white text-black font-sans flex flex-col md:flex-row selection:bg-indigo-600 selection:text-white">
      
      {/* 🟢 사이드바 메뉴 */}
      {/* 📱 [Mobile Fix] w-full, h-auto (모바일) / w-80, h-screen (PC) */}
      <aside className="w-full md:w-80 border-b md:border-b-0 md:border-r border-gray-100 h-auto md:h-screen sticky top-0 flex flex-col p-6 md:p-8 bg-[#fcfcfc] z-50">
        <div className="flex justify-between md:block items-center mb-6 md:mb-16">
          <div>
            <div className="flex items-center gap-2 mb-2 md:mb-4">
              <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></span>
              <span className="text-[10px] font-black text-indigo-600 tracking-widest uppercase">SYSTEM ONLINE</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black italic tracking-tighter">
              관리<span className="text-indigo-600">실</span>
            </h1>
          </div>
          <button onClick={() => router.push('/')} className="md:mt-6 flex items-center gap-2 md:gap-3 text-[10px] font-black text-gray-400 hover:text-black transition-all group border px-3 py-2 rounded-full md:border-none md:p-0">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> <span className="hidden md:inline">메인으로</span> 나가기
          </button>
        </div>

        {/* 📱 [Mobile Fix] 가로 스크롤 메뉴 (overflow-x-auto) */}
        <nav className="flex md:flex-col gap-3 md:gap-4 overflow-x-auto pb-2 md:pb-0 no-scrollbar">
          {[
            { id: 'DASHBOARD', l: '📊 현황', d: '요약' },
            { id: 'SERIES', l: '📚 시리즈', d: '순서' },
            { id: 'DATABASE', l: '🗄️ 글 관리', d: '수정' },
            { id: 'TRASH', l: '🗑️ 휴지통', d: '복구' },
            { id: 'AUDIT', l: '💬 댓글', d: '검토' },
            { id: 'TRAFFIC', l: '📡 유입', d: '분석' },
            { id: 'CONFIG', l: '⚙️ 설정', d: '제어' }
          ].map((menu) => (
            <button 
              key={menu.id} 
              onClick={() => setActiveTab(menu.id)} 
              className={`min-w-[100px] md:w-full text-left p-4 md:p-6 rounded-2xl md:rounded-[2rem] transition-all border group relative overflow-hidden flex-shrink-0 ${
                activeTab === menu.id 
                  ? 'bg-black text-white border-black shadow-xl md:scale-105' 
                  : 'bg-white border-gray-100 text-gray-400 hover:border-black hover:text-black'
              }`}
            >
              <p className="font-black text-xs md:text-sm mb-1 relative z-10">{menu.l}</p>
              <p className={`text-[8px] font-bold relative z-10 hidden md:block ${activeTab === menu.id ? 'text-white/30' : 'text-gray-200 group-hover:text-gray-400'}`}>
                {menu.d}
              </p>
            </button>
          ))}
        </nav>
        
        <div className="mt-auto pt-8 border-t border-gray-100 hidden md:block">
           <p className="text-[9px] font-bold text-gray-300 text-center">AooW_X ADMIN</p>
        </div>
      </aside>

      {/* 🚀 메인 작업 영역 */}
      {/* 📱 [Mobile Fix] p-4 (모바일) -> p-20 (PC) 여백 최적화 */}
      <main className="flex-1 p-4 md:p-20 overflow-y-auto relative bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]">
        
        {/* 1. 운영 현황 */}
        {activeTab === 'DASHBOARD' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8 md:space-y-12">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">운영 현황</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">블로그 상태 요약</p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8">
              {[ 
                { l:'방문자', v: stats.visits, c: 'text-black' }, 
                { l:'글', v: stats.posts, c: 'text-indigo-600' }, 
                { l:'댓글', v: stats.comments, c: 'text-blue-500' }, 
                { l:'좋아요', v: stats.totalLikes, c: 'text-red-500' } 
              ].map((s, i) => (
                <div key={i} className="bg-white p-6 md:p-10 rounded-[2rem] md:rounded-[3rem] border-2 border-gray-50 shadow-xl hover:-translate-y-2 transition-transform">
                  <p className="text-[8px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 md:mb-6">{s.l}</p>
                  <div className={`text-3xl md:text-6xl font-black italic tracking-tighter ${s.c}`}>
                    {s.v.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            
            <div className="bg-white p-6 md:p-12 rounded-[2rem] md:rounded-[3rem] border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-6 md:mb-8">
                <h3 className="text-xl md:text-2xl font-black italic">💬 최신 피드백</h3>
                <button onClick={() => setActiveTab('AUDIT')} className="text-xs font-bold text-indigo-500 hover:underline">전체보기 →</button>
              </div>
              <div className="space-y-4">
                {allComments.length > 0 ? allComments.slice(0, 5).map(c => (
                  <div key={c.id} className="flex flex-col md:flex-row justify-between md:items-center p-4 md:p-6 bg-gray-50 rounded-2xl md:rounded-3xl gap-2">
                    <div className="flex items-center gap-3 overflow-hidden">
                        <span className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-[10px] md:text-xs shrink-0">
                          {c.nickname ? c.nickname.slice(0,1) : '익'}
                        </span>
                        <span className="truncate font-bold text-gray-600 text-xs md:text-sm">"{c.content}"</span>
                    </div>
                    <div className="flex items-center justify-between md:flex-col md:items-end gap-1 shrink-0 ml-9 md:ml-0">
                      <span className="text-[9px] md:text-[10px] font-black text-indigo-400">{c.memo_title}</span>
                      <span className="text-[8px] md:text-[9px] text-gray-300">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : <div className="text-center py-10 text-gray-300 font-bold text-xs">댓글 없음</div>}
              </div>
            </div>
          </div>
        )}

        {/* 2. 시리즈 관리 */}
        {activeTab === 'SERIES' && (
          <div className="animate-in fade-in duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">시리즈 관리</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">연재 순서 정리</p>
            </div>
            
            <div className="flex gap-2 md:gap-4 overflow-x-auto pb-4 no-scrollbar">
              {['전체', ...categories.map(c => c.name)].map(c => (
                <button key={c} onClick={() => setSeriesTargetCat(c)} className={`px-4 py-2 md:px-6 md:py-3 rounded-full font-black text-[10px] md:text-xs border whitespace-nowrap transition-all ${seriesTargetCat === c ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-200 hover:border-black'}`}>{c}</button>
              ))}
            </div>

            <div className="space-y-4">
              {posts.filter(p => seriesTargetCat === '전체' || p.category_name === seriesTargetCat).map(p => (
                <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-4 md:gap-6 p-6 md:p-8 bg-white border border-gray-100 rounded-[2rem] md:rounded-[2.5rem] hover:shadow-xl transition-all group">
                  <div className="flex items-center gap-4 md:gap-6 flex-1">
                    <div className="w-10 h-10 md:w-16 md:h-16 bg-gray-50 rounded-xl md:rounded-2xl flex items-center justify-center font-black text-gray-300 shrink-0 text-sm md:text-xl">{p.id}</div>
                    <div className="overflow-hidden">
                      <p className="text-[8px] md:text-[10px] font-bold text-indigo-500 mb-1 uppercase tracking-wider">{p.category_name}</p>
                      <p className="text-lg md:text-xl font-black italic truncate">{p.title}</p>
                    </div>
                  </div>
                  <div className="flex gap-2 md:gap-4 bg-gray-50 p-3 md:p-4 rounded-2xl md:rounded-3xl">
                    <div className="flex-1 md:flex-none flex flex-col">
                      <label className="text-[8px] md:text-[9px] font-bold text-gray-400 ml-2 mb-1">시리즈명</label>
                      <input placeholder="없음" className="bg-white px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-bold w-full md:w-48 outline-none" defaultValue={p.series_name || ''} onBlur={(e) => updateSeriesInfo(p.id, e.target.value, p.series_order)} />
                    </div>
                    <div className="w-16 md:w-auto flex flex-col">
                      <label className="text-[8px] md:text-[9px] font-bold text-gray-400 ml-2 mb-1">순서</label>
                      <input type="number" placeholder="1" className="bg-white px-3 py-2 md:px-4 md:py-3 rounded-xl md:rounded-2xl text-[10px] md:text-xs font-bold w-full md:w-20 outline-none" defaultValue={p.series_order || 1} onBlur={(e) => updateSeriesInfo(p.id, p.series_name, Number(e.target.value))} />
                    </div>
                  </div>
                </div>
              ))}
              {posts.length === 0 && <p className="text-center py-20 text-gray-300 font-bold text-xs">글이 없습니다.</p>}
            </div>
          </div>
        )}

        {/* 3. 게시글 관리 (휴지통 기능 포함) */}
        {activeTab === 'DATABASE' && (
          <div className="animate-in fade-in duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">게시글 관리</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">모든 기록을 조회하고 수정합니다.</p>
            </div>
            <div className="space-y-4">
              {posts.map(p => (
                <div key={p.id} className="flex flex-col md:flex-row justify-between md:items-center p-6 md:p-8 bg-white border border-gray-100 rounded-[2rem] md:rounded-[3rem] group hover:border-black transition-all gap-4">
                  <div className="flex-1">
                    <span className={`text-[8px] md:text-[9px] font-bold px-2 py-1 md:px-3 md:py-1 rounded-full mb-2 md:mb-3 inline-block tracking-wide ${p.is_draft ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}>
                      {p.is_draft ? '🟡 임시저장' : '🔵 발행됨'}
                    </span>
                    <p className="text-xl md:text-2xl font-black italic mb-2">"{p.title}"</p>
                    <div className="flex gap-4 text-[10px] md:text-xs text-gray-400 font-bold items-center">
                        <span className="flex items-center gap-1">👁️ {p.views || 0}</span>
                        <span className="flex items-center gap-1">❤️ {p.likes || 0}</span>
                        <span className="flex items-center gap-1 text-indigo-400 truncate max-w-[150px]">{p.series_name ? `📚 ${p.series_name} #${p.series_order}` : ''}</span>
                    </div>
                  </div>
                  <button onClick={() => softDeletePost(p.id)} className="w-full md:w-auto px-6 py-3 md:px-8 md:py-4 text-red-500 font-black text-xs border border-red-50 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm">🗑️ 휴지통</button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. 휴지통 */}
        {activeTab === 'TRASH' && (
          <div className="animate-in fade-in duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4 text-red-500">휴지통</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">삭제된 글을 복구하거나 영구 제거합니다.</p>
            </div>
            <div className="space-y-4">
              {deletedPosts.length > 0 ? deletedPosts.map(p => (
                <div key={p.id} className="flex flex-col md:flex-row justify-between md:items-center p-6 md:p-8 bg-red-50 border border-red-100 rounded-[2rem] md:rounded-[3rem] opacity-80 hover:opacity-100 transition-all gap-4">
                  <div className="flex-1">
                    <span className="text-[8px] md:text-[9px] font-bold bg-red-200 text-red-600 px-2 py-1 rounded inline-block mb-2 md:mb-3">DELETED</span>
                    <p className="text-xl md:text-2xl font-black italic mb-2 line-through text-gray-400">"{p.title}"</p>
                    <p className="text-[10px] md:text-xs text-gray-400 font-bold">삭제일: {new Date(p.deleted_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => restorePost(p.id)} className="flex-1 md:flex-none px-4 py-3 md:px-6 md:py-4 bg-green-500 text-white font-black text-[10px] md:text-xs rounded-2xl hover:bg-green-600 transition-all shadow-lg">♻️ 복구</button>
                    <button onClick={() => hardDeletePost(p.id)} className="flex-1 md:flex-none px-4 py-3 md:px-6 md:py-4 bg-black text-white font-black text-[10px] md:text-xs rounded-2xl hover:bg-gray-800 transition-all shadow-lg">🔥 영구 삭제</button>
                  </div>
                </div>
              )) : <div className="text-center py-20 text-gray-300 font-bold text-xs">휴지통이 비었습니다.</div>}
            </div>
          </div>
        )}

        {/* 5. 댓글 검토 */}
        {activeTab === 'AUDIT' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">댓글 검토</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">모든 피드백 모니터링</p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:gap-6">
              {allComments.length > 0 ? allComments.map(c => (
                <div key={c.id} className="p-6 md:p-10 bg-white border-2 border-gray-50 rounded-[2rem] md:rounded-[3.5rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-6">
                  <div className="max-w-full md:max-w-[70%]">
                    <div className="flex items-center gap-3 mb-3">
                        <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[8px] md:text-[10px] font-black">{c.nickname || '익명'}</span>
                        <span className="text-[8px] md:text-[10px] font-black text-gray-300 uppercase tracking-widest">TO: {c.memo_title}</span>
                    </div>
                    <p className="text-xl md:text-2xl font-black italic text-gray-800 break-keep">"{c.content}"</p>
                    <p className="text-[10px] md:text-xs text-gray-400 mt-3 font-bold">{new Date(c.created_at).toLocaleString()}</p>
                  </div>
                  <button onClick={async () => { if(confirm('영구 삭제?')) { await supabase.from('comments').delete().eq('id', c.id); fetchAllData(); } }} className="w-full md:w-auto px-6 py-3 md:px-8 md:py-4 bg-gray-50 text-red-500 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition-all">삭제</button>
                </div>
              )) : <div className="text-center py-40 text-gray-300 font-black text-sm">댓글 없음</div>}
            </div>
          </div>
        )}

        {/* 6. 유입 경로 */}
        {activeTab === 'TRAFFIC' && (
          <div className="animate-in fade-in duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">유입 경로</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">최근 100건 분석</p>
            </div>
            <div className="h-[60vh] md:h-[70vh] overflow-y-auto pr-2 md:pr-4 space-y-4 scroll-smooth">
              {referrers.length > 0 ? referrers.map((r, i) => {
                 const info = parseReferrer(r.referrer);
                 return (
                   <div key={i} className="flex justify-between items-center p-6 md:p-8 bg-gray-50 rounded-[2rem] md:rounded-[2.5rem] border border-gray-100 hover:bg-white hover:shadow-lg transition-all">
                     <div className="flex items-center gap-4 md:gap-6">
                       <span className="text-2xl md:text-4xl filter drop-shadow-sm">{info.icon}</span>
                       <div>
                         <p className={`font-black text-xs md:text-sm mb-1 ${info.color}`}>{info.label}</p>
                         <p className="text-[8px] md:text-[10px] text-gray-400 truncate max-w-[120px] md:max-w-md">{r.referrer || 'URL 정보 없음'}</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-[8px] md:text-[10px] font-black text-black bg-gray-100 px-2 py-1 rounded inline-block mb-1">{r.ip_address || '-'}</p>
                       <p className="text-[8px] md:text-[10px] font-black text-indigo-500 mb-1">{r.user_agent?.includes('Mobile') ? '📱' : '💻'}</p>
                       <p className="text-[8px] md:text-[10px] font-black text-gray-300 mt-1">{new Date(r.created_at).toLocaleDateString()}</p>
                     </div>
                   </div>
                 );
              }) : <div className="text-center py-20 text-gray-300 font-bold">로그 없음</div>}
            </div>
          </div>
        )}

        {/* 7. 설정 */}
        {activeTab === 'CONFIG' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-8 md:space-y-10">
            <div>
              <h2 className="text-3xl md:text-6xl font-black italic tracking-tighter mb-2 md:mb-4">설정</h2>
              <p className="text-xs md:text-base text-gray-400 font-bold">시스템 제어</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 md:gap-12">
              <div className="bg-gray-50 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-gray-100 shadow-sm space-y-6 md:space-y-10">
                <h3 className="text-lg md:text-2xl font-black italic text-indigo-600 uppercase border-b pb-4 border-gray-200">기본 설정</h3>
                <div>
                  <label className="text-[10px] md:text-xs font-black text-gray-400 mb-2 md:mb-3 block uppercase tracking-wider">운영자 닉네임</label>
                  <input value={nickname} onChange={(e) => setNickname(e.target.value)} className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 md:px-8 md:py-5 font-black outline-none text-sm" />
                  <button onClick={() => { localStorage.setItem('blog_nickname', nickname); alert('✅ 저장됨'); }} className="mt-2 text-[10px] font-black text-indigo-500 hover:underline">💾 브라우저에 저장</button>
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-black text-gray-400 mb-2 md:mb-3 block uppercase tracking-wider">🔥 HOT 기준 (좋아요)</label>
                  <div className="flex items-center gap-4">
                    <input type="number" value={config.hot_threshold} onChange={(e) => setConfig({...config, hot_threshold: Number(e.target.value)})} className="w-20 bg-white border border-gray-200 rounded-2xl px-4 py-4 md:px-6 md:py-5 font-black outline-none text-center text-lg md:text-xl" />
                    <span className="text-xs font-bold text-gray-400">개 이상</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-black text-gray-400 mb-2 md:mb-3 block uppercase tracking-wider">📢 공지사항</label>
                  <input value={config.notice_text} onChange={(e) => setConfig({...config, notice_text: e.target.value})} className="w-full bg-white border border-gray-200 rounded-2xl px-6 py-4 md:px-8 md:py-5 font-black outline-none text-sm" placeholder="비우면 숨김" />
                </div>
                <div>
                  <label className="text-[10px] md:text-xs font-black text-gray-400 mb-2 md:mb-3 block uppercase tracking-wider text-indigo-500">⏳ 타임라인 카테고리</label>
                  <input value={config.timeline_category} onChange={(e) => setConfig({...config, timeline_category: e.target.value})} className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-6 py-4 md:px-8 md:py-5 font-black outline-none text-sm" placeholder="예: 소설" />
                </div>
                <button onClick={saveConfig} className="w-full bg-black text-white py-4 md:py-6 rounded-3xl font-black text-xs md:text-sm uppercase hover:bg-indigo-600 transition-all shadow-xl">설정 저장</button>
              </div>

              <div className="bg-gray-50 p-6 md:p-12 rounded-[2rem] md:rounded-[4rem] border border-gray-100 shadow-sm h-fit">
                <h3 className="text-lg md:text-2xl font-black mb-6 md:mb-10 italic uppercase border-b pb-4 border-gray-200">카테고리</h3>
                <div className="flex gap-2 md:gap-4 mb-6 md:mb-10">
                  <input value={newCat} onChange={(e) => setNewCat(e.target.value)} className="flex-1 bg-white border border-gray-200 rounded-2xl px-6 py-4 md:px-8 md:py-5 font-black text-xs md:text-sm outline-none" placeholder="새 카테고리" />
                  <button onClick={async () => { if(newCat.trim()) { await supabase.from('categories').insert([{name: newCat}]); setNewCat(''); fetchAllData(); } }} className="bg-black text-white px-6 md:px-8 rounded-2xl font-black text-xs uppercase hover:bg-gray-800 transition-all">생성</button>
                </div>
                <div className="flex flex-wrap gap-2 md:gap-3">
                  {categories.map(c => (
                    <div key={c.id} className="p-3 md:p-4 bg-white rounded-2xl border border-gray-100 flex items-center gap-2 md:gap-3 group hover:bg-black transition-all">
                      <span className="font-black text-[10px] group-hover:text-white"># {c.name}</span>
                      <button onClick={async () => { if(confirm('삭제?')) { await supabase.from('categories').delete().eq('id', c.id); fetchAllData(); } }} className="text-gray-300 font-black text-[10px] hover:text-red-500">✕</button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
      <style jsx global>{` .no-scrollbar::-webkit-scrollbar { display: none; } `}</style>
    </div>
  );
}