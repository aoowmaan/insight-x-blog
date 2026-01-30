'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://plmlbrzxzkftjzpbakwi.supabase.co',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_zXsjrYxWjeOaFrhdFMtG2Q_KSJYEJha'
);

export default function CharacterDossierFinal() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  
  // 데이터 상태
  const [characters, setCharacters] = useState<any[]>([]);
  const [filter, setFilter] = useState('전체');
  
  // UI 상태
  const [selectedChar, setSelectedChar] = useState<any>(null); // 상세보기 모달
  const [isEditing, setIsEditing] = useState(false); // 수정/추가 모달
  const [loading, setLoading] = useState(false);

  // 📝 입력 폼 상태
  const [formId, setFormId] = useState<number | null>(null);
  const [formName, setFormName] = useState('');
  const [formSeries, setFormSeries] = useState('');
  const [formRole, setFormRole] = useState('');
  const [formDesc, setFormDesc] = useState('');
  const [formSecret, setFormSecret] = useState('');
  const [formStats, setFormStats] = useState({ int: 50, pow: 50, cha: 50, amb: 50 });
  const [formImage, setFormImage] = useState<File | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState('');

  useEffect(() => {
    checkAuth();
    fetchCharacters();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    setIsAdmin(!!session);
  };

  const fetchCharacters = async () => {
    const { data } = await supabase.from('characters').select('*').order('created_at', { ascending: true });
    if (data) setCharacters(data);
  };

  // 🛠️ 추가/수정 모달 열기
  const openEditModal = (char: any = null) => {
    if (char) {
      // 수정 모드
      setFormId(char.id);
      setFormName(char.name);
      setFormSeries(char.series);
      setFormRole(char.role);
      setFormDesc(char.description);
      setFormSecret(char.secret);
      setFormStats(char.stats || { int: 50, pow: 50, cha: 50, amb: 50 });
      setCurrentImageUrl(char.image_url);
    } else {
      // 추가 모드
      setFormId(null);
      setFormName('');
      setFormSeries('');
      setFormRole('');
      setFormDesc('');
      setFormSecret('');
      setFormStats({ int: 50, pow: 50, cha: 50, amb: 50 });
      setCurrentImageUrl('');
    }
    setFormImage(null);
    setIsEditing(true);
  };

  // 💾 저장 (추가/수정)
  const handleSave = async () => {
    if (!formName || !formSeries) return alert("이름과 소설 시리즈는 필수입니다.");
    setLoading(true);

    let imageUrl = currentImageUrl;

    // 이미지 업로드
    if (formImage) {
      const fileName = `char_${Date.now()}`;
      const { data } = await supabase.storage.from('blog_images').upload(fileName, formImage);
      if (data) {
        const { data: publicUrl } = supabase.storage.from('blog_images').getPublicUrl(fileName);
        imageUrl = publicUrl.publicUrl;
      }
    }

    const payload = {
      name: formName,
      series: formSeries,
      role: formRole,
      description: formDesc,
      secret: formSecret,
      stats: formStats,
      image_url: imageUrl
    };

    if (formId) {
      // 수정
      await supabase.from('characters').update(payload).eq('id', formId);
    } else {
      // 추가
      await supabase.from('characters').insert([payload]);
    }

    setLoading(false);
    setIsEditing(false);
    fetchCharacters();
  };

  // 🗑️ 삭제
  const handleDelete = async (id: number) => {
    if (!confirm("정말 이 인물 파일을 파기하시겠습니까? (복구 불가)")) return;
    await supabase.from('characters').delete().eq('id', id);
    fetchCharacters();
    if (selectedChar?.id === id) setSelectedChar(null);
  };

  // 시리즈 필터 목록
  const seriesList = ['전체', ...Array.from(new Set(characters.map(c => c.series)))];
  const filteredChars = characters.filter(c => filter === '전체' || c.series === filter);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white font-sans selection:bg-red-900 selection:text-white p-6 md:p-10 relative">
      
      {/* 헤더 */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
        <div>
          <h1 className="text-3xl md:text-5xl font-black italic tracking-tighter mb-2 uppercase text-gray-100">
            기밀 인물 파일
          </h1>
          <p className="text-[10px] font-bold text-red-500 tracking-[0.3em] animate-pulse">
            TOP SECRET // AUTHORIZED PERSONNEL ONLY
          </p>
        </div>
        <div className="flex gap-4">
          {isAdmin && (
            <button 
              onClick={() => openEditModal()} 
              className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-full font-black text-xs uppercase transition-all shadow-lg shadow-red-900/50"
            >
              + 요원 등록
            </button>
          )}
          <button onClick={() => router.push('/')} className="text-xs font-bold text-gray-500 hover:text-white border px-4 py-2 rounded-full border-gray-700">메인으로</button>
        </div>
      </div>

      {/* 필터 */}
      <div className="flex gap-4 mb-10 overflow-x-auto pb-2 no-scrollbar">
        {seriesList.map(s => (
          <button 
            key={s} 
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-full text-xs font-black border transition-all whitespace-nowrap ${filter === s ? 'bg-white text-black border-white' : 'border-gray-800 text-gray-500 hover:border-gray-500'}`}
          >
            {s}
          </button>
        ))}
      </div>

      {/* 인물 그리드 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredChars.map(c => (
          <div 
            key={c.id} 
            onClick={() => setSelectedChar(c)}
            className="group relative bg-[#111] border border-gray-800 p-6 rounded-xl cursor-pointer hover:border-red-500/50 transition-all hover:-translate-y-1"
          >
            <div className="flex justify-between items-start mb-4">
               <span className="bg-gray-800 text-gray-300 text-[9px] font-bold px-2 py-1 rounded uppercase">{c.series}</span>
               <div className="flex items-center gap-2">
                 {isAdmin && (
                   <button 
                     onClick={(e) => { e.stopPropagation(); openEditModal(c); }} 
                     className="text-[9px] font-bold text-gray-500 hover:text-white"
                   >
                     EDIT
                   </button>
                 )}
                 <span className="text-[10px] font-mono text-gray-600">ID: {c.id.toString().padStart(4, '0')}</span>
               </div>
            </div>
            
            <div className="w-full aspect-square bg-gray-900 rounded-lg mb-4 flex items-center justify-center overflow-hidden grayscale group-hover:grayscale-0 transition-all relative">
              {c.image_url ? <img src={c.image_url} className="w-full h-full object-cover" /> : <span className="text-4xl opacity-20">👤</span>}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-60" />
              <h3 className="absolute bottom-4 left-4 text-2xl font-black italic z-10">{c.name}</h3>
            </div>

            <p className="text-xs font-bold text-red-500 mb-4 uppercase tracking-wider">{c.role}</p>
            <div className="w-full h-px bg-gray-800 mb-4 group-hover:bg-red-900 transition-colors" />
            <p className="text-xs text-gray-400 line-clamp-2">{c.description}</p>
          </div>
        ))}
      </div>

      {/* ✨ 상세보기 모달 */}
      {selectedChar && (
        <div className="fixed inset-0 bg-black/90 z-[100] flex items-center justify-center p-6 animate-in fade-in duration-300" onClick={() => setSelectedChar(null)}>
          <div className="bg-[#0a0a0a] border border-gray-800 w-full max-w-4xl p-8 md:p-12 rounded-3xl relative shadow-2xl flex flex-col md:flex-row gap-10 max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
            <button onClick={() => setSelectedChar(null)} className="absolute top-6 right-6 text-gray-500 hover:text-white text-xl">✕</button>
            
            {/* 좌측: 이미지 & 스탯 */}
            <div className="w-full md:w-1/3 flex flex-col gap-6">
              <div className="aspect-[3/4] bg-gray-900 rounded-2xl overflow-hidden border border-gray-800 relative">
                {selectedChar.image_url ? <img src={selectedChar.image_url} className="w-full h-full object-cover grayscale hover:grayscale-0 transition-all duration-700" /> : <div className="w-full h-full flex items-center justify-center text-4xl">👤</div>}
                <div className="absolute bottom-0 w-full bg-red-600 text-white text-[10px] font-black text-center py-1 uppercase tracking-widest">
                  Classified
                </div>
              </div>

              {/* 스탯 그래프 */}
              <div className="bg-[#111] p-6 rounded-2xl border border-gray-800">
                <h4 className="text-[10px] font-black text-gray-500 uppercase mb-4 tracking-widest">Capability Metrics</h4>
                <div className="space-y-3">
                  {Object.entries(selectedChar.stats || {}).map(([key, val]: any) => (
                    <div key={key}>
                      <div className="flex justify-between text-[10px] font-bold text-gray-400 uppercase mb-1">
                        <span>{key === 'int' ? '지능' : key === 'pow' ? '권력' : key === 'cha' ? '매력' : '야망'}</span>
                        <span>{val}</span>
                      </div>
                      <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden">
                        <div className="h-full bg-red-600 transition-all duration-1000" style={{ width: `${val}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            {/* 우측: 텍스트 정보 */}
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-red-500 text-[10px] font-black tracking-widest uppercase border border-red-900/50 px-2 py-1 rounded">{selectedChar.series}</span>
                {isAdmin && <button onClick={() => { setSelectedChar(null); openEditModal(selectedChar); }} className="text-[10px] font-bold text-gray-600 hover:text-white underline">DATA UPDATE</button>}
              </div>
              <h2 className="text-5xl md:text-6xl font-black italic mb-2 tracking-tighter text-white">{selectedChar.name}</h2>
              <p className="text-lg font-bold text-gray-400 mb-8">{selectedChar.role}</p>
              
              <div className="mb-8">
                <h4 className="text-xs font-bold text-white mb-3 uppercase border-l-2 border-red-600 pl-3">Profile Summary</h4>
                <p className="text-sm text-gray-400 leading-loose whitespace-pre-wrap">{selectedChar.description}</p>
              </div>

              <div className="p-6 bg-red-950/20 border border-red-900/30 rounded-xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-2 opacity-20 text-4xl">🔒</div>
                <h4 className="text-xs font-bold text-red-500 mb-2 uppercase tracking-wider flex items-center gap-2">
                  ⚠️ Secret Dossier <span className="text-[8px] bg-red-600 text-white px-1 rounded">Lv.1 Access</span>
                </h4>
                <p className="text-sm text-red-200/80 leading-relaxed font-medium blur-sm hover:blur-none transition-all duration-500 cursor-help select-none">
                  {selectedChar.secret}
                </p>
                <p className="text-[9px] text-red-500/50 mt-2 text-center group-hover:hidden">마우스를 올려 기밀 해제</p>
              </div>
              
              {isAdmin && (
                <button onClick={() => handleDelete(selectedChar.id)} className="mt-8 text-xs font-black text-gray-700 hover:text-red-600 uppercase tracking-widest transition-colors">
                  🧨 Delete This File
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 🛠️ 추가/수정 모달 (Admin Only) */}
      {isEditing && (
        <div className="fixed inset-0 bg-black/90 z-[150] flex items-center justify-center p-6">
          <div className="bg-[#151515] w-full max-w-2xl p-8 rounded-3xl border border-gray-700 max-h-[90vh] overflow-y-auto">
            <h3 className="text-2xl font-black italic mb-6">{formId ? '요원 정보 수정' : '새 요원 등록'}</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <input value={formName} onChange={e => setFormName(e.target.value)} placeholder="이름 (예: 강진혁)" className="bg-[#222] border border-gray-700 p-3 rounded-lg w-full text-sm font-bold outline-none focus:border-white" />
                <input value={formSeries} onChange={e => setFormSeries(e.target.value)} placeholder="소설 시리즈 (예: 불청객 기록실)" className="bg-[#222] border border-gray-700 p-3 rounded-lg w-full text-sm font-bold outline-none focus:border-white" />
              </div>
              <input value={formRole} onChange={e => setFormRole(e.target.value)} placeholder="역할/직업 (예: 정치 컨설턴트)" className="bg-[#222] border border-gray-700 p-3 rounded-lg w-full text-sm font-bold outline-none focus:border-white" />
              
              <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} placeholder="공개 프로필 설명" className="bg-[#222] border border-gray-700 p-3 rounded-lg w-full h-24 text-sm outline-none focus:border-white resize-none" />
              <textarea value={formSecret} onChange={e => setFormSecret(e.target.value)} placeholder="비밀/스포일러 (흐리게 표시됨)" className="bg-red-900/10 border border-red-900/30 p-3 rounded-lg w-full h-20 text-sm outline-none focus:border-red-500 resize-none text-red-200" />

              <div className="bg-[#222] p-4 rounded-xl border border-gray-700">
                <p className="text-xs font-bold text-gray-400 mb-3 uppercase">능력치 설정 (0~100)</p>
                <div className="grid grid-cols-2 gap-4">
                  {['int', 'pow', 'cha', 'amb'].map(stat => (
                    <div key={stat} className="flex items-center gap-2">
                      <span className="text-[10px] w-8 uppercase font-bold text-gray-500">{stat === 'int' ? '지능' : stat === 'pow' ? '권력' : stat === 'cha' ? '매력' : '야망'}</span>
                      <input 
                        type="number" 
                        value={formStats[stat as keyof typeof formStats]} 
                        onChange={e => setFormStats({...formStats, [stat]: Number(e.target.value)})} 
                        className="bg-black border border-gray-600 rounded px-2 py-1 w-full text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-gray-500 mb-1 block">프로필 사진</label>
                <input type="file" onChange={e => setFormImage(e.target.files?.[0] || null)} className="text-xs text-gray-400" />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-8 pt-4 border-t border-gray-800">
              <button onClick={() => setIsEditing(false)} className="px-6 py-3 rounded-xl bg-gray-800 text-gray-400 font-bold hover:bg-gray-700">취소</button>
              <button onClick={handleSave} disabled={loading} className="px-6 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500">
                {loading ? '처리 중...' : '저장 완료'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}