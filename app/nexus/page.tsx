'use client'

import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';
import dynamic from 'next/dynamic';
import SpriteText from 'three-spritetext'; // 3D 텍스트 라이브러리

// 3D 그래프는 브라우저 전용 라이브러리라 dynamic import 사용
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), { ssr: false });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function KnowledgeNexusFull() {
  const router = useRouter();
  
  // 1. [수정됨] useRef에 초기값 null 부여 (TypeScript 오류 해결)
  const graphRef = useRef<any>(null);

  // 2. 데이터 상태
  const [memos, setMemos] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  
  // 3. 뷰 상태
  const [selectedCat, setSelectedCat] = useState('전체');
  const [timelineTarget, setTimelineTarget] = useState(''); // 관리자가 정한 타임라인 카테고리
  const [isTimelineMode, setIsTimelineMode] = useState(false);

  // 4. 그래프 데이터 (메모이제이션으로 성능 최적화)
  const graphData = useMemo(() => {
    // 선택된 카테고리에 맞는 노드만 필터링 (전체면 다 보여줌)
    const filteredNodes = memos.filter(m => selectedCat === '전체' || m.category_name === selectedCat);
    
    const nodes = filteredNodes.map(m => ({ 
      id: m.id, 
      name: m.title, 
      group: m.category_name,
      val: 1 
    }));

    const links: any[] = [];
    
    // 같은 카테고리끼리 연결선 만들기
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
      // (1) 설정 가져오기 (타임라인 카테고리 확인)
      const { data: conf } = await supabase.from('blog_config').select('timeline_category').single();
      if (conf) setTimelineTarget(conf.timeline_category || '');

      // (2) 카테고리 가져오기
      const { data: catList } = await supabase.from('categories').select('*');
      if (catList) setCategories(catList);

      // (3) 글 가져오기
      const { data: memoList } = await supabase
        .from('memos')
        .select('id, title, category_name, created_at, series_name, series_order')
        .eq('is_draft', false); // 발행된 글만

      if (memoList) setMemos(memoList);
    };

    fetchData();
  }, []);

  // ✅ 모드 자동 전환 (설정된 카테고리 클릭 시 타임라인으로)
  useEffect(() => {
    if (selectedCat === timelineTarget && timelineTarget !== '') {
      setIsTimelineMode(true);
    } else {
      setIsTimelineMode(false);
    }
  }, [selectedCat, timelineTarget]);

  // ✅ 타임라인용 정렬 데이터
  const timelineMemos = useMemo(() => {
    return memos
      .filter(m => m.category_name === selectedCat)
      .sort((a, b) => (a.series_order || 0) - (b.series_order || 0) || new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  }, [memos, selectedCat]);


  return (
    <div className="min-h-screen bg-black text-white p-0 overflow-hidden relative font-sans">
      
      {/* 🔙 1. 뒤로가기 (원본 스타일 유지) */}
      <button onClick={() => router.push('/')} className="fixed top-10 left-10 text-[10px] font-black tracking-[0.5em] text-gray-500 hover:text-white z-50 transition-colors">
        ← BACK_TO_BASE
      </button>
      
      {/* 🔮 2. 배경 효과 (원본 스타일 유지) */}
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-indigo-900 rounded-full blur-[200px] animate-pulse" />
      </div>

      {/* 🧭 3. 카테고리 네비게이터 (왼쪽 중앙에 배치) */}
      <div className="fixed left-10 top-1/2 -translate-y-1/2 z-50 flex flex-col gap-4">
        <div className="text-[8px] font-bold text-gray-600 tracking-[0.3em] uppercase mb-2">Sector Select</div>
        
        <button 
          onClick={() => setSelectedCat('전체')}
          className={`text-left text-[10px] font-black tracking-[0.2em] transition-all ${selectedCat === '전체' ? 'text-white scale-110' : 'text-gray-600 hover:text-gray-300'}`}
        >
          ● ALL_UNIVERSE
        </button>

        {categories.map(c => (
          <button 
            key={c.id}
            onClick={() => setSelectedCat(c.name)}
            className={`text-left text-[10px] font-black tracking-[0.2em] transition-all flex items-center gap-2 ${selectedCat === c.name ? 'text-indigo-400 scale-110' : 'text-gray-600 hover:text-gray-300'}`}
          >
            <span>● {c.name.toUpperCase()}</span>
            {c.name === timelineTarget && <span className="text-[8px] bg-indigo-900/50 px-1 rounded">TIME</span>}
          </button>
        ))}
      </div>

      {/* 📺 4. 메인 뷰포트 (3D Graph or Timeline) */}
      <div className="absolute inset-0 z-10">
        
        {/* Case A: 타임라인 모드 */}
        {isTimelineMode ? (
          <div className="w-full h-full overflow-y-auto p-20 pt-40 bg-black/80 backdrop-blur-sm animate-in fade-in duration-1000">
            <div className="max-w-4xl mx-auto border-l-2 border-indigo-900/50 pl-10 md:pl-20 py-10 space-y-20">
              
              <div className="mb-20">
                <h2 className="text-6xl font-black italic tracking-tighter text-white mb-4">"{selectedCat}" CHRONICLES</h2>
                <p className="text-[10px] font-bold text-gray-500 tracking-[0.5em]">SERIES_TIMELINE_VIEW</p>
              </div>

              {timelineMemos.map((node, i) => (
                <div 
                  key={node.id} 
                  onClick={() => router.push(`/post/${node.id}`)}
                  className="relative group cursor-pointer"
                >
                  {/* 타임라인 점 */}
                  <div className="absolute -left-[45px] md:-left-[85px] top-2 w-3 h-3 rounded-full bg-black border-2 border-indigo-600 group-hover:bg-indigo-500 group-hover:scale-150 transition-all z-20" />
                  <div className="absolute -left-[45px] md:-left-[85px] top-2 w-3 h-3 rounded-full bg-indigo-500 animate-ping opacity-0 group-hover:opacity-100" />

                  {/* 카드 디자인 */}
                  <div className="p-10 border border-white/5 bg-white/5 rounded-[2rem] hover:border-indigo-500/50 hover:bg-indigo-900/10 transition-all duration-500 group-hover:-translate-y-2">
                    <div className="flex justify-between items-start mb-4">
                      <span className="text-[8px] font-black text-indigo-400 tracking-widest uppercase">
                        {node.series_name ? `EPISODE ${node.series_order}` : `LOG ${i + 1}`}
                      </span>
                      <span className="text-[8px] font-bold text-gray-600 tracking-widest">
                        {new Date(node.created_at).toLocaleDateString()}
                      </span>
                    </div>
                    <h3 className="text-3xl font-black text-gray-300 group-hover:text-white transition-all italic tracking-tighter mb-4">
                      "{node.title}"
                    </h3>
                    <p className="text-[9px] font-bold text-gray-600 group-hover:text-indigo-400 tracking-[0.2em] transition-colors">
                      ACCESS_DATA →
                    </p>
                  </div>
                </div>
              ))}
              
              {timelineMemos.length === 0 && (
                <div className="text-gray-600 text-xs font-mono">NO DATA FOUND IN THIS TIMELINE.</div>
              )}
            </div>
          </div>
        ) : (
          /* Case B: 3D 그래프 모드 */
          <div className="w-full h-full cursor-move">
            <ForceGraph3D
              ref={graphRef}
              graphData={graphData}
              backgroundColor="#00000000" // 투명 배경
              nodeLabel="name"
              
              // 1. 구슬 색상
              nodeColor={node => (node as any).group === timelineTarget ? '#818cf8' : '#ffffff'}
              nodeRelSize={6}
              
              // 2. 구슬 + 텍스트 모두 표시
              nodeThreeObjectExtend={true}
              nodeThreeObject={(node: any) => {
                const sprite = new SpriteText(node.name);
                sprite.color = (node as any).group === timelineTarget ? '#818cf8' : 'rgba(255,255,255,0.6)';
                sprite.textHeight = 4;
                
                // 3. [수정됨] as any를 사용하여 TypeScript position 오류 해결
                (sprite as any).position.y = -12; 
                
                return sprite;
              }}

              linkColor={() => '#ffffff20'}
              linkWidth={1}
              linkOpacity={0.3}
              
              // 노드 클릭 시 이동
              onNodeClick={(node: any) => {
                const distance = 40;
                const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
                if (graphRef.current) {
                  graphRef.current.cameraPosition(
                    { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio },
                    node,
                    3000
                  );
                }
                setTimeout(() => router.push(`/post/${node.id}`), 1000);
              }}
              // 노드 호버 시 커서 변경
              onNodeHover={(node: any) => {
                document.body.style.cursor = node ? 'pointer' : 'default';
              }}
            />
            
            {/* 데이터 없을 때 안내 문구 */}
            {memos.length === 0 && (
               <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
                 <p className="text-xs text-gray-600 font-mono animate-pulse">INITIALIZING NEURAL NETWORK...</p>
               </div>
            )}
          </div>
        )}
      </div>

      {/* 🏷️ 5. 하단 타이틀 (원본 스타일 유지) */}
      <div className="fixed bottom-10 right-10 text-right z-50 pointer-events-none">
        <h2 className="text-4xl font-black italic tracking-tighter mb-2 uppercase">Knowledge_Nexus</h2>
        <p className="text-[9px] font-bold text-gray-500 tracking-[0.5em]">
          {isTimelineMode ? 'TIMELINE_SEQUENCE' : 'NEURAL_NETWORK_VIEW'}
        </p>
      </div>
    </div>
  );
}