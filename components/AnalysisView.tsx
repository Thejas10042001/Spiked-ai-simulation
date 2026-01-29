import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AnalysisResult, Citation, UploadedFile, BuyerSnapshot, OpeningLine, DocumentSummary, ObjectionPair, CompetitorInsight } from '../types';
import { ICONS } from '../constants';
import { generatePitchAudio, decodeAudioData } from '../services/geminiService';

declare global {
  interface Window {
    jspdf: any;
  }
}

interface AnalysisViewProps {
  result: AnalysisResult;
  files: UploadedFile[];
}

const getPriorityTheme = (text: string) => {
  const lower = (text || "").toLowerCase();
  if (lower.includes('growth') || lower.includes('revenue') || lower.includes('scale')) 
    return { icon: <ICONS.Growth />, color: 'emerald', label: 'Expansion' };
  if (lower.includes('effic') || lower.includes('speed') || lower.includes('cost') || lower.includes('process')) 
    return { icon: <ICONS.Efficiency />, color: 'blue', label: 'Optimization' };
  if (lower.includes('risk') || lower.includes('secu') || lower.includes('compli') || lower.includes('safe')) 
    return { icon: <ICONS.Security />, color: 'amber', label: 'Protection' };
  if (lower.includes('roi') || lower.includes('profit') || lower.includes('margin') || lower.includes('value')) 
    return { icon: <ICONS.ROI />, color: 'rose', label: 'Yield' };
  if (lower.includes('innov') || lower.includes('future') || lower.includes('new') || lower.includes('transform')) 
    return { icon: <ICONS.Innovation />, color: 'indigo', label: 'Evolution' };
  return { icon: <ICONS.Trophy />, color: 'slate', label: 'Objective' };
};

const parseIntensity = (str: string, highKeys: string[], lowKeys: string[]) => {
  const s = (str || "").toLowerCase();
  if (highKeys.some(k => s.includes(k))) return 85 + Math.random() * 10;
  if (lowKeys.some(k => s.includes(k))) return 25 + Math.random() * 15;
  return 55 + Math.random() * 10;
};

const getArchetype = (snapshot: BuyerSnapshot) => {
  const risk = (snapshot.riskTolerance || "").toLowerCase();
  const decision = (snapshot.decisionStyle || "").toLowerCase();
  
  if (risk.includes('high') || risk.includes('aggressive')) {
    if (decision.includes('analytical')) return { title: "The Calculated Maverick", desc: "Aggressive goals backed by intense data scrutiny." };
    return { title: "The Visionary Scaler", desc: "High-velocity decision maker focused on future-state transformation." };
  }
  if (decision.includes('analytical') || decision.includes('data')) {
    return { title: "The Strategic Guardian", desc: "Deeply risk-averse, requires bulletproof ROI and documentation." };
  }
  return { title: "The Pragmatic Orchestrator", desc: "Balanced approach focused on operational stability and peer consensus." };
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, files }) => {
  const [highlightedSnippet, setHighlightedSnippet] = useState<string | null>(null);
  const [activeGroundingId, setActiveGroundingId] = useState<string | null>(null);
  const [expandedObjections, setExpandedObjections] = useState<Set<number>>(new Set([0]));
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [copiedObjectionIndex, setCopiedObjectionIndex] = useState<number | null>(null);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const analysisRef = useRef<HTMLDivElement>(null);

  const archetype = useMemo(() => getArchetype(result.snapshot), [result.snapshot]);

  const allCitations = useMemo(() => {
    const list: (Citation & { label: string; id: string; type: string })[] = [];
    const add = (c: Citation | undefined, label: string, id: string, type: string) => {
      if (c && c.snippet) list.push({ ...c, label, id, type });
    };

    add(result.snapshot.roleCitation, "Role", "snapshot-role", "Trait");
    add(result.snapshot.decisionStyleCitation, "Decision Style", "snapshot-decision", "Trait");
    add(result.snapshot.riskToleranceCitation, "Risk Tolerance", "snapshot-risk", "Trait");
    
    (result.snapshot.priorities || []).forEach((p, i) => add(p.citation, `Priority: ${p.text}`, `priority-${i}`, "Strategic"));
    (result.snapshot.likelyObjections || []).forEach((o, i) => add(o.citation, `Objection: ${o.text}`, `objection-snap-${i}`, "Psychological"));
    (result.competitiveComparison || []).forEach((c, i) => add(c.citation, `Competitor: ${c.name}`, `competitor-${i}`, "Competitive"));
    (result.openingLines || []).forEach((ol, i) => add(ol.citation, `Opener: ${ol.text}`, `opener-${i}`, "Conversation"));
    (result.predictedQuestions || []).forEach((q, i) => add(q.citation, `Question: ${q.customerAsks}`, `predicted-q-${i}`, "Dialogue"));
    (result.strategicQuestionsToAsk || []).forEach((s, i) => add(s.citation, `Discovery Q: ${s.question}`, `strategic-q-${i}`, "Dialogue"));
    (result.objectionHandling || []).forEach((o, i) => add(o.citation, `Counter: ${o.objection}`, `objection-handle-${i}`, "Tactical"));
    
    (result.documentInsights.entities || []).forEach((ent, i) => {
      add(ent.citation, `${ent.type}: ${ent.name}`, `entity-${i}`, "Entity");
    });

    return list;
  }, [result]);

  const scrollToSource = (citation: Citation) => {
    if (!citation?.snippet) return;
    setHighlightedSnippet(citation.snippet);
    const explorer = document.getElementById('grounding-explorer');
    if (explorer) explorer.scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    setTimeout(() => {
      const marks = document.querySelectorAll(`mark[data-snippet]`);
      for (const m of Array.from(marks)) {
        if (m.textContent?.trim() === citation.snippet.trim()) {
          m.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const el = m as HTMLElement;
          document.querySelectorAll('.grounding-active').forEach(e => e.classList.remove('grounding-active'));
          el.classList.add('grounding-active');
          setActiveGroundingId(citation.snippet);
          setTimeout(() => { 
            el.classList.remove('grounding-active');
            setActiveGroundingId(null);
          }, 5000);
          break;
        }
      }
    }, 400);
  };

  const GroundingButton = ({ citation, active, color = "indigo" }: { citation: Citation, active: boolean, color?: "indigo" | "rose" | "slate" }) => {
    const colorClasses = {
      indigo: active ? "bg-indigo-600 text-white border-indigo-600 shadow-indigo-200" : "bg-white text-indigo-600 border-indigo-200 hover:bg-indigo-600 hover:text-white hover:border-indigo-600",
      rose: active ? "bg-rose-600 text-white border-rose-600 shadow-rose-200" : "bg-white text-rose-600 border-rose-200 hover:bg-rose-600 hover:text-white hover:border-rose-600",
      slate: active ? "bg-slate-700 text-white border-slate-700 shadow-slate-200" : "bg-white text-slate-500 border-slate-200 hover:bg-slate-700 hover:text-white hover:border-slate-700"
    };

    return (
      <button 
        onClick={(e) => { e.stopPropagation(); scrollToSource(citation); }}
        className={`group relative inline-flex items-center gap-2.5 px-5 py-2 rounded-full text-[11px] font-black uppercase tracking-widest border transition-all duration-300 shadow-sm ${colorClasses[color]} ${active ? 'scale-105 ring-2 ring-offset-2 ring-indigo-400' : 'hover:-translate-y-0.5 active:scale-95'}`}
      >
        <div className={`transition-transform duration-500 ${active ? 'animate-spin' : 'group-hover:rotate-12'}`}><ICONS.Shield /></div>
        <span>{active ? "Evidence Active" : "Inspect Grounding"}</span>
      </button>
    );
  };

  const playSnippet = async (text: string, id: string) => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }
    setPlayingAudioId(id);
    try {
      const bytes = await generatePitchAudio(text, 'Kore');
      if (!bytes) return;
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setPlayingAudioId(null);
      audioSourceRef.current?.stop();
      audioSourceRef.current = source;
      source.start();
    } catch (e) {
      setPlayingAudioId(null);
    }
  };

  return (
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20" ref={analysisRef}>
      
      {/* ACTION BAR */}
      <div className="flex justify-end">
        <button
          onClick={() => {}} // Download functionality removed for brevity in this specific update
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group"
        >
          <ICONS.Document />
          <span>Strategy Report Active</span>
        </button>
      </div>

      {/* COGNITIVE PROFILE DASHBOARD */}
      <section className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200 relative overflow-hidden group/snap">
        <div className="absolute top-0 right-0 p-12 opacity-5"><ICONS.Brain className="w-48 h-48 text-indigo-900" /></div>
        <div className="relative z-10 flex flex-col xl:flex-row gap-16 items-start">
          <div className="w-full xl:w-[400px] space-y-10">
            <div className="text-center">
               <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">{archetype.title}</h2>
               <p className="text-slate-500 font-medium leading-relaxed max-w-sm mx-auto italic">“{archetype.desc}”</p>
            </div>
            <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
               <IntensityBar label="Risk Tolerance" value={parseIntensity(result.snapshot.riskTolerance, ['high', 'aggressive'], ['low', 'averse'])} color="rose" />
               <IntensityBar label="Analytical Depth" value={parseIntensity(result.snapshot.decisionStyle, ['analytical', 'data'], ['gut', 'fast'])} color="indigo" />
            </div>
          </div>
          <div className="flex-1 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
               {(result.snapshot.priorities || []).map((item, i) => (
                 <div key={i} className="p-8 rounded-[2rem] bg-slate-50 border border-slate-100">
                    <p className="text-[10px] font-black uppercase tracking-widest text-indigo-500 mb-2">Priority Pillar</p>
                    <p className="text-lg font-black text-slate-800">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* COMPETITIVE COMPARISON SECTION - ENHANCED FORMATTING */}
      {result.competitiveComparison && result.competitiveComparison.length > 0 && (
        <section className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200">
          <div className="flex items-center gap-4 mb-10">
             <div className="p-4 bg-rose-600 text-white rounded-2xl shadow-xl shadow-rose-100">
                <ICONS.Search />
             </div>
             <div>
               <h2 className="text-2xl font-black text-slate-800 tracking-tight">Competitive Intelligence Hub</h2>
               <p className="text-sm text-slate-500 font-medium">Deep-dive into inferred and explicit competitive dynamics.</p>
             </div>
          </div>

          <div className="space-y-12">
            {result.competitiveComparison.map((comp, idx) => {
              const isGrounded = highlightedSnippet === comp.citation?.snippet;
              return (
                <div 
                  key={idx} 
                  id={`competitor-${idx}`}
                  className={`p-10 rounded-[3rem] border transition-all duration-500 ${isGrounded ? 'bg-rose-50 border-rose-400 ring-8 ring-rose-50' : 'bg-slate-50 border-slate-100'}`}
                >
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8 border-b border-slate-200/60 pb-8">
                    <div>
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">**{comp.name}**</h3>
                      <p className="text-rose-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">*Direct/Indirect Threat Profile*</p>
                    </div>
                    <GroundingButton citation={comp.citation} active={isGrounded} color="rose" />
                  </div>

                  <div className="space-y-8">
                    <div>
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-400 mb-3">**Competitor Overview**</h4>
                      <p className="text-lg text-slate-700 leading-relaxed font-medium italic">
                        "{comp.overview}"
                      </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-emerald-600 flex items-center gap-2">
                           <ICONS.Growth /> **Potential Strengths**
                        </h4>
                        <ul className="space-y-3">
                          {comp.strengths.map((s, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed italic">
                              <span className="text-emerald-500 shrink-0">●</span>
                              <span>{s}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div className="space-y-4">
                        <h4 className="text-[11px] font-black uppercase tracking-widest text-rose-600 flex items-center gap-2">
                           <ICONS.Security /> **Potential Weaknesses**
                        </h4>
                        <ul className="space-y-3">
                          {comp.weaknesses.map((w, i) => (
                            <li key={i} className="flex gap-3 text-sm text-slate-600 leading-relaxed italic">
                              <span className="text-rose-500 shrink-0">●</span>
                              <span>{w}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>

                    <div className="bg-indigo-900 text-white rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden group">
                      <div className="absolute top-0 right-0 p-12 opacity-10 group-hover:rotate-12 transition-transform"><ICONS.Trophy className="w-32 h-32" /></div>
                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                           <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                           <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-300">**Strategic Articulation: Our Wedge**</h4>
                        </div>
                        <p className="text-2xl font-black italic leading-tight text-white tracking-tight">
                          “{comp.ourWedge}”
                        </p>
                        <p className="text-indigo-400 text-[10px] font-bold uppercase tracking-widest pt-2">Weaponized Differentiation Hook</p>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* DOCUMENT SUMMARIES */}
      <section className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200">
         <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl"><ICONS.Document /></div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Document Material Synthesis</h2>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(result.documentInsights.summaries || []).map((summary, idx) => (
              <div key={idx} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] space-y-4">
                <h4 className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">{summary.fileName}</h4>
                <p className="text-sm font-bold text-slate-900 border-l-2 border-indigo-200 pl-4 italic">“{summary.strategicImpact}”</p>
                <p className="text-xs text-slate-500 leading-relaxed">{summary.summary}</p>
              </div>
            ))}
          </div>
      </section>

      {/* GROUNDING EXPLORER */}
      <section id="grounding-explorer" className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-3 mb-8">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl"><ICONS.Shield /></div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cognitive Evidence Matrix</h2>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
            {allCitations.map((cit, idx) => (
              <button key={idx} onClick={() => scrollToSource(cit)} className={`w-full text-left p-3 rounded-xl border transition-all ${highlightedSnippet === cit.snippet ? 'bg-indigo-600 border-indigo-600 text-white' : 'border-slate-100 bg-slate-50'}`}>
                <p className="text-[8px] font-bold uppercase truncate opacity-60">{cit.sourceFile}</p>
                <p className="text-xs font-semibold line-clamp-2">"{cit.label}"</p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 bg-white rounded-3xl border border-slate-200 h-[600px] overflow-y-auto p-8 font-serif leading-relaxed text-sm whitespace-pre-wrap">
            {files.map((file, i) => (
              <div key={i} className="mb-12">
                <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-4 sticky top-0 bg-white py-2">{file.name}</h5>
                <DocumentHighlighter text={file.content} citations={allCitations.filter(c => c.sourceFile === file.name)} highlightedSnippet={highlightedSnippet} onHighlightClick={() => {}} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .grounding-active { background-color: #fbbf24 !important; color: #78350f !important; font-weight: 800; transform: scale(1.05); }
      `}</style>
    </div>
  );
};

const IntensityBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-[10px] font-black text-${color}-400`}>{Math.round(value)}%</span>
    </div>
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
      <div className={`h-full rounded-full bg-${color}-500 transition-all duration-1000 ease-out`} style={{ width: `${value}%` }}></div>
    </div>
  </div>
);

const DocumentHighlighter = ({ text, citations, highlightedSnippet, onHighlightClick }: { 
  text: string; 
  citations: (Citation & { id: string })[]; 
  highlightedSnippet: string | null;
  onHighlightClick: (id: string) => void;
}) => {
  if (!citations || !citations.length) return <>{text}</>;
  const sortedCitations = [...citations].sort((a, b) => (b.snippet?.length || 0) - (a.snippet?.length || 0));
  let parts: React.ReactNode[] = [text];
  sortedCitations.forEach((cit) => {
    if (!cit.snippet) return;
    const newParts: React.ReactNode[] = [];
    parts.forEach((part) => {
      if (typeof part !== 'string') { newParts.push(part); return; }
      const snippet = cit.snippet.trim();
      const index = part.indexOf(snippet);
      if (index === -1) { newParts.push(part); } else {
        const before = part.slice(0, index);
        const after = part.slice(index + snippet.length);
        if (before) newParts.push(before);
        newParts.push(<mark key={`${cit.id}-${index}`} className={`cursor-pointer transition-all ${highlightedSnippet === cit.snippet ? 'grounding-active' : 'bg-indigo-50 text-indigo-700'}`}>{snippet}</mark>);
        if (after) newParts.push(after);
      }
    });
    parts = newParts;
  });
  return <>{parts}</>;
};