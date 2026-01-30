'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import SpriteText from 'three-spritetext';

// 3D 라이브러리 (SSR 제외)
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function KnowledgeNexusFinalV9() {
  const router = useRouter();
  
  // 1. 초기값 null 설정
  const graphRef = useRef<any>(null);

  // 2. 데이터 상태
  const [memos, setMemos] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // 3. 뷰 상태
  const [selectedCat, setSelectedCat] = useState('전체');
  
  // ⏳ 타임라인 타겟을 배열(Array)로 변경하여 다중 선택 지원
  const [timelineTargets, setTimelineTargets] = useState<string[]>([]); 
  const [isTimelineMode, setIsTimelineMode] = useState(false);

  // 4. 그래프 데이터 계산
  const graphData = useMemo(() => {
    const filteredNodes = memos.filter(m => selectedCat === '전체' || m.category_name === selectedCat);
    
    const nodes = filteredNodes.map(m => ({ 
      id: m.id, 
      name: m.title, 
      group: m.category_name,
      val: 1 
    }));

    const links: any[] = [];
    
    filteredNodes.forEach((m1, i) => {
      filteredNodes.forEach((m2, j) => {
        if (i < j && m1.category_name === m2.category_name) {
          links.push({ source: m1.id, target: m2.id });
        }
      });
    });

    return { nodes, links };
  }, [memos, selectedCat]);

  // ✅ 데이터 로드
  useEffect(() => {
    const fetchData = async () => {
      // (1) 설정 가져오기
      const { data: conf } = await supabase.from('blog_config').select('timeline_category').single();
      if (conf && conf.timeline_category) {
        const targets = conf.timeline_category.split(',').map((s: string) => s.trim());
        setTimelineTargets(targets);
      }

      // (2) 카테고리
      const { data: catList } = await supabase.from('categories').select('*');
      if (catList) setCategories(catList);

      // (3) 글 목록
      const { data: memoList } = await supabase
        .from('memos')
        .select('id, title, category_name, created_at, series_name, series_order')
        .eq('is_draft', false);

      if (memoList) setMemos(memoList);
    };

    fetchData();
  }, []);

  // ✅ 모드 자동 전환
  useEffect(() => {
    if (timelineTargets.includes(selectedCat)) {
      setIsTimelineMode(true);
    } else {
      setIsTimelineMode(false);
    }
  }, [selectedCat, timelineTargets]);

  // ✅ 타임라인 정렬
  const timelineMemos = useMemo(() => {
    return memos
      .filter(m => m.category_name === selectedCat)
      .sort((a, b) => (a.series_order || 0) - (b.series_order || 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [memos, selectedCat]);


  return (
    <div className="min-h-screen bg-black text-white p-0 overflow-hidden relative font-sans select-none">
      
      {/* 🔙 뒤로가기 버튼 */}
      <button 
        onClick={() => router.push('/')} 
        className="fixed top-6 left-6 md:top-10 md:left-10 text-[10px] font-black tracking-[0.3em] text-gray-500 hover:text-white z-50 transition-colors flex items-center gap-2"
      >
        <span>←</span> 메인으로
      </button>
      
      {/* 🔮 배경 효과 */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] md:w-[800px] md:h-[800px] bg-indigo-900 rounded-full blur-[150px] md:blur-[200px] animate-pulse" />
      </div>

      {/* 🧭 구역 선택 */}
      <div className="fixed left-6 right-6 top-20 md:left-10 md:top-1/2 md:-translate-y-1/2 md:right-auto z-50 flex flex-row md:flex-col gap-4 overflow-x-auto md:overflow-visible pb-2 md:pb-0 no-scrollbar items-center md:items-start">
        <div className="text-[8px] font-bold text-gray-600 tracking-[0.3em] uppercase mb-0 md:mb-2 hidden md:block">구역 탐색</div>
        
        <button 
          onClick={() => setSelectedCat('전체')}
          className={`shrink-0 text-left text-[10px] font-black tracking-[0.2em] transition-all px-4 py-2 md:p-0 rounded-full md:rounded-none border md:border-none ${
            selectedCat === '전체' 
              ? 'text-white border-white bg-white/10 md:bg-transparent md:scale-110' 
              : 'text-gray-600 border-gray-800 hover:text-gray-300'
          }`}
        >
          ● 전체 보기
        </button>

        {categories.map(c => (
          <button 
            key={c.id}
            onClick={() => setSelectedCat(c.name)}
            className={`shrink-0 text-left text-[10px] font-black tracking-[0.2em] transition-all flex items-center gap-2 px-4 py-2 md:p-0 rounded-full md:rounded-none border md:border-none ${
              selectedCat === c.name 
                ? 'text-indigo-400 border-indigo-500 bg-indigo-900/20 md:bg-transparent md:scale-110' 
                : 'text-gray-600 border-gray-800 hover:text-gray-300'
            }`}
          >
            <span>● {c.name}</span>
            {timelineTargets.includes(c.name) && <span className="text-[8px] bg-indigo-900/80 px-1.5 py-0.5 rounded text-white ml-1">연대기</span>}
          </button>
        ))}
      </div>

      {/* 📺 메인 뷰포트 */}
      <div className="absolute inset-0 z-10">
        
        {/* Case A: 타임라인 모드 */}
        {isTimelineMode ? (
          <div className="w-full h-full overflow-y-auto p-6 pt-36 md:p-20 md:pt-40 bg-black/90 backdrop-blur-sm animate-in fade-in duration-1000">
            <div className="max-w-4xl mx-auto border-l-2 border-indigo-900/50 pl-8 md:pl-20 py-10 space-y-16 md:space-y-20">
              
              <div className="mb-12 md:mb-20">
                <div className="flex flex-col md:flex-row md:items-end gap-4 mb-4">
                  <h2 className="text-4xl md:text-6xl font-black italic tracking-tighter text-white">"{selectedCat}" 연대기</h2>
                  
                  {/* 🆕 [NEW] 인물 열람실 입장 버튼 (타임라인 모드일 때만 등장) */}
                  <button 
                    onClick={() => router.push('/characters')}
                    className="flex items-center gap-2 px-4 py-2 rounded-full border border-red-600/50 bg-red-900/20 text-red-500 hover:bg-red-600 hover:text-white transition-all group w-fit"
                  >
                    <span className="text-lg">👥</span>
                    <span className="text-xs font-black tracking-widest uppercase">기밀 인물 파일 열람</span>
                    <span className="group-hover:translate-x-1 transition-transform">→</span>
                  </button>
                </div>
                <p className="text-[10px] font-bold text-gray-500 tracking-[0.5em]">TIMELINE_SEQUENCE_VIEW</p>
              </div>

              {timelineMemos.map((node, i) => (
                <div 
                  key={node.id} 
                  onClick={() => router.push(`/post/${node.id}`)}
                  className="relative group cursor-pointer"
                >
                  {/* 타임라인 점 */}
                  <div className="absolute -left-[41px] md:-left-[89px] top-2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-black border-2 border-indigo-600 group-hover:bg-indigo-500 group-hover:scale-150 transition-all z-20" />
                  <div className="absolute -left-[41px] md:-left-[89px] top-2 w-3 h-3 md:w-4 md:h-4 rounded-full bg-indigo-500 animate-ping opacity-0 group-hover:opacity-100" />

                  {/* 카드 디자인 */}
                  <div className="p-6 md:p-10 border border-white/5 bg-white/5 rounded-[2rem] hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all duration-500 group-hover:-translate-y-2">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[8px] font-black text-indigo-400 tracking-widest uppercase">
                        {node.series_name ? `제 ${node.series_order}화` : `기록 #${i + 1}`}
                      </span>
                      <span className="text-[8px] font-bold text-gray-600 tracking-widest">
                        {new Date(node.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-2xl md:text-3xl font-black text-gray-300 group-hover:text-white transition-all italic tracking-tighter mb-4">
                      "{node.title}"
                    </h3>
                    <p className="text-[9px] font-bold text-gray-600 group-hover:text-indigo-400 tracking-[0.2em] transition-colors">
                      열람하기 →
                    </p>
                  </div>
                </div>
              ))}
              
              {timelineMemos.length === 0 && (
                <div className="text-gray-600 text-xs font-mono">이 연대기에 기록된 데이터가 없습니다.</div>
              )}
            </div>
          </div>
        ) : (
          /* Case B: 3D 그래프 모드 */
          <div className="w-full h-full cursor-move">
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              backgroundColor="#00000000"
              nodeLabel="name"
              
              // 노드 스타일
              nodeColor={node => timelineTargets.includes((node as any).group) ? '#818cf8' : '#ffffff'}
              nodeRelSize={6}
              
              // 텍스트 스프라이트
              nodeThreeObjectExtend={true}
              nodeThreeObject={(node: any) => {
                const sprite = new SpriteText(node.name);
                sprite.color = timelineTargets.includes((node as any).group) ? '#818cf8' : 'rgba(255,255,255,0.6)';
                sprite.textHeight = 4;
                (sprite as any).position.y = -12; // 위치 조정
                return sprite;
              }}

              linkColor={() => '#ffffff20'}
              linkWidth={1}
              linkOpacity={0.3}
              
              // 인터랙션
              onNodeClick={(node: any) => {
                const distance = 40;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
                if (graphRef.current) {
                  graphRef.current.cameraPosition(
                    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                    node,
                    2000 // 부드러운 이동 (2초)
                  );
                }
                setTimeout(() => router.push(`/post/${node.id}`), 1000);
              }}
              onNodeHover={(node: any) => {
                document.body.style.cursor = node ? 'pointer' : 'default';
              }}
            />
            
            {memos.length === 0 && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                 <p className="text-xs text-gray-600 font-mono animate-pulse">데이터 로딩 중...</p>
               </div>
            )}
          </div>
        )}
      </div>

      {/* 🏷️ 하단 타이틀 */}
      <div className="fixed bottom-6 right-6 md:bottom-10 md:right-10 text-right z-50 pointer-events-none">
        <h2 className="text-2xl md:text-4xl font-black italic tracking-tighter mb-1 md:mb-2 uppercase">세계관 지도</h2>
        <p className="text-[8px] md:text-[9px] font-bold text-gray-500 tracking-[0.5em]">
          {isTimelineMode ? 'TIMELINE_MODE' : 'NEURAL_NETWORK'}
        </p>
      </div>
    </div>
  );
}