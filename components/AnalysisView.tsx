import React, { useState, useRef, useMemo } from 'react';
import { AnalysisResult, Citation, UploadedFile, BuyerSnapshot, ObjectionPair } from '../types';
import { ICONS } from '../constants';
import { generatePitchAudio, decodeAudioData } from '../services/geminiService';

interface AnalysisViewProps {
  result: AnalysisResult;
  files: UploadedFile[];
}

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

const parseIntensity = (str: string, highKeys: string[], lowKeys: string[]) => {
  const s = (str || "").toLowerCase();
  if (highKeys.some(k => s.includes(k))) return 85 + Math.random() * 10;
  if (lowKeys.some(k => s.includes(k))) return 25 + Math.random() * 15;
  return 55 + Math.random() * 10;
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, files }) => {
  const [highlightedSnippet, setHighlightedSnippet] = useState<string | null>(null);
  const [expandedObjections, setExpandedObjections] = useState<Set<number>>(new Set([0]));
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

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
    (result.competitiveComparison || []).forEach((c, i) => add(c.citation, `Competitor: ${c.name}`, `competitor-${i}`, "Competitive"));
    (result.objectionHandling || []).forEach((o, i) => add(o.citation, `Objection: ${o.objection}`, `objection-${i}`, "Tactical"));
    
    return list;
  }, [result]);

  const toggleObjection = (idx: number) => {
    const next = new Set(expandedObjections);
    if (next.has(idx)) {
      next.delete(idx);
    } else {
      next.add(idx);
    }
    setExpandedObjections(next);
  };

  const copyToClipboard = (text: string, idx: number) => {
    navigator.clipboard.writeText(text);
    setCopiedId(idx);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const scrollToSource = (citation: Citation) => {
    if (!citation?.snippet) return;
    setHighlightedSnippet(citation.snippet);
    const explorer = document.getElementById('grounding-explorer');
    if (explorer) explorer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const playSnippet = async (text: string, id: string) => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }
    setPlayingAudioId(id);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const bytes = await generatePitchAudio(text, 'Kore');
      if (!bytes) return;
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
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* COGNITIVE PROFILE DASHBOARD */}
      <section className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200 relative overflow-hidden">
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

      {/* OBJECTION HANDLING BATTLE-DRILL (INTERACTIVE ACCORDION) */}
      <section className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl shadow-indigo-100">
            <ICONS.Security />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Interactive Objection Battle-Drill</h2>
            <p className="text-sm text-slate-500 font-medium">Click each anticipated barrier to reveal the strategic deconstruction and verbatim counters.</p>
          </div>
        </div>

        <div className="space-y-4">
          {(result.objectionHandling || []).map((obj, idx) => {
            const isExpanded = expandedObjections.has(idx);
            return (
              <div 
                key={idx} 
                className={`rounded-[2.5rem] border transition-all duration-500 overflow-hidden ${isExpanded ? 'bg-slate-50 border-indigo-200 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
              >
                {/* Accordion Header */}
                <button 
                  onClick={() => toggleObjection(idx)}
                  className="w-full text-left px-10 py-8 flex items-center justify-between group focus:outline-none"
                >
                  <div className="flex items-center gap-6 flex-1">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${isExpanded ? 'bg-indigo-600 text-white rotate-12 scale-110' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                      {idx + 1}
                    </div>
                    <span className={`text-xl font-black tracking-tight transition-colors ${isExpanded ? 'text-indigo-600' : 'text-slate-800'}`}>
                      {obj.objection}
                    </span>
                  </div>
                  <div className={`transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${isExpanded ? 'text-indigo-600' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="px-10 pb-10 pt-2 animate-in slide-in-from-top-4 duration-500">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      
                      {/* Strategic Logic Column */}
                      <div className="space-y-8">
                        <div className="group/item">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-3 flex items-center gap-2">
                            <ICONS.Brain className="w-4 h-4" /> Cognitive Decoding: The "Real" Meaning
                          </h4>
                          <div className="relative">
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-rose-200 rounded-full group-hover/item:bg-rose-400 transition-colors"></div>
                            <p className="text-lg text-slate-700 font-black italic leading-relaxed pl-6">
                              “{obj.realMeaning}”
                            </p>
                          </div>
                          <p className="text-[10px] text-slate-400 font-bold mt-2 pl-6 uppercase tracking-widest italic opacity-60">Psychological Inferred Subtext</p>
                        </div>

                        <div className="group/item">
                          <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-3 flex items-center gap-2">
                            <ICONS.Trophy className="w-4 h-4" /> Response Strategy & Logic Path
                          </h4>
                          <div className="relative">
                            <div className="absolute -left-4 top-0 bottom-0 w-1 bg-indigo-200 rounded-full group-hover/item:bg-indigo-400 transition-colors"></div>
                            <p className="text-sm text-slate-600 leading-relaxed font-semibold pl-6">
                              {obj.strategy}
                            </p>
                          </div>
                        </div>

                        <div className="pt-2 flex items-center gap-4">
                          <button 
                            onClick={() => scrollToSource(obj.citation)}
                            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest bg-white border border-slate-200 text-slate-400 hover:text-indigo-600 hover:border-indigo-200 hover:bg-indigo-50 transition-all shadow-sm"
                          >
                            <ICONS.Shield className="w-3.5 h-3.5" /> Source Document Evidence
                          </button>
                        </div>
                      </div>

                      {/* Articular Pitch Column */}
                      <div className="relative">
                        <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden h-full flex flex-col justify-between border border-slate-800">
                          <div className="absolute -top-4 -right-4 p-12 opacity-5"><ICONS.Speaker className="w-40 h-40 text-white" /></div>
                          <div className="relative z-10 space-y-5">
                            <div className="flex items-center gap-3">
                              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                              <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">Verbatim Sales Script</h4>
                            </div>
                            <p className="text-2xl font-black italic leading-tight text-white tracking-tight">
                              “{obj.exactWording}”
                            </p>
                            <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">Target Tone:</span>
                              <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">{result.snapshot.tone}</span>
                            </div>
                          </div>
                          
                          <div className="relative z-10 pt-10 flex flex-col sm:flex-row items-center gap-4">
                            <button 
                              onClick={() => playSnippet(obj.exactWording, `obj-audio-${idx}`)}
                              className={`w-full sm:flex-1 flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${playingAudioId === `obj-audio-${idx}` ? 'bg-rose-600 text-white' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}
                            >
                              {playingAudioId === `obj-audio-${idx}` ? (
                                <><div className="w-2 h-2 bg-white rounded-full animate-ping"></div> Stop Playback</>
                              ) : (
                                <><ICONS.Play className="w-4 h-4" /> AI Audio Pitch</>
                              )}
                            </button>
                            <button 
                              onClick={() => copyToClipboard(obj.exactWording, idx)}
                              className={`w-full sm:w-auto px-8 py-4 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all border active:scale-95 ${copiedId === idx ? 'bg-emerald-500 border-emerald-500 text-white' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white hover:border-slate-500'}`}
                            >
                              {copiedId === idx ? 'Copied' : 'Copy Text'}
                            </button>
                          </div>
                        </div>
                      </div>

                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* COMPETITIVE COMPARISON SECTION */}
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
                      <h3 className="text-3xl font-black text-slate-900 tracking-tight uppercase">{comp.name}</h3>
                      <p className="text-rose-600 text-[10px] font-black uppercase tracking-[0.3em] mt-1 italic">*Direct/Indirect Threat Profile*</p>
                    </div>
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
                <DocumentHighlighter text={file.content} citations={allCitations.filter(c => c.sourceFile === file.name)} highlightedSnippet={highlightedSnippet} />
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

const DocumentHighlighter = ({ text, citations, highlightedSnippet }: { 
  text: string; 
  citations: (Citation & { id: string })[]; 
  highlightedSnippet: string | null;
}) => {
  if (!citations || !citations.length) return <>{text}</>;
  let parts: React.ReactNode[] = [text];
  citations.forEach((cit) => {
    if (!cit.snippet) return;
    const newParts: React.ReactNode[] = [];
    parts.forEach((part) => {
      if (typeof part !== 'string') { newParts.push(part); return; }
      const index = part.indexOf(cit.snippet);
      if (index === -1) { newParts.push(part); } else {
        newParts.push(part.slice(0, index));
        newParts.push(<mark key={cit.id} className={`cursor-pointer transition-all ${highlightedSnippet === cit.snippet ? 'grounding-active' : 'bg-indigo-50 text-indigo-700'}`}>{cit.snippet}</mark>);
        newParts.push(part.slice(index + cit.snippet.length));
      }
    });
    parts = newParts;
  });
  return <>{parts}</>;
};