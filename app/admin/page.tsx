'use client'

import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Supabase 클라이언트 연결
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co', 
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function SuperAdminFinalExpanded() {
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
  const [deletedPosts, setDeletedPosts] = useState<any[]>([]); // 휴지통 데이터
  
  // ⚙️ 설정 상태
  const [nickname, setNickname] = useState('관리자');
  const [newCat, setNewCat] = useState('');
  const [config, setConfig] = useState({ 
    hot_threshold: 5, 
    notice_text: '',
    timeline_category: '' // ⏳ 넥서스 타임라인 설정용
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

  // ✅ 2. 모든 데이터 가져오기 (댓글 버그 수정판)
  const fetchAllData = async () => {
    try {
        // (1) 통계 카운트 (삭제되지 않은 글만 카운트)
        const { count: pCount } = await supabase.from('memos').select('*', { count: 'exact', head: true }).is('deleted_at', null);
        const { count: cCount } = await supabase.from('comments').select('*', { count: 'exact', head: true });
        
        let vCount = 0;
        try { 
          const { count } = await supabase.from('visits').select('*', { count: 'exact', head: true }); 
          vCount = count || 0; 
        } catch (e) {
          console.log('방문자 테이블 없음 (무시)');
        }

        // (2) 글 목록 가져오기 (활성 글)
        const { data: list } = await supabase
          .from('memos')
          .select('*')
          .is('deleted_at', null)
          .order('created_at', { ascending: false });
        
        // (3) 휴지통 목록 가져오기 (삭제된 글)
        const { data: trash } = await supabase
          .from('memos')
          .select('*')
          .not('deleted_at', 'is', null)
          .order('deleted_at', { ascending: false });

        // (4) 댓글 가져오기 (Raw Data)
        const { data: cData } = await supabase.from('comments').select('*').order('created_at', { ascending: false });
        const rawComments = cData || [];

        // (5) 기타 데이터
        const { data: cats } = await supabase.from('categories').select('*').order('created_at', { ascending: true });
        const { data: ref } = await supabase.from('visits').select('*').order('created_at', { ascending: false }).limit(100);
        const { data: conf } = await supabase.from('blog_config').select('*').single();
        
        const activeMemos = list || [];

        // 🚨 [핵심 버그 수정] 댓글에 글 제목 강제 매핑 (JS Join)
        // DB Foreign Key가 없어도 코드단에서 연결해줌
        const mappedComments = rawComments.map((c: any) => {
          // 활성 글 또는 휴지통 글에서 제목 찾기
          const targetMemo = activeMemos.find((m: any) => m.id === c.memo_id) || (trash || []).find((m: any) => m.id === c.memo_id);
          return {
            ...c,
            memo_title: targetMemo ? targetMemo.title : '🚫 완전 삭제된 글'
          };
        });

        // 총 좋아요 수 계산
        const totalLikesSum = activeMemos.reduce((acc: number, cur: any) => acc + (cur.likes || 0), 0);

        // 상태 업데이트
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
            timeline_category: conf.timeline_category ?? '' // DB값 로드
          });
        }

    } catch (e) {
        console.error("데이터 로딩 중 치명적 에러:", e);
    }
  };

  // ✅ 3. 시리즈 정보 업데이트 (저장)
  const updateSeriesInfo = async (id: number, sName: string, sOrder: number) => {
    const nameToSave = sName.trim() === '' ? null : sName;
    
    await supabase.from('memos').update({ 
      series_name: nameToSave, 
      series_order: sOrder 
    }).eq('id', id);

    fetchAllData(); 
  };

  // ✅ 4. 설정 저장 (타임라인 카테고리 포함)
  const saveConfig = async () => {
    const { error } = await supabase.from('blog_config').update(config).eq('id', 1);
    
    if(error) {
      await supabase.from('blog_config').insert([{ id: 1, ...config }]);
    }
    
    alert("✅ 시스템 설정이 저장되었습니다.");
  };

  // ✅ 5. 유입 경로 아이콘 및 텍스트 처리
  const parseReferrer = (ref: string) => {
    if (!ref || ref.includes('direct') || ref === '') {
      return { icon: '🏠', label: '직접 접속 (Direct)', color: 'text-gray-500' };
    }
    if (ref.includes('google')) return { icon: '🇬', label: 'Google 검색', color: 'text-blue-500' };
    if (ref.includes('naver')) return { icon: '🇳', label: 'Naver 검색', color: 'text-green-500' };
    if (ref.includes('daum')) return { icon: '🇩', label: 'Daum 검색', color: 'text-blue-400' };
    if (ref.includes('kakao')) return { icon: '🟡', label: '카카오톡', color: 'text-yellow-500' };
    if (ref.includes('instagram')) return { icon: '📷', label: '인스타그램', color: 'text-pink-500' };
    if (ref.includes('facebook')) return { icon: '📘', label: '페이스북', color: 'text-blue-600' };
    if (ref.includes('twitter') || ref.includes('x.com')) return { icon: '✖️', label: 'X (Twitter)', color: 'text-black' };
    
    return { icon: '🔗', label: '기타 유입', color: 'text-indigo-500' };
  };

  // ✅ 6. 삭제/복구 기능들
  
  // 6-1. 임시 삭제 (휴지통으로 보내기)
  const softDeletePost = async (id: number) => {
    if(confirm('이 글을 휴지통으로 이동하시겠습니까?')) {
      await supabase.from('memos').update({ deleted_at: new Date().toISOString() }).eq('id', id);
      fetchAllData();
    }
  };

  // 6-2. 글 복구 (휴지통 -> 활성)
  const restorePost = async (id: number) => {
    if(confirm('이 글을 다시 게시하겠습니까?')) {
      await supabase.from('memos').update({ deleted_at: null }).eq('id', id);
      fetchAllData();
    }
  };

  // 6-3. 완전 삭제 (DB에서 영구 제거)
  const hardDeletePost = async (id: number) => {
    if(confirm('⚠️ 경고: 정말로 영구 삭제하시겠습니까?\n이 작업은 되돌릴 수 없습니다.')) {
      await supabase.from('memos').delete().eq('id', id);
      fetchAllData();
    }
  };

  // 로딩 화면
  if (!isAdmin) return (
    <div className="h-screen bg-black text-white flex flex-col items-center justify-center font-mono">
      <div className="animate-spin text-4xl mb-4">⚙️</div>
      <p className="text-xl font-bold mb-8">Loading System...</p>
      <button onClick={() => router.push('/')} className="px-6 py-3 bg-white text-black rounded-full font-bold hover:bg-gray-300">
        홈으로 돌아가기
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-white text-black font-sans flex selection:bg-indigo-600 selection:text-white">
      
      {/* 🟢 사이드바 메뉴 */}
      <aside className="w-80 border-r border-gray-100 h-screen sticky top-0 flex flex-col p-8 bg-[#fcfcfc] z-50">
        <div className="mb-16">
          <div className="flex items-center gap-2 mb-4">
            <span className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></span>
            <span className="text-[10px] font-black text-indigo-600 tracking-widest uppercase">SYSTEM ONLINE</span>
          </div>
          <h1 className="text-3xl font-black italic tracking-tighter">
            관리<span className="text-indigo-600">페이지</span>
          </h1>
          <button onClick={() => router.push('/')} className="mt-6 flex items-center gap-3 text-[10px] font-black text-gray-400 hover:text-black transition-all group">
            <span className="group-hover:-translate-x-1 transition-transform">←</span> 메인 화면으로 돌아가기
          </button>
        </div>

        <nav className="flex-1 space-y-4">
          {[
            { id: 'DASHBOARD', l: '📊 운영 현황', d: '요약 지표 확인' },
            { id: 'SERIES', l: '📚 시리즈 관리', d: '연재 순서 정리' },
            { id: 'DATABASE', l: '🗄️ 게시글 관리', d: '수정 및 삭제' },
            { id: 'TRASH', l: '🗑️ 휴지통', d: '삭제된 글 복구' }, // ✨ NEW
            { id: 'AUDIT', l: '💬 댓글 검토', d: '피드백 모니터링' },
            { id: 'TRAFFIC', l: '📡 유입 경로', d: 'IP 및 로그 분석' },
            { id: 'CONFIG', l: '⚙️ 시스템 설정', d: 'HOT 기준 / 공지' }
          ].map((menu) => (
            <button 
              key={menu.id} 
              onClick={() => setActiveTab(menu.id)} 
              className={`w-full text-left p-6 rounded-[2rem] transition-all border group relative overflow-hidden ${
                activeTab === menu.id 
                  ? 'bg-black text-white border-black shadow-2xl scale-105' 
                  : 'bg-white border-gray-100 text-gray-400 hover:border-black hover:text-black'
              }`}
            >
              <p className="font-black text-sm mb-1 relative z-10">{menu.l}</p>
              <p className={`text-[8px] font-bold relative z-10 ${activeTab === menu.id ? 'text-white/30' : 'text-gray-200 group-hover:text-gray-400'}`}>
                {menu.d}
              </p>
            </button>
          ))}
        </nav>
        
        <div className="mt-auto pt-8 border-t border-gray-100">
           <p className="text-[9px] font-bold text-gray-300 text-center">INSIGHT.X ADMIN v2.0</p>
        </div>
      </aside>

      {/* 🚀 메인 작업 영역 */}
      <main className="flex-1 p-12 md:p-20 overflow-y-auto relative bg-[url('https://www.transparenttextures.com/patterns/grid-me.png')]">
        
        {/* 1. 운영 현황 (Dashboard) */}
        {activeTab === 'DASHBOARD' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-12">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">운영 현황</h2>
              <p className="text-gray-400 font-bold">블로그의 현재 상태를 한눈에 확인하세요.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
              {[ 
                { l:'총 방문자', v: stats.visits, c: 'text-black' }, 
                { l:'발행된 글', v: stats.posts, c: 'text-indigo-600' }, 
                { l:'전체 댓글', v: stats.comments, c: 'text-blue-500' }, 
                { l:'총 좋아요', v: stats.totalLikes, c: 'text-red-500' } 
              ].map((s, i) => (
                <div key={i} className="bg-white p-10 rounded-[3rem] border-2 border-gray-50 shadow-xl hover:-translate-y-2 transition-transform">
                  <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-6">{s.l}</p>
                  <div className={`text-6xl font-black italic tracking-tighter ${s.c}`}>
                    {s.v.toLocaleString()}
                  </div>
                </div>
              ))}
            </div>
            
            {/* 최근 댓글 미리보기 (버그 수정됨) */}
            <div className="bg-white p-12 rounded-[3rem] border border-gray-100 shadow-sm">
              <div className="flex justify-between items-center mb-8">
                <h3 className="text-2xl font-black italic">💬 최신 피드백 (Top 5)</h3>
                <button onClick={() => setActiveTab('AUDIT')} className="text-xs font-bold text-indigo-500 hover:underline">전체보기 →</button>
              </div>
              <div className="space-y-4">
                {allComments.length > 0 ? allComments.slice(0, 5).map(c => (
                  <div key={c.id} className="flex justify-between items-center p-6 bg-gray-50 rounded-3xl">
                    <div className="flex items-center gap-4 overflow-hidden">
                       <span className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center font-black text-xs shrink-0">
                         {c.nickname ? c.nickname.slice(0,1) : '익'}
                       </span>
                       <span className="truncate font-bold text-gray-600 text-sm">"{c.content}"</span>
                    </div>
                    <div className="flex flex-col items-end gap-1 shrink-0">
                      <span className="text-[10px] font-black text-indigo-400">{c.memo_title}</span>
                      <span className="text-[9px] text-gray-300">{new Date(c.created_at).toLocaleDateString()}</span>
                    </div>
                  </div>
                )) : (
                  <div className="text-center py-10 text-gray-300 font-bold">아직 등록된 댓글이 없습니다.</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 2. 시리즈 관리 (Series) */}
        {activeTab === 'SERIES' && (
          <div className="animate-in fade-in duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">시리즈 관리</h2>
              <p className="text-gray-400 font-bold">같은 주제의 글들을 묶어서 순서대로 연재하세요.</p>
            </div>
            
            {/* 카테고리 필터 */}
            <div className="flex gap-4 overflow-x-auto pb-4 no-scrollbar">
              {['전체', ...categories.map(c => c.name)].map(c => (
                <button 
                  key={c} 
                  onClick={() => setSeriesTargetCat(c)} 
                  className={`px-6 py-3 rounded-full font-black text-xs border whitespace-nowrap transition-all ${
                    seriesTargetCat === c ? 'bg-black text-white border-black' : 'bg-white text-gray-400 border-gray-200 hover:border-black'
                  }`}
                >
                  {c}
                </button>
              ))}
            </div>

            <div className="space-y-4">
              {posts.filter(p => seriesTargetCat === '전체' || p.category_name === seriesTargetCat).map(p => (
                <div key={p.id} className="flex flex-col md:flex-row md:items-center gap-6 p-8 bg-white border border-gray-100 rounded-[2.5rem] hover:shadow-xl transition-all group">
                  
                  <div className="flex items-center gap-6 flex-1">
                    <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center font-black text-gray-300 shrink-0 text-xl">
                      {p.id}
                    </div>
                    <div className="overflow-hidden">
                      <p className="text-[10px] font-bold text-indigo-500 mb-1 uppercase tracking-wider">{p.category_name}</p>
                      <p className="text-xl font-black italic truncate">{p.title}</p>
                    </div>
                  </div>

                  <div className="flex flex-col md:flex-row gap-4 bg-gray-50 p-4 rounded-3xl">
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 mb-1">시리즈 이름 (예: 소설)</label>
                      <input 
                        placeholder="시리즈 없음" 
                        className="bg-white px-4 py-3 rounded-2xl text-xs font-bold w-full md:w-48 outline-none focus:ring-2 focus:ring-indigo-100 transition-all border border-transparent focus:border-indigo-200"
                        defaultValue={p.series_name || ''}
                        onBlur={(e) => updateSeriesInfo(p.id, e.target.value, p.series_order)}
                      />
                    </div>
                    <div className="flex flex-col">
                      <label className="text-[9px] font-bold text-gray-400 ml-2 mb-1">순서 (숫자)</label>
                      <input 
                        type="number"
                        placeholder="1" 
                        className="bg-white px-4 py-3 rounded-2xl text-xs font-bold w-full md:w-20 outline-none focus:ring-2 focus:ring-indigo-100 transition-all border border-transparent focus:border-indigo-200"
                        defaultValue={p.series_order || 1}
                        onBlur={(e) => updateSeriesInfo(p.id, p.series_name, Number(e.target.value))}
                      />
                    </div>
                  </div>

                </div>
              ))}
              {posts.length === 0 && <p className="text-center py-20 text-gray-300 font-bold">등록된 글이 없습니다.</p>}
            </div>
          </div>
        )}

        {/* 3. 게시글 관리 (Database) - 휴지통 기능 연결됨 */}
        {activeTab === 'DATABASE' && (
          <div className="animate-in fade-in duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">게시글 보관소</h2>
              <p className="text-gray-400 font-bold">모든 글을 조회하고 관리합니다.</p>
            </div>

            <div className="space-y-4">
              {posts.map(p => (
                <div key={p.id} className="flex justify-between items-center p-8 bg-white border border-gray-100 rounded-[3rem] group hover:border-black transition-all">
                  <div className="flex-1">
                    <span className={`text-[9px] font-bold px-3 py-1 rounded-full mb-3 inline-block tracking-wide ${p.is_draft ? 'bg-yellow-100 text-yellow-600' : 'bg-blue-50 text-blue-600'}`}>
                      {p.is_draft ? '🟡 DRAFT (임시저장)' : '🔵 PUBLISHED (발행됨)'}
                    </span>
                    <p className="text-2xl font-black italic mb-2">"{p.title}"</p>
                    <div className="flex gap-4 text-xs text-gray-400 font-bold items-center">
                       <span className="flex items-center gap-1">👁️ {p.views || 0}</span>
                       <span className="flex items-center gap-1">❤️ {p.likes || 0}</span>
                       <span className="flex items-center gap-1 text-indigo-400">
                         {p.series_name ? `📚 ${p.series_name} #${p.series_order}` : ''}
                       </span>
                    </div>
                  </div>
                  <button 
                    onClick={() => softDeletePost(p.id)} 
                    className="px-8 py-4 text-red-500 font-black text-xs border border-red-50 rounded-2xl hover:bg-red-500 hover:text-white transition-all shadow-sm hover:shadow-red-200"
                  >
                    🗑️ 휴지통
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ✨ 4. [NEW] 휴지통 관리 (Trash) */}
        {activeTab === 'TRASH' && (
          <div className="animate-in fade-in duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4 text-red-500">휴지통</h2>
              <p className="text-gray-400 font-bold">삭제된 글들이 여기에 보관됩니다. 복구하거나 영구 삭제하세요.</p>
            </div>

            <div className="space-y-4">
              {deletedPosts.length > 0 ? deletedPosts.map(p => (
                <div key={p.id} className="flex justify-between items-center p-8 bg-red-50 border border-red-100 rounded-[3rem] opacity-80 hover:opacity-100 transition-all">
                  <div className="flex-1">
                    <span className="text-[9px] font-bold bg-red-200 text-red-600 px-2 py-1 rounded inline-block mb-3">
                      DELETED
                    </span>
                    <p className="text-2xl font-black italic mb-2 line-through text-gray-400">"{p.title}"</p>
                    <p className="text-xs text-gray-400 font-bold">
                       삭제일: {new Date(p.deleted_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => restorePost(p.id)} 
                      className="px-6 py-4 bg-green-500 text-white font-black text-xs rounded-2xl hover:bg-green-600 transition-all shadow-lg"
                    >
                      ♻️ 복구
                    </button>
                    <button 
                      onClick={() => hardDeletePost(p.id)} 
                      className="px-6 py-4 bg-black text-white font-black text-xs rounded-2xl hover:bg-gray-800 transition-all shadow-lg"
                    >
                      🔥 영구 삭제
                    </button>
                  </div>
                </div>
              )) : (
                <div className="text-center py-20 text-gray-300 font-bold text-xl">
                  휴지통이 비어있습니다.
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. 댓글 검토 (Audit) - 버그 수정됨 */}
        {activeTab === 'AUDIT' && (
          <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">댓글 검토</h2>
              <p className="text-gray-400 font-bold">등록된 모든 피드백을 모니터링합니다.</p>
            </div>

            <div className="grid grid-cols-1 gap-6">
              {allComments.length > 0 ? allComments.map(c => (
                <div key={c.id} className="p-10 bg-white border-2 border-gray-50 rounded-[3.5rem] shadow-sm flex flex-col md:flex-row justify-between items-start md:items-center gap-6 group hover:border-indigo-600 transition-all">
                  <div className="max-w-full md:max-w-[70%]">
                    <div className="flex items-center gap-3 mb-3">
                       <span className="bg-indigo-100 text-indigo-600 px-3 py-1 rounded-full text-[10px] font-black">
                         {c.nickname || '익명'}
                       </span>
                       <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">
                         TO: {c.memo_title}
                       </span>
                    </div>
                    <p className="text-2xl font-black italic text-gray-800 break-keep">"{c.content}"</p>
                    <p className="text-xs text-gray-400 mt-3 font-bold">{new Date(c.created_at).toLocaleString()}</p>
                  </div>
                  <button 
                    onClick={async () => { 
                      if(confirm('이 댓글을 영구 삭제하시겠습니까?')) { 
                        await supabase.from('comments').delete().eq('id', c.id); 
                        fetchAllData(); 
                      } 
                    }} 
                    className="w-full md:w-auto px-8 py-4 bg-gray-50 text-red-500 rounded-2xl font-black text-xs hover:bg-red-600 hover:text-white transition-all"
                  >
                    영구 삭제
                  </button>
                </div>
              )) : (
                <div className="flex flex-col items-center justify-center py-40 border-2 border-dashed border-gray-100 rounded-[4rem]">
                  <p className="text-4xl mb-4">📭</p>
                  <p className="text-gray-300 font-black text-xl">등록된 댓글이 없습니다.</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 6. 유입 경로 (Traffic) - IP 추적 기능 적용 */}
        {activeTab === 'TRAFFIC' && (
          <div className="animate-in fade-in duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">유입 경로 & IP</h2>
              <p className="text-gray-400 font-bold">방문자들이 어디서 왔는지 분석합니다. (최근 100건)</p>
            </div>

            <div className="h-[70vh] overflow-y-auto pr-4 space-y-4 scroll-smooth">
              {referrers.length > 0 ? referrers.map((r, i) => {
                 const info = parseReferrer(r.referrer);
                 return (
                   <div key={i} className="flex justify-between items-center p-8 bg-gray-50 rounded-[2.5rem] border border-gray-100 hover:bg-white hover:shadow-lg transition-all">
                     <div className="flex items-center gap-6">
                       <span className="text-4xl filter drop-shadow-sm">{info.icon}</span>
                       <div>
                         <p className={`font-black text-sm mb-1 ${info.color}`}>{info.label}</p>
                         <p className="text-[10px] text-gray-400 truncate max-w-[200px] md:max-w-md">{r.referrer || 'URL 정보 없음'}</p>
                       </div>
                     </div>
                     <div className="text-right">
                       <p className="text-[10px] font-black text-black bg-gray-100 px-2 py-1 rounded inline-block mb-1">
                         {r.ip_address || 'IP 미수집'}
                       </p>
                       <p className="text-[10px] font-black text-indigo-500 mb-1">
                         {r.user_agent?.includes('Mobile') ? '📱 Mobile' : '💻 PC'}
                       </p>
                       <p className="text-[10px] font-black text-gray-300 mt-1">{new Date(r.created_at).toLocaleString()}</p>
                     </div>
                   </div>
                 );
               }) : (
                 <div className="text-center py-20 text-gray-300 font-bold">로그 데이터가 없습니다.</div>
               )}
            </div>
          </div>
        )}

        {/* 7. 시스템 설정 (Config) */}
        {activeTab === 'CONFIG' && (
          <div className="animate-in fade-in zoom-in-95 duration-500 space-y-10">
            <div>
              <h2 className="text-6xl font-black italic tracking-tighter mb-4">시스템 설정</h2>
              <p className="text-gray-400 font-bold">블로그의 핵심 기능을 제어합니다.</p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
              {/* 기본 설정 */}
              <div className="bg-gray-50 p-12 rounded-[4rem] border border-gray-100 shadow-sm space-y-10">
                <h3 className="text-2xl font-black italic text-indigo-600 uppercase border-b pb-4 border-gray-200">기본 설정</h3>
                
                <div>
                  <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-wider">운영자 닉네임 (관리자 표시용)</label>
                  <input 
                    value={nickname} 
                    onChange={(e) => setNickname(e.target.value)} 
                    className="w-full bg-white border border-gray-200 rounded-2xl px-8 py-5 font-black outline-none focus:ring-2 focus:ring-black transition-all" 
                  />
                  <button onClick={() => { localStorage.setItem('blog_nickname', nickname); alert('✅ 닉네임이 로컬에 저장되었습니다.'); }} className="mt-3 text-[10px] font-black text-indigo-500 hover:underline">💾 브라우저에 저장하기</button>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-wider">🔥 HOT 게시글 기준 (좋아요 수)</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="number" 
                      value={config.hot_threshold} 
                      onChange={(e) => setConfig({...config, hot_threshold: Number(e.target.value)})} 
                      className="w-24 bg-white border border-gray-200 rounded-2xl px-6 py-5 font-black outline-none text-center text-xl focus:ring-2 focus:ring-red-500 transition-all" 
                    />
                    <span className="text-xs font-bold text-gray-400">개 이상이면 HOT 배지 노출</span>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-wider">📢 메인 공지사항 (비우면 숨김)</label>
                  <input 
                    value={config.notice_text} 
                    onChange={(e) => setConfig({...config, notice_text: e.target.value})} 
                    className="w-full bg-white border border-gray-200 rounded-2xl px-8 py-5 font-black outline-none focus:ring-2 focus:ring-indigo-500 transition-all" 
                    placeholder="예: 이번 주 연재는 쉽니다." 
                  />
                </div>

                {/* ⏳ 타임라인 설정 (NEW) */}
                <div>
                  <label className="text-xs font-black text-gray-400 mb-3 block uppercase tracking-wider text-indigo-500">⏳ 넥서스 타임라인 카테고리</label>
                  <input 
                    value={config.timeline_category} 
                    onChange={(e) => setConfig({...config, timeline_category: e.target.value})} 
                    className="w-full bg-white border-2 border-indigo-100 rounded-2xl px-8 py-5 font-black outline-none focus:border-indigo-500 transition-all" 
                    placeholder="예: 소설" 
                  />
                  <p className="text-[9px] text-gray-400 mt-2 font-bold ml-2">* 해당 카테고리는 넥서스 페이지에서 타임라인 뷰로 표시됩니다.</p>
                </div>

                <button onClick={saveConfig} className="w-full bg-black text-white py-6 rounded-3xl font-black text-sm uppercase hover:bg-indigo-600 hover:scale-[1.02] transition-all shadow-xl">
                  설정 데이터베이스 저장
                </button>
              </div>

              {/* 카테고리 관리 */}
              <div className="bg-gray-50 p-12 rounded-[4rem] border border-gray-100 shadow-sm h-fit">
                <h3 className="text-2xl font-black mb-10 italic uppercase border-b pb-4 border-gray-200">카테고리 관리</h3>
                
                <div className="flex gap-4 mb-10">
                  <input 
                    value={newCat} 
                    onChange={(e) => setNewCat(e.target.value)} 
                    className="flex-1 bg-white border border-gray-200 rounded-2xl px-8 py-5 font-black text-sm outline-none focus:ring-2 focus:ring-black" 
                    placeholder="새 카테고리 이름" 
                  />
                  <button 
                    onClick={async () => { 
                      if(newCat.trim()) { 
                        await supabase.from('categories').insert([{name: newCat}]); 
                        setNewCat(''); 
                        fetchAllData(); 
                      } 
                    }} 
                    className="bg-black text-white px-8 rounded-2xl font-black text-xs uppercase hover:bg-gray-800 transition-all"
                  >
                    생성
                  </button>
                </div>

                <div className="flex flex-wrap gap-3">
                  {categories.map(c => (
                    <div key={c.id} className="p-4 bg-white rounded-2xl border border-gray-100 flex items-center gap-3 group hover:bg-black transition-all cursor-default">
                      <span className="font-black text-[10px] group-hover:text-white"># {c.name}</span>
                      <button 
                        onClick={async () => { 
                          if(confirm(`'${c.name}' 카테고리를 삭제하시겠습니까?`)) { 
                            await supabase.from('categories').delete().eq('id', c.id); 
                            fetchAllData(); 
                          } 
                        }} 
                        className="text-gray-300 font-black text-[10px] hover:text-red-500 transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                  {categories.length === 0 && <span className="text-xs text-gray-400 font-bold">등록된 카테고리가 없습니다.</span>}
                </div>
              </div>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}