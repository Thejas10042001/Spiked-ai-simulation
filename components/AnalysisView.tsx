
import React, { useState, useRef, useMemo } from 'react';
import { AnalysisResult, Citation, UploadedFile, BuyerSnapshot, OpeningLine } from '../types';
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
  const lower = text.toLowerCase();
  if (lower.includes('growth') || lower.includes('revenue') || lower.includes('scale')) 
    return { icon: <ICONS.Growth />, color: 'emerald' };
  if (lower.includes('effic') || lower.includes('speed') || lower.includes('cost') || lower.includes('process')) 
    return { icon: <ICONS.Efficiency />, color: 'blue' };
  if (lower.includes('risk') || lower.includes('secu') || lower.includes('compli') || lower.includes('safe')) 
    return { icon: <ICONS.Security />, color: 'amber' };
  if (lower.includes('roi') || lower.includes('profit') || lower.includes('margin') || lower.includes('value')) 
    return { icon: <ICONS.ROI />, color: 'rose' };
  if (lower.includes('innov') || lower.includes('future') || lower.includes('new') || lower.includes('transform')) 
    return { icon: <ICONS.Innovation />, color: 'indigo' };
  return { icon: <ICONS.Trophy />, color: 'slate' };
};

const parseIntensity = (str: string, highKeys: string[], lowKeys: string[]) => {
  const s = (str || "").toLowerCase();
  if (highKeys.some(k => s.includes(k))) return 85 + Math.random() * 10;
  if (lowKeys.some(k => s.includes(k))) return 25 + Math.random() * 15;
  return 55 + Math.random() * 10;
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

  const allCitations = useMemo(() => {
    const list: (Citation & { label: string; id: string; type: string })[] = [];
    const add = (c: Citation | undefined, label: string, id: string, type: string) => {
      if (c && c.snippet) list.push({ ...c, label, id, type });
    };

    add(result.snapshot.roleCitation, "Role", "snapshot-role", "Trait");
    add(result.snapshot.decisionStyleCitation, "Decision Style", "snapshot-decision", "Trait");
    add(result.snapshot.riskToleranceCitation, "Risk Tolerance", "snapshot-risk", "Trait");
    
    result.snapshot.priorities?.forEach((p, i) => add(p.citation, `Priority: ${p.text}`, `priority-${i}`, "Strategic"));
    result.snapshot.likelyObjections?.forEach((o, i) => add(o.citation, `Objection: ${o.text}`, `objection-snap-${i}`, "Psychological"));
    result.openingLines?.forEach((ol, i) => add(ol.citation, `Opener: ${ol.text}`, `opener-${i}`, "Conversation"));
    result.predictedQuestions?.forEach((q, i) => add(q.citation, `Question: ${q.customerAsks}`, `predicted-q-${i}`, "Dialogue"));
    result.strategicQuestionsToAsk?.forEach((s, i) => add(s.citation, `Discovery Q: ${s.question}`, `strategic-q-${i}`, "Dialogue"));
    result.objectionHandling?.forEach((o, i) => add(o.citation, `Counter: ${o.objection}`, `objection-handle-${i}`, "Tactical"));
    
    result.documentInsights.entities.forEach((ent, i) => {
      add(ent.citation, `${ent.type}: ${ent.name}`, `entity-${i}`, "Entity");
    });

    return list;
  }, [result]);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - (margin * 2);

      const addText = (text: string, size: number, style: 'normal' | 'bold' = 'normal', color: [number, number, number] = [0, 0, 0]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text, contentWidth);
        
        // Check for page overflow
        if (y + (lines.length * (size / 2)) > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          y = margin;
        }
        
        doc.text(lines, margin, y);
        y += (lines.length * (size / 2)) + 5;
      };

      const addSeparator = () => {
        doc.setDrawColor(230, 230, 230);
        doc.line(margin, y, pageWidth - margin, y);
        y += 10;
      };

      // Header
      addText("Cognitive Sales Strategy Report", 22, 'bold', [79, 70, 229]);
      addText(`Generated for Persona: ${result.snapshot.role}`, 12, 'normal', [100, 116, 139]);
      y += 5;
      addSeparator();

      // Section: Buyer Snapshot
      addText("1. Buyer Psychology Profile", 16, 'bold', [30, 41, 59]);
      addText(`Decision Style: ${result.snapshot.decisionStyle}`, 11, 'normal');
      addText(`Risk Tolerance: ${result.snapshot.riskTolerance}`, 11, 'normal');
      addText(`Communication Tone: ${result.snapshot.tone}`, 11, 'normal');
      y += 5;

      addText("Strategic Priorities:", 12, 'bold');
      result.snapshot.priorities.forEach((p, idx) => {
        addText(`• ${p.text}`, 11, 'normal');
      });
      y += 10;

      // Section: Strategic Openers
      addText("2. Strategic Openers", 16, 'bold', [30, 41, 59]);
      result.openingLines.forEach((ol) => {
        addText(`[${ol.label}]`, 10, 'bold', [79, 70, 229]);
        addText(`"${ol.text}"`, 11, 'normal');
        y += 3;
      });
      y += 7;

      // Section: Predicted Dialogue
      addText("3. Anticipated Dialogue Flow", 16, 'bold', [30, 41, 59]);
      result.predictedQuestions.forEach((pq) => {
        addText(`Customer asks: "${pq.customerAsks}"`, 11, 'bold');
        addText(`Salesperson should respond: "${pq.salespersonShouldRespond}"`, 11, 'normal');
        addText(`Strategic Reasoning: ${pq.reasoning}`, 10, 'normal', [100, 116, 139]);
        y += 5;
      });
      y += 5;

      // Section: Objection Handling
      addText("4. Objection Handling Strategy", 16, 'bold', [30, 41, 59]);
      result.objectionHandling.forEach((oh) => {
        addText(`Objection: "${oh.objection}"`, 11, 'bold');
        addText(`Hidden Meaning: ${oh.realMeaning}`, 10, 'normal', [146, 64, 14]); // Amber-ish
        addText(`Response Strategy: ${oh.strategy}`, 10, 'normal');
        addText(`Exact Wording: "${oh.exactWording}"`, 11, 'bold', [79, 70, 229]);
        y += 6;
      });

      // Section: Discovery Questions
      addText("5. Strategic Questions to Ask", 16, 'bold', [30, 41, 59]);
      result.strategicQuestionsToAsk.forEach((sq) => {
        addText(`• ${sq.question}`, 11, 'bold');
        addText(`  Intent: ${sq.whyItMatters}`, 10, 'normal', [100, 116, 139]);
      });
      y += 10;

      // Final Coaching
      addText("6. Final Executive Coaching", 16, 'bold', [30, 41, 59]);
      addText("Critical Do's:", 12, 'bold', [16, 185, 129]); // Emerald
      result.finalCoaching.dos.forEach(d => addText(`• ${d}`, 11, 'normal'));
      y += 5;
      addText("Critical Don'ts:", 12, 'bold', [225, 29, 72]); // Rose
      result.finalCoaching.donts.forEach(d => addText(`• ${d}`, 11, 'normal'));
      y += 5;
      addText("Summary Advice:", 11, 'bold');
      addText(result.finalCoaching.finalAdvice, 11, 'normal');

      doc.save(`Sales_Strategy_Report_${result.snapshot.role.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
      alert("Failed to generate PDF. Please check the console for details.");
    } finally {
      setIsExporting(false);
    }
  };

  const toggleObjection = (index: number) => {
    setExpandedObjections(prev => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
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

  const copyToClipboard = (text: string, index: number, type: 'opener' | 'objection') => {
    navigator.clipboard.writeText(text);
    if (type === 'opener') {
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } else {
      setCopiedObjectionIndex(index);
      setTimeout(() => setCopiedObjectionIndex(null), 2000);
    }
  };

  const scrollToAnalysis = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
      el.classList.add('ring-4', 'ring-indigo-400', 'ring-opacity-50', 'bg-indigo-50/50', 'rounded-xl');
      setTimeout(() => el.classList.remove('ring-4', 'ring-indigo-400', 'ring-opacity-50', 'bg-indigo-50/50', 'rounded-xl'), 3000);
    }
  };

  const scrollToSource = (citation: Citation) => {
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
        <span>{active ? "Active Evidence" : "Inspect Grounding"}</span>
      </button>
    );
  };

  return (
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20" ref={analysisRef}>
      
      {/* TOP ACTION BAR */}
      <div className="flex justify-end">
        <button
          onClick={handleDownloadPdf}
          disabled={isExporting}
          className="flex items-center gap-2 px-6 py-3 bg-white border border-slate-200 rounded-2xl font-bold text-slate-700 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 transition-all shadow-sm group"
        >
          {isExporting ? (
            <div className="w-4 h-4 border-2 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 group-hover:scale-110 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          )}
          <span>{isExporting ? "Generating Report..." : "Download Strategy Report (PDF)"}</span>
        </button>
      </div>

      {/* GROUNDING EXPLORER SECTION */}
      <section id="grounding-explorer" className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cognitive Grounding Matrix</h2>
              <p className="text-sm text-slate-500">Every strategic insight is directly anchored to your source documentation.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-600 mb-2">Analysis Evidence Index</h4>
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {allCitations.map((cit, idx) => (
                <button 
                  key={`${cit.id}-${idx}`}
                  onClick={() => { scrollToSource(cit); scrollToAnalysis(cit.id); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all group ${highlightedSnippet === cit.snippet ? 'bg-indigo-600 border-indigo-600' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-300'}`}
                >
                  <div className="flex justify-between items-start gap-2 mb-1">
                    <p className={`text-[8px] font-bold uppercase truncate ${highlightedSnippet === cit.snippet ? 'text-indigo-200' : 'text-slate-400'}`}>{cit.sourceFile}</p>
                    <span className={`text-[7px] px-1.5 py-0.5 rounded-full font-black uppercase tracking-widest ${highlightedSnippet === cit.snippet ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-500'}`}>{cit.type}</span>
                  </div>
                  <p className={`text-xs font-semibold line-clamp-2 leading-snug ${highlightedSnippet === cit.snippet ? 'text-white' : 'text-slate-700 group-hover:text-indigo-600'}`}>"{cit.label}"</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden flex flex-col h-[600px] shadow-inner">
            <div className="bg-white border-b border-slate-200 p-4 flex gap-2 overflow-x-auto no-scrollbar">
              {files.map((file, i) => (
                <div key={i} className="px-3 py-1.5 bg-slate-100 rounded-lg text-[10px] font-black uppercase tracking-widest text-slate-500 whitespace-nowrap border border-slate-200">{file.name}</div>
              ))}
            </div>
            <div className="flex-1 p-8 overflow-y-auto text-sm leading-relaxed text-slate-600 bg-white font-serif whitespace-pre-wrap selection:bg-indigo-100">
              {files.map((file, fileIdx) => (
                <div key={fileIdx} className="mb-16 last:mb-0">
                  <div className="flex items-center gap-4 mb-6 sticky top-0 bg-white py-2 z-10 border-b border-indigo-50">
                    <h5 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.3em]">{file.name}</h5>
                    <div className="flex-1 h-px bg-indigo-50"></div>
                  </div>
                  <DocumentHighlighter 
                    text={file.content} 
                    citations={allCitations.filter(c => c.sourceFile === file.name)}
                    onHighlightClick={(id) => scrollToAnalysis(id)}
                    highlightedSnippet={highlightedSnippet}
                  />
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* STRATEGIC ANALYSIS CARDS */}
      <div className="space-y-16">
        {/* Profile Card */}
        <section 
          id="snapshot-root" 
          className="bg-gradient-to-br from-indigo-50/80 via-white to-slate-50 rounded-[3rem] p-10 shadow-2xl border-l-[6px] border-indigo-500 relative overflow-hidden"
        >
          <div className="flex flex-col xl:flex-row gap-12 items-start relative z-10">
            <div className="w-full xl:w-2/5 flex flex-col items-center gap-10">
              <div className="text-center">
                <div className="inline-block p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-2xl mb-4 transform hover:rotate-6 transition-transform"><ICONS.Brain /></div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight leading-none">Buyer Psychology</h2>
                <p className="text-[10px] text-indigo-500 font-black uppercase tracking-widest mt-2">Cognitive Trait Mapping</p>
              </div>

              <div className="w-full relative group">
                <div className="absolute inset-0 bg-indigo-500/5 blur-[80px] rounded-full group-hover:bg-indigo-500/10 transition-colors"></div>
                <div className="relative aspect-square bg-white/40 rounded-full p-6 backdrop-blur-sm shadow-inner border border-white/50">
                  <PsychologicalRadar snapshot={result.snapshot} />
                </div>
              </div>

              <div className="w-full space-y-6 bg-white/40 p-8 rounded-[2rem] border border-white/60 shadow-sm backdrop-blur-md">
                <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400 mb-4 flex items-center gap-2">
                  <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div> Trait Intensity Meters
                </h5>
                <IntensityBar label="Analytical Focus" value={parseIntensity(result.snapshot.decisionStyle, ['analytical', 'data'], ['gut', 'quick'])} color="indigo" />
                <IntensityBar label="Risk Appetite" value={parseIntensity(result.snapshot.riskTolerance, ['high', 'aggressive'], ['low', 'averse'])} color="emerald" />
                <IntensityBar label="Urgency Signal" value={parseIntensity(result.snapshot.tone, ['direct', 'urgent'], ['casual', 'slow'])} color="rose" />
                <IntensityBar label="Strategic Breadth" value={parseIntensity(result.snapshot.role, ['ceo', 'founder', 'vp'], ['engineer', 'manager'])} color="amber" />
              </div>
            </div>

            <div className="flex-1 w-full space-y-12">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <SnapshotCard id="snapshot-role" label="Persona Identity" value={result.snapshot.role} citation={result.snapshot.roleCitation} activeSnippet={highlightedSnippet} onViewSource={scrollToSource} />
                <SnapshotCard id="snapshot-decision" label="Decision Logic" value={result.snapshot.decisionStyle} citation={result.snapshot.decisionStyleCitation} activeSnippet={highlightedSnippet} onViewSource={scrollToSource} />
                <SnapshotCard id="snapshot-risk" label="Risk Tolerance" value={result.snapshot.riskTolerance} citation={result.snapshot.riskToleranceCitation} activeSnippet={highlightedSnippet} onViewSource={scrollToSource} />
              </div>

              <div className="pt-10 border-t border-indigo-100/50 space-y-10">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
                      <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Strategic Priority Drivers</h4>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {result.snapshot.priorities.map((item, i) => {
                      const isGrounded = highlightedSnippet === item.citation.snippet;
                      const { icon, color } = getPriorityTheme(item.text);
                      const weight = 65 + (i * -8) + (Math.random() * 10);
                      
                      return (
                        <div 
                          key={i} id={`priority-${i}`} 
                          onClick={() => scrollToSource(item.citation)}
                          className={`group p-6 rounded-[2rem] border transition-all duration-500 cursor-pointer relative overflow-hidden ${isGrounded ? 'bg-indigo-600 border-indigo-600 text-white scale-[1.02] z-10 shadow-2xl' : `bg-white/60 border-indigo-50 hover:shadow-xl hover:bg-white`}`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <div className={`p-3 rounded-2xl transition-colors ${isGrounded ? 'bg-white/20 text-white' : `bg-indigo-50 text-indigo-500`}`}>{icon}</div>
                            <span className={`text-[9px] font-black uppercase tracking-widest ${isGrounded ? 'text-indigo-200' : 'text-slate-400'}`}>Grounding Index: {isGrounded ? 'HIGH' : 'NORMAL'}</span>
                          </div>
                          <p className={`font-black text-base tracking-tight mb-4 ${isGrounded ? 'text-white' : 'text-slate-800'}`}>{item.text}</p>
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-[8px] font-black uppercase tracking-widest opacity-60">
                              <span>Perceived Impact</span>
                              <span>{Math.round(weight)}%</span>
                            </div>
                            <div className={`h-1.5 w-full rounded-full ${isGrounded ? 'bg-white/20' : 'bg-slate-100'} overflow-hidden`}>
                              <div className={`h-full rounded-full transition-all duration-1000 ${isGrounded ? 'bg-white' : `bg-${color}-500`}`} style={{ width: `${weight}%` }}></div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center gap-2">
                    <div className="w-1.5 h-6 bg-rose-500 rounded-full"></div>
                    <h4 className="text-[11px] font-black uppercase tracking-[0.25em] text-slate-500">Psychological Barriers</h4>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.snapshot.likelyObjections.map((item, i) => (
                      <div 
                        key={i} id={`objection-snap-${i}`} 
                        onClick={() => scrollToSource(item.citation)}
                        className={`p-5 rounded-3xl border transition-all duration-300 cursor-pointer flex items-start gap-4 ${highlightedSnippet === item.citation.snippet ? 'bg-rose-600 border-rose-600 text-white shadow-xl' : 'bg-white/80 border-rose-50 hover:border-rose-200 shadow-sm'}`}
                      >
                        <div className={`shrink-0 p-2 rounded-xl ${highlightedSnippet === item.citation.snippet ? 'bg-white/20 text-white' : 'bg-rose-50 text-rose-500'}`}><ICONS.Shield /></div>
                        <p className={`font-bold leading-snug text-sm ${highlightedSnippet === item.citation.snippet ? 'text-white' : 'text-slate-800'}`}>{item.text}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Strategic Openers Section */}
        <section className="space-y-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><ICONS.Document /></div>
              <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Strategic Openers</h3>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.openingLines.map((opener, i) => {
              const isGrounded = highlightedSnippet === opener.citation.snippet;
              const isCopied = copiedIndex === i;
              const isPlaying = playingAudioId === `opener-${i}`;
              return (
                <div 
                  key={i} id={`opener-${i}`} 
                  className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between group relative overflow-hidden ${isGrounded ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.05]' : 'bg-white border-slate-100 hover:shadow-2xl hover:border-indigo-100'}`}
                >
                  <div className="absolute top-4 right-4 flex gap-2">
                    <button 
                      onClick={() => playSnippet(opener.text, `opener-${i}`)}
                      className={`p-2 rounded-full transition-all ${isGrounded ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'} ${isPlaying ? 'animate-pulse ring-2 ring-indigo-300' : ''}`}
                    >
                      {isPlaying ? <ICONS.Speaker /> : <ICONS.Play />}
                    </button>
                    <button 
                      onClick={() => copyToClipboard(opener.text, i, 'opener')}
                      className={`p-2 rounded-full transition-all ${isGrounded ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-50 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50'}`}
                    >
                      {isCopied ? <ICONS.Trophy /> : <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg>}
                    </button>
                  </div>
                  <div>
                    <div className={`inline-block px-3 py-1 rounded-full mb-6 ${isGrounded ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}><p className="text-[9px] font-black uppercase tracking-widest">{opener.label}</p></div>
                    <p className={`text-xl font-bold leading-tight italic ${isGrounded ? 'text-white' : 'text-slate-800'}`}>“{opener.text}”</p>
                  </div>
                  <div className="mt-8 flex items-center justify-between">
                    <GroundingButton citation={opener.citation} active={isGrounded} color={isGrounded ? 'slate' : 'indigo'} />
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Anticipated Dialogue Flow */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><ICONS.Chat /></div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Anticipated Dialogue Flow</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {result.predictedQuestions.map((qa, i) => (
              <div key={i} id={`predicted-q-${i}`} className={`border-2 rounded-[2.5rem] p-8 transition-all duration-500 group ${highlightedSnippet === qa.citation.snippet ? 'bg-indigo-50/50 border-indigo-400' : 'bg-white border-slate-100 hover:border-indigo-100 shadow-sm'}`}>
                <div className="flex items-center justify-between mb-6">
                  <span className="px-4 py-1.5 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-[0.2em] rounded-full">{qa.category}</span>
                  <GroundingButton citation={qa.citation} active={highlightedSnippet === qa.citation.snippet} color="slate" />
                </div>
                <p className="text-xl font-black text-slate-900 mb-6 italic group-hover:text-indigo-900 transition-colors">“{qa.customerAsks}”</p>
                <div className="bg-white/80 rounded-3xl p-6 border border-slate-100 relative">
                   <button 
                      onClick={() => playSnippet(qa.salespersonShouldRespond, `predicted-resp-${i}`)}
                      className={`absolute top-4 right-4 p-2 rounded-xl transition-all ${playingAudioId === `predicted-resp-${i}` ? 'bg-indigo-600 text-white animate-pulse' : 'bg-slate-50 text-slate-400 hover:text-indigo-600'}`}
                    >
                      {playingAudioId === `predicted-resp-${i}` ? <ICONS.Speaker /> : <ICONS.Play />}
                    </button>
                  <p className="text-[10px] font-black uppercase text-indigo-400 mb-2 tracking-widest">Strategic Response</p>
                  <p className="text-base text-slate-700 font-medium leading-relaxed pr-10">“{qa.salespersonShouldRespond}”</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Objection Defense */}
        <section className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><ICONS.Shield /></div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Objection Defense</h3>
          </div>
          <div className="space-y-6">
            {result.objectionHandling.map((obj, i) => {
              const isExpanded = expandedObjections.has(i);
              const isGrounded = highlightedSnippet === obj.citation.snippet;
              const isCopied = copiedObjectionIndex === i;
              const isPlaying = playingAudioId === `objection-resp-${i}`;

              return (
                <div key={i} id={`objection-handle-${i}`} className={`border-2 rounded-[2.5rem] overflow-hidden transition-all duration-500 ${isGrounded ? 'ring-4 ring-rose-100 border-rose-400 scale-[1.01]' : 'border-slate-100 bg-white hover:border-rose-200'}`}>
                  <div onClick={() => toggleObjection(i)} className={`p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer transition-all ${isExpanded ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}>
                    <div className="flex items-center gap-5">
                      <div className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${isExpanded ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-500'}`}><svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg></div>
                      <div>
                        <div className="flex items-center gap-2 mb-1"><span className="text-[10px] font-black uppercase text-rose-500 tracking-[0.25em]">Conflict Detected</span>{!isExpanded && <span className="text-[8px] font-bold text-slate-400 uppercase tracking-widest bg-slate-100 px-2 py-0.5 rounded-full">Expand Strategy</span>}</div>
                        <p className="text-xl font-black text-slate-900 italic leading-tight">“{obj.objection}”</p>
                      </div>
                    </div>
                    <GroundingButton citation={obj.citation} active={isGrounded} color="rose" />
                  </div>
                  <div className={`transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                    <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-rose-100/50 bg-white">
                      <div className="space-y-10">
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-rose-200 rounded-full"></div><h6 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Psychological Meaning</h6></div><p className="text-slate-600 leading-relaxed font-medium text-lg pl-3.5 border-l-2 border-slate-50 italic">“{obj.realMeaning}”</p></div>
                        <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-700"><div className="flex items-center gap-2"><div className="w-1.5 h-6 bg-rose-400 rounded-full"></div><h6 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Strategy Breakdown</h6></div><p className="text-slate-700 leading-relaxed font-semibold text-base pl-3.5">{obj.strategy}</p></div>
                      </div>
                      <div className="relative group/wording animate-in fade-in zoom-in duration-500">
                        <div className="bg-indigo-600 text-white rounded-[2.5rem] p-10 shadow-2xl relative min-h-[250px] flex flex-col items-center justify-center text-center overflow-hidden">
                          <div className="absolute top-6 flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20"><h6 className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em]">Battle-Hardened Response</h6></div>
                          <p className="text-2xl font-bold italic leading-relaxed pt-4">“{obj.exactWording}”</p>
                          <div className="mt-10 flex gap-4">
                            <button 
                               onClick={() => playSnippet(obj.exactWording, `objection-resp-${i}`)}
                               className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/20 text-white hover:bg-white/30'}`}
                            >
                               {isPlaying ? <><ICONS.Speaker /> Playing</> : <><ICONS.Play /> Listen</>}
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); copyToClipboard(obj.exactWording, i, 'objection'); }} className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3 ${isCopied ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}>{isCopied ? <><ICONS.Trophy /> Copied!</> : <><svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" /></svg> Copy</>}</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      </div>

      <style>{`
        .no-scrollbar::-webkit-scrollbar { display: none; }
        .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        
        mark[data-snippet] { 
          cursor: pointer; 
          transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1); 
          border-radius: 4px; 
          padding: 0 4px; 
          margin: 0 -2px; 
          position: relative;
        }

        @keyframes cinematic-focus {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.8), 0 0 0 0 rgba(251, 191, 36, 0.8); outline: 2px solid rgba(99, 102, 241, 0.8); outline-offset: 4px; transform: scale(1); }
          15% { box-shadow: 0 0 40px 20px rgba(99, 102, 241, 0.2), 0 0 20px 5px rgba(251, 191, 36, 0.4); outline: 4px solid rgba(251, 191, 36, 1); outline-offset: 12px; transform: scale(1.08); }
          30% { box-shadow: 0 0 25px 10px rgba(99, 102, 241, 0.3), 0 0 10px 2px rgba(251, 191, 36, 0.3); outline: 2px solid rgba(99, 102, 241, 1); outline-offset: 8px; transform: scale(1.05); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); outline: 2px solid rgba(99, 102, 241, 0); outline-offset: 4px; transform: scale(1); }
        }

        .grounding-active {
          animation: cinematic-focus 5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards;
          background-color: #fbbf24 !important;
          color: #78350f !important;
          z-index: 50;
          font-weight: 800;
          position: relative;
        }

        .grounding-active::after {
          content: "";
          position: absolute;
          inset: -12px;
          border: 2px solid #6366f1;
          border-radius: 8px;
          opacity: 0.4;
          animation: bounding-box-fade 5s ease-out forwards;
        }

        @keyframes bounding-box-fade {
          0% { transform: scale(0.9); opacity: 1; border-width: 4px; }
          20% { transform: scale(1); opacity: 0.8; border-width: 2px; }
          100% { transform: scale(1.1); opacity: 0; border-width: 1px; }
        }
      `}</style>
    </div>
  );
};

const IntensityBar = ({ label, value, color }: { label: string, value: number, color: string }) => (
  <div className="space-y-1.5">
    <div className="flex justify-between items-end">
      <span className="text-[9px] font-black uppercase tracking-widest text-slate-500">{label}</span>
      <span className={`text-[10px] font-black text-${color}-600`}>{Math.round(value)}%</span>
    </div>
    <div className="h-2 w-full bg-white rounded-full overflow-hidden border border-slate-100 shadow-inner">
      <div 
        className={`h-full rounded-full bg-${color}-500 transition-all duration-1000 ease-out shadow-[0_0_10px_rgba(var(--tw-color-${color}-500),0.3)]`}
        style={{ width: `${value}%` }}
      ></div>
    </div>
  </div>
);

const PsychologicalRadar = ({ snapshot }: { snapshot: BuyerSnapshot }) => {
  const points = useMemo(() => {
    const metrics = [
      { label: 'Risk Tolerance', value: parseIntensity(snapshot.riskTolerance, ['high', 'aggressive'], ['low', 'averse']) },
      { label: 'Strategic Focus', value: parseIntensity(snapshot.role, ['ceo', 'director', 'vp'], ['engineer', 'admin']) },
      { label: 'Analytical Depth', value: parseIntensity(snapshot.decisionStyle, ['analytical', 'data'], ['gut', 'fast']) },
      { label: 'Directness', value: parseIntensity(snapshot.tone, ['direct', 'assertive'], ['indirect', 'casual']) },
      { label: 'Innovation', value: parseIntensity(snapshot.decisionStyle, ['innovative'], ['legacy', 'proven']) },
    ];

    const size = 300, center = size / 2, radius = (size / 2) * 0.8;
    const polarToCartesian = (angle: number, r: number) => ({
        x: center + r * Math.cos((angle - 90) * (Math.PI / 180)),
        y: center + r * Math.sin((angle - 90) * (Math.PI / 180))
    });

    const axes = metrics.map((m, i) => {
      const angle = (i * 360) / metrics.length;
      return { ...m, angle, pos: polarToCartesian(angle, radius), valPos: polarToCartesian(angle, (m.value / 100) * radius) };
    });

    const pathData = axes.map((a, i) => `${i === 0 ? 'M' : 'L'} ${a.valPos.x} ${a.valPos.y}`).join(' ') + ' Z';
    return { size, center, radius, axes, pathData };
  }, [snapshot]);

  return (
    <svg viewBox={`0 0 ${points.size} ${points.size}`} className="w-full h-full drop-shadow-2xl overflow-visible">
      <defs>
        <radialGradient id="radar-glow" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
          <stop offset="0%" stopColor="rgba(99, 102, 241, 0.3)" />
          <stop offset="100%" stopColor="rgba(99, 102, 241, 0)" />
        </radialGradient>
      </defs>
      <circle cx={points.center} cy={points.center} r={points.radius} fill="url(#radar-glow)" />
      {[0.2, 0.4, 0.6, 0.8, 1].map((r, i) => <circle key={i} cx={points.center} cy={points.center} r={points.radius * r} fill="none" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" />)}
      {points.axes.map((a, i) => <line key={i} x1={points.center} y1={points.center} x2={a.pos.x} y2={a.pos.y} stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />)}
      {points.axes.map((a, i) => {
        const textPos = {
          x: points.center + (points.radius + 30) * Math.cos((a.angle - 90) * (Math.PI / 180)),
          y: points.center + (points.radius + 30) * Math.sin((a.angle - 90) * (Math.PI / 180))
        };
        return <text key={i} x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-black uppercase tracking-tighter fill-slate-500">{a.label}</text>;
      })}
      <path d={points.pathData} fill="rgba(99, 102, 241, 0.25)" stroke="rgba(99, 102, 241, 0.8)" strokeWidth="4" strokeLinejoin="round" className="animate-pulse" />
      {points.axes.map((a, i) => <circle key={i} cx={a.valPos.x} cy={a.valPos.y} r="4" fill="#4f46e5" stroke="white" strokeWidth="2" />)}
    </svg>
  );
};

const DocumentHighlighter = ({ text, citations, onHighlightClick, highlightedSnippet }: { 
  text: string; 
  citations: (Citation & { id: string })[]; 
  onHighlightClick: (id: string) => void;
  highlightedSnippet: string | null;
}) => {
  if (!citations.length) return <>{text}</>;
  const sortedCitations = [...citations].sort((a, b) => b.snippet.length - a.snippet.length);
  let parts: React.ReactNode[] = [text];
  sortedCitations.forEach((cit) => {
    const newParts: React.ReactNode[] = [];
    parts.forEach((part) => {
      if (typeof part !== 'string') { newParts.push(part); return; }
      const snippet = cit.snippet.trim();
      const index = part.indexOf(snippet);
      if (index === -1) { newParts.push(part); } else {
        const before = part.slice(0, index);
        const after = part.slice(index + snippet.length);
        if (before) newParts.push(before);
        newParts.push(<mark key={`${cit.id}-${index}`} data-snippet={cit.snippet} onClick={() => onHighlightClick(cit.id)} className={`cursor-pointer transition-all duration-300 font-semibold ${highlightedSnippet === cit.snippet ? 'bg-amber-400 text-amber-900 ring-4 ring-amber-200 scale-110 shadow-xl' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>{snippet}</mark>);
        if (after) newParts.push(after);
      }
    });
    parts = newParts;
  });
  return <>{parts}</>;
};

const SnapshotCard = ({ id, label, value, citation, activeSnippet, onViewSource }: { id: string; label: string; value: string; citation: Citation; activeSnippet: string | null; onViewSource: (c: Citation) => void }) => {
  const active = activeSnippet === citation.snippet;
  return (
    <div id={id} className={`p-8 rounded-[2.5rem] border flex flex-col justify-between transition-all duration-500 group relative ${active ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.05] z-10' : 'bg-white/40 border-indigo-200/50 backdrop-blur-sm hover:shadow-2xl hover:bg-white hover:border-indigo-400 hover:-translate-y-1'}`}>
      <div className={`absolute top-6 right-6 transition-colors ${active ? 'text-indigo-200' : 'text-indigo-100 group-hover:text-indigo-400'}`}><ICONS.Shield /></div>
      <div>
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${active ? 'text-indigo-100' : 'text-indigo-500'}`}>{label}</p>
        <p className={`text-xl font-black leading-tight tracking-tight ${active ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      </div>
      <button onClick={() => onViewSource(citation)} className={`mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all transform ${active ? 'text-white' : 'text-indigo-500 opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0'}`}><ICONS.Document /> {active ? "Evidence Active" : "Verify Insight"}</button>
    </div>
  );
};
