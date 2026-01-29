
import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AnalysisResult, Citation, UploadedFile, BuyerSnapshot, OpeningLine, DocumentSummary, ObjectionPair } from '../types';
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
    (result.openingLines || []).forEach((ol, i) => add(ol.citation, `Opener: ${ol.text}`, `opener-${i}`, "Conversation"));
    (result.predictedQuestions || []).forEach((q, i) => add(q.citation, `Question: ${q.customerAsks}`, `predicted-q-${i}`, "Dialogue"));
    (result.strategicQuestionsToAsk || []).forEach((s, i) => add(s.citation, `Discovery Q: ${s.question}`, `strategic-q-${i}`, "Dialogue"));
    (result.objectionHandling || []).forEach((o, i) => add(o.citation, `Counter: ${o.objection}`, `objection-handle-${i}`, "Tactical"));
    
    (result.documentInsights.entities || []).forEach((ent, i) => {
      add(ent.citation, `${ent.type}: ${ent.name}`, `entity-${i}`, "Entity");
    });

    return list;
  }, [result]);

  useEffect(() => {
    if (highlightedSnippet) {
      (result.objectionHandling || []).forEach((obj, i) => {
        if (obj.citation?.snippet === highlightedSnippet) {
          setExpandedObjections(prev => {
            const next = new Set(prev);
            next.add(i);
            return next;
          });
        }
      });
    }
  }, [highlightedSnippet, result.objectionHandling]);

  const handleDownloadPdf = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = window.jspdf;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const contentWidth = pageWidth - (margin * 2);

      const checkNewPage = (needed: number) => {
        if (y + needed > doc.internal.pageSize.getHeight() - margin) {
          doc.addPage();
          drawFooter();
          y = margin + 10;
          return true;
        }
        return false;
      };

      const drawFooter = () => {
        const pageCount = doc.internal.getNumberOfPages();
        doc.setFontSize(8);
        doc.setTextColor(150, 150, 150);
        doc.text(`Cognitive Sales Intelligence - Strategic Brief | Page ${pageCount}`, margin, doc.internal.pageSize.getHeight() - 10);
      };

      const addText = (text: string, size: number, style: 'normal' | 'bold' | 'italic' = 'normal', color: [number, number, number] = [30, 41, 59]) => {
        doc.setFontSize(size);
        doc.setFont('helvetica', style);
        doc.setTextColor(...color);
        const lines = doc.splitTextToSize(text || "", contentWidth);
        checkNewPage(lines.length * (size / 2) + 5);
        doc.text(lines, margin, y);
        y += (lines.length * (size / 2)) + 5;
      };

      const addSectionHeading = (title: string) => {
        checkNewPage(30);
        y += 5;
        doc.setFillColor(79, 70, 229); // Indigo 600
        doc.rect(margin, y - 5, 3, 10, 'F');
        doc.setFontSize(14);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text((title || "").toUpperCase(), margin + 6, y + 2);
        y += 15;
      };

      // Header
      doc.setFillColor(79, 70, 229);
      doc.rect(0, 0, pageWidth, 40, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(24);
      doc.setFont('helvetica', 'bold');
      doc.text("Sales Strategy Brief", margin, 25);
      doc.setFontSize(10);
      doc.setFont('helvetica', 'normal');
      doc.text(`Generated on ${new Date().toLocaleDateString()} | Target: ${result.snapshot.role}`, margin, 34);
      y = 55;

      addSectionHeading("Buyer Psychology Profile");
      addText(`Optimized for a ${result.snapshot.role} with a ${(result.snapshot.decisionStyle || "").toLowerCase()} style.`, 11);
      y += 5;
      addText("Archetype:", 10, 'bold', [79, 70, 229]);
      addText(`${archetype.title}: ${archetype.desc}`, 11);
      addText("Risk Tolerance:", 10, 'bold', [100, 116, 139]);
      addText(result.snapshot.riskTolerance, 11);
      
      addSectionHeading("Core Priorities");
      (result.snapshot.priorities || []).forEach(p => addText(`• ${p.text}`, 11));

      addSectionHeading("Document Insights & Summaries");
      (result.documentInsights.summaries || []).forEach(summary => {
        addText(`SOURCE: ${summary.fileName}`, 11, 'bold');
        addText(`STRATEGIC IMPACT: ${summary.strategicImpact}`, 10, 'bold', [79, 70, 229]);
        addText(summary.summary, 10, 'normal', [71, 85, 105]);
        summary.criticalInsights.forEach(insight => addText(`  - ${insight}`, 10, 'italic'));
        y += 8;
      });

      addSectionHeading("Objection Handling");
      (result.objectionHandling || []).forEach(obj => {
        addText(`OBJECTION: "${obj.objection}"`, 11, 'bold', [225, 29, 72]); // Rose 600
        addText(`SUBTEXT: ${obj.realMeaning}`, 10, 'italic');
        addText(`STRATEGY: ${obj.strategy}`, 10);
        addText(`BATTLE-READY WORDING: "${obj.exactWording}"`, 11, 'bold', [79, 70, 229]);
        y += 8;
      });

      addSectionHeading("Discovery Questions");
      (result.strategicQuestionsToAsk || []).forEach(sq => {
        addText(`QUESTION: "${sq.question}"`, 11, 'bold');
        addText(`STRATEGIC INTENT: ${sq.whyItMatters}`, 10, 'italic', [100, 116, 139]);
        y += 5;
      });

      addSectionHeading("Final Sales Coaching");
      addText("DOS:", 10, 'bold', [16, 185, 129]); // Emerald 500
      (result.finalCoaching.dos || []).forEach(d => addText(`• ${d}`, 10));
      y += 5;
      addText("DON'TS:", 10, 'bold', [244, 63, 94]); // Rose 500
      (result.finalCoaching.donts || []).forEach(d => addText(`• ${d}`, 10));
      y += 5;
      addText("FINAL ADVICE:", 10, 'bold');
      addText(result.finalCoaching.finalAdvice, 10, 'italic');

      drawFooter();
      doc.save(`Sales_Brief_${result.snapshot.role.replace(/\s+/g, '_')}.pdf`);
    } catch (err) {
      console.error("PDF generation failed:", err);
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

  return (
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20" ref={analysisRef}>
      
      {/* ACTION BAR */}
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

      {/* COGNITIVE PROFILE DASHBOARD */}
      <section 
        id="snapshot-root" 
        className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200 relative overflow-hidden group/snap"
      >
        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover/snap:opacity-10 transition-opacity">
           <ICONS.Brain className="w-48 h-48 text-indigo-900" />
        </div>
        
        <div className="relative z-10 flex flex-col xl:flex-row gap-16 items-start">
          {/* Radar & Archetype Column */}
          <div className="w-full xl:w-[400px] space-y-10">
            <div className="text-center">
               <div className="inline-flex items-center gap-2 px-5 py-2 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100 mb-6">
                  <div className="w-2 h-2 bg-indigo-600 rounded-full animate-ping"></div>
                  <span className="text-[10px] font-black uppercase tracking-[0.2em]">Inferred Archetype</span>
               </div>
               <h2 className="text-4xl font-black text-slate-900 tracking-tight leading-none mb-4">{archetype.title}</h2>
               <p className="text-slate-500 font-medium leading-relaxed max-w-sm mx-auto italic">“{archetype.desc}”</p>
            </div>

            <div className="relative aspect-square bg-slate-50/50 rounded-[3rem] p-8 border border-slate-100 shadow-inner">
               <PsychologicalRadar snapshot={result.snapshot} />
            </div>

            <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl space-y-6">
               <div className="flex items-center gap-3">
                  <div className="p-2 bg-indigo-500 text-white rounded-xl"><ICONS.ROI /></div>
                  <h5 className="text-[11px] font-black uppercase tracking-[0.2em] text-indigo-100">Decision Matrix Intensity</h5>
               </div>
               <IntensityBar label="Risk Tolerance" value={parseIntensity(result.snapshot.riskTolerance, ['high', 'aggressive'], ['low', 'averse'])} color="rose" />
               <IntensityBar label="Analytical Depth" value={parseIntensity(result.snapshot.decisionStyle, ['analytical', 'data'], ['gut', 'fast'])} color="indigo" />
               <IntensityBar label="Deal Velocity" value={parseIntensity(result.snapshot.tone, ['direct', 'urgent'], ['casual', 'slow'])} color="emerald" />
            </div>
          </div>

          {/* Traits & Priorities Column */}
          <div className="flex-1 space-y-12">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <SnapshotCard id="snapshot-role" label="Persona Role" value={result.snapshot.role} confidence={result.snapshot.roleConfidence} citation={result.snapshot.roleCitation} activeSnippet={highlightedSnippet} onViewSource={scrollToSource} />
               <SnapshotCard id="snapshot-decision" label="Commercial Tone" value={result.snapshot.tone} confidence={0.94} citation={result.snapshot.decisionStyleCitation} activeSnippet={highlightedSnippet} onViewSource={scrollToSource} />
            </div>

            <div className="space-y-8">
               <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                  <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-400">Strategic Priority Map</h4>
                  <span className="text-[9px] font-bold text-indigo-500 bg-indigo-50 px-3 py-1 rounded-full border border-indigo-100">Grounded Logic</span>
               </div>
               
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {(result.snapshot.priorities || []).map((item, i) => {
                    const theme = getPriorityTheme(item.text);
                    const isGrounded = highlightedSnippet === item.citation?.snippet;
                    return (
                      <div 
                        key={i} id={`priority-${i}`} 
                        onClick={() => scrollToSource(item.citation)}
                        className={`group p-8 rounded-[2.5rem] border transition-all duration-500 cursor-pointer relative overflow-hidden ${isGrounded ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 hover:shadow-xl'}`}
                      >
                        <div className="flex items-center gap-4 mb-6">
                           <div className={`p-4 rounded-2xl transition-colors ${isGrounded ? 'bg-white/20 text-white' : 'bg-slate-50 text-indigo-500'}`}>{theme.icon}</div>
                           <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest ${isGrounded ? 'text-indigo-200' : 'text-slate-400'}`}>{theme.label} Pillar</p>
                              <p className={`text-lg font-black tracking-tight ${isGrounded ? 'text-white' : 'text-slate-800'}`}>{item.text}</p>
                           </div>
                        </div>
                        <div className="space-y-2">
                           <div className="flex justify-between text-[9px] font-black uppercase tracking-widest opacity-60">
                              <span>Importance Metric</span>
                              <span>{Math.max(60, 95 - i * 10)}%</span>
                           </div>
                           <div className={`h-2 w-full rounded-full ${isGrounded ? 'bg-white/20' : 'bg-slate-100'} overflow-hidden`}>
                              <div className={`h-full rounded-full transition-all duration-1000 ${isGrounded ? 'bg-white' : `bg-${theme.color}-500`}`} style={{ width: `${95 - i * 10}%` }}></div>
                           </div>
                        </div>
                      </div>
                    );
                  })}
               </div>
            </div>
          </div>
        </div>
      </section>

      {/* DOCUMENT SUMMARIES */}
      <section className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200">
         <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Source Material Synthesis</h2>
              <p className="text-sm text-slate-500">Persistent documentary analysis derived from the memory-retained files.</p>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {(result.documentInsights.summaries || []).map((summary, idx) => (
              <div key={idx} className="p-8 bg-slate-50 border border-slate-100 rounded-[2.5rem] space-y-6 hover:bg-white hover:border-indigo-200 transition-all shadow-sm group">
                <div className="flex justify-between items-start">
                   <h4 className="text-[11px] font-black uppercase text-indigo-500 tracking-[0.2em]">{summary.fileName}</h4>
                </div>
                <div>
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Strategic Impact</p>
                   <p className="text-sm font-bold text-slate-900 leading-relaxed italic border-l-2 border-indigo-200 pl-4">“{summary.strategicImpact}”</p>
                </div>
                <div className="pt-4 border-t border-slate-200/50">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Critical Insights</p>
                   <ul className="space-y-2">
                     {(summary.criticalInsights || []).map((insight, i) => (
                       <li key={i} className="flex gap-3 text-xs text-slate-700 font-medium">
                          <span className="text-indigo-400 mt-0.5">●</span>
                          {insight}
                       </li>
                     ))}
                   </ul>
                </div>
                <div className="pt-4 border-t border-slate-200/50">
                   <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">Executive Overview</p>
                   <p className="text-xs text-slate-500 leading-relaxed">{summary.summary}</p>
                </div>
              </div>
            ))}
          </div>
      </section>

      {/* GROUNDING EXPLORER */}
      <section id="grounding-explorer" className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Shield /></div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cognitive Evidence Matrix</h2>
              <p className="text-sm text-slate-500">Inspecting grounded snippets from persistent document memory.</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-1 space-y-4">
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
              {allCitations.map((cit, idx) => (
                <button 
                  key={`${cit.id}-${idx}`}
                  onClick={() => { scrollToSource(cit); scrollToAnalysis(cit.id); }}
                  className={`w-full text-left p-3 rounded-xl border transition-all group ${highlightedSnippet === cit.snippet ? 'bg-indigo-600 border-indigo-600' : 'border-slate-100 bg-slate-50 hover:bg-white hover:border-indigo-300'}`}
                >
                  <p className={`text-[8px] font-bold uppercase mb-1 truncate ${highlightedSnippet === cit.snippet ? 'text-indigo-200' : 'text-slate-400'}`}>{cit.sourceFile}</p>
                  <p className={`text-xs font-semibold line-clamp-2 leading-snug ${highlightedSnippet === cit.snippet ? 'text-white' : 'text-slate-700'}`}>"{cit.label}"</p>
                </button>
              ))}
            </div>
          </div>

          <div className="lg:col-span-3 bg-slate-50 rounded-3xl border border-slate-200 overflow-hidden flex flex-col h-[600px] shadow-inner">
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

      {/* STRATEGIC OPENERS */}
      <section className="space-y-8">
        <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 ml-4">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><ICONS.Document /></div>
          Strategic Conversation Openers
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {(result.openingLines || []).map((opener, i) => {
            const isGrounded = highlightedSnippet === opener.citation?.snippet;
            const isPlaying = playingAudioId === `opener-${i}`;
            return (
              <div 
                key={i} id={`opener-${i}`} 
                className={`p-8 rounded-[2.5rem] border transition-all duration-500 flex flex-col justify-between group relative overflow-hidden ${isGrounded ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.05]' : 'bg-white border-slate-100 hover:shadow-2xl hover:border-indigo-100'}`}
              >
                <div className="absolute top-4 right-4 flex gap-2">
                  <button 
                    onClick={() => playSnippet(opener.text, `opener-${i}`)}
                    className={`p-2 rounded-full transition-all ${isGrounded ? 'bg-white/10 text-white' : 'bg-slate-50 text-slate-400'} ${isPlaying ? 'animate-pulse' : ''}`}
                  >
                    {isPlaying ? <ICONS.Speaker /> : <ICONS.Play />}
                  </button>
                </div>
                <div>
                  <div className={`inline-block px-3 py-1 rounded-full mb-6 ${isGrounded ? 'bg-white/10 text-white' : 'bg-indigo-50 text-indigo-600'}`}><p className="text-[9px] font-black uppercase tracking-widest">{opener.label}</p></div>
                  <p className={`text-xl font-bold leading-tight italic ${isGrounded ? 'text-white' : 'text-slate-800'}`}>“{opener.text}”</p>
                </div>
                <div className="mt-8">
                  <GroundingButton citation={opener.citation} active={isGrounded} color={isGrounded ? 'slate' : 'indigo'} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* OBJECTION DEFENSE (EXPANDABLE) */}
      <section className="space-y-8">
        <h3 className="text-2xl font-bold text-slate-800 flex items-center gap-3 ml-4">
          <div className="p-2 bg-slate-100 rounded-lg text-slate-500"><ICONS.Shield /></div>
          Objection Handling & Defense
        </h3>
        <div className="space-y-6">
          {(result.objectionHandling || []).map((obj, i) => {
            const isExpanded = expandedObjections.has(i);
            const isGrounded = highlightedSnippet === obj.citation?.snippet;
            const isPlaying = playingAudioId === `objection-resp-${i}`;

            return (
              <div key={i} id={`objection-handle-${i}`} className={`border-2 rounded-[2.5rem] overflow-hidden transition-all duration-500 ${isGrounded ? 'ring-4 ring-rose-100 border-rose-400' : 'border-slate-100 bg-white hover:border-rose-200'}`}>
                <div onClick={() => toggleObjection(i)} className={`p-8 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 cursor-pointer transition-all ${isExpanded ? 'bg-rose-50/40' : 'hover:bg-slate-50'}`}>
                  <div className="flex items-center gap-5">
                    <div className={`shrink-0 w-12 h-12 flex items-center justify-center rounded-2xl transition-all ${isExpanded ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-500'}`}>
                      <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] font-black uppercase text-rose-500 tracking-[0.25em]">Conflict Predicted</span>
                      </div>
                      <p className="text-xl font-black text-slate-900 italic leading-tight">“{obj.objection}”</p>
                    </div>
                  </div>
                  <GroundingButton citation={obj.citation} active={isGrounded} color="rose" />
                </div>
                
                <div className={`transition-all duration-700 ease-in-out ${isExpanded ? 'max-h-[1000px] opacity-100' : 'max-h-0 opacity-0'} overflow-hidden`}>
                  <div className="p-10 grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-rose-100/50 bg-white">
                    <div className="space-y-10">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-6 bg-rose-200 rounded-full"></div>
                           <h6 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Psychological Subtext</h6>
                        </div>
                        <p className="text-slate-600 leading-relaxed font-medium text-lg pl-3.5 italic border-l-2 border-slate-50">“{obj.realMeaning}”</p>
                      </div>
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                           <div className="w-1.5 h-6 bg-rose-400 rounded-full"></div>
                           <h6 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Strategic Pivot Strategy</h6>
                        </div>
                        <p className="text-slate-700 leading-relaxed font-semibold text-base pl-3.5">{obj.strategy}</p>
                      </div>
                    </div>
                    
                    <div className="relative group/wording">
                      <div className="bg-indigo-600 text-white rounded-[2.5rem] p-10 shadow-2xl relative min-h-[250px] flex flex-col items-center justify-center text-center overflow-hidden">
                        <div className="absolute top-6 flex items-center gap-2 px-4 py-1.5 bg-white/10 backdrop-blur-md rounded-full border border-white/20">
                           <h6 className="text-[10px] font-black text-indigo-100 uppercase tracking-[0.3em]">Battle-Drill Response</h6>
                        </div>
                        <p className="text-2xl font-bold italic leading-relaxed pt-4">“{obj.exactWording}”</p>
                        <div className="mt-10 flex gap-4">
                          <button 
                             onClick={() => playSnippet(obj.exactWording, `objection-resp-${i}`)}
                             className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3 ${isPlaying ? 'bg-rose-500 text-white animate-pulse' : 'bg-white/20 text-white hover:bg-white/30'}`}
                          >
                             {isPlaying ? <><ICONS.Speaker /> Playing</> : <><ICONS.Play /> Listen</>}
                          </button>
                          <button 
                             onClick={(e) => { e.stopPropagation(); copyToClipboard(obj.exactWording, i, 'objection'); }} 
                             className={`px-8 py-3 rounded-full text-[11px] font-black uppercase tracking-widest transition-all transform active:scale-95 flex items-center gap-3 ${copiedObjectionIndex === i ? 'bg-emerald-500 text-white' : 'bg-white text-indigo-600 hover:bg-indigo-50'}`}
                          >
                             {copiedObjectionIndex === i ? <><ICONS.Trophy /> Copied!</> : "Copy Wording"}
                          </button>
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

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 20px; }
        
        mark[data-snippet] { 
          cursor: pointer; 
          transition: all 0.5s; 
          border-radius: 4px; 
          padding: 0 4px; 
        }

        @keyframes cinematic-focus {
          0% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0.8); transform: scale(1); }
          15% { box-shadow: 0 0 40px 20px rgba(99, 102, 241, 0.2); transform: scale(1.08); }
          100% { box-shadow: 0 0 0 0 rgba(99, 102, 241, 0); transform: scale(1); }
        }

        .grounding-active {
          animation: cinematic-focus 5s forwards;
          background-color: #fbbf24 !important;
          color: #78350f !important;
          font-weight: 800;
        }
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
    <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10 shadow-inner">
      <div 
        className={`h-full rounded-full bg-${color}-500 transition-all duration-1000 ease-out`}
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
      { label: 'Assertiveness', value: parseIntensity(snapshot.tone, ['direct', 'assertive'], ['indirect', 'casual']) },
      { label: 'Innovation Appetite', value: parseIntensity(snapshot.decisionStyle, ['innovative'], ['legacy', 'proven']) },
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
      <circle cx={points.center} cy={points.center} r={points.radius} fill="rgba(79, 70, 229, 0.03)" />
      {[0.2, 0.4, 0.6, 0.8, 1].map((r, i) => <circle key={i} cx={points.center} cy={points.center} r={points.radius * r} fill="none" stroke="rgba(99, 102, 241, 0.08)" strokeWidth="1" />)}
      {points.axes.map((a, i) => <line key={i} x1={points.center} y1={points.center} x2={a.pos.x} y2={a.pos.y} stroke="rgba(99, 102, 241, 0.1)" strokeWidth="1" />)}
      {points.axes.map((a, i) => {
        const textPos = {
          x: points.center + (points.radius + 30) * Math.cos((a.angle - 90) * (Math.PI / 180)),
          y: points.center + (points.radius + 30) * Math.sin((a.angle - 90) * (Math.PI / 180))
        };
        return <text key={i} x={textPos.x} y={textPos.y} textAnchor="middle" dominantBaseline="middle" className="text-[10px] font-black uppercase tracking-tighter fill-slate-500">{a.label}</text>;
      })}
      <path d={points.pathData} fill="rgba(99, 102, 241, 0.2)" stroke="rgba(99, 102, 241, 0.8)" strokeWidth="3" strokeLinejoin="round" className="animate-pulse" />
      {points.axes.map((a, i) => <circle key={i} cx={a.valPos.x} cy={a.valPos.y} r="3" fill="#4f46e5" stroke="white" strokeWidth="1.5" />)}
    </svg>
  );
};

const DocumentHighlighter = ({ text, citations, onHighlightClick, highlightedSnippet }: { 
  text: string; 
  citations: (Citation & { id: string })[]; 
  onHighlightClick: (id: string) => void;
  highlightedSnippet: string | null;
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
        newParts.push(<mark key={`${cit.id}-${index}`} data-snippet={cit.snippet} onClick={() => onHighlightClick(cit.id)} className={`cursor-pointer transition-all duration-300 font-semibold ${highlightedSnippet === cit.snippet ? 'bg-amber-400 text-amber-900 ring-4 ring-amber-200' : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'}`}>{snippet}</mark>);
        if (after) newParts.push(after);
      }
    });
    parts = newParts;
  });
  return <>{parts}</>;
};

const SnapshotCard = ({ id, label, value, confidence, citation, activeSnippet, onViewSource }: { id: string; label: string; value: string; confidence: number; citation: Citation; activeSnippet: string | null; onViewSource: (c: Citation) => void }) => {
  const active = citation && activeSnippet === citation.snippet;
  const score = Math.round((confidence || 0) * 100);
  return (
    <div id={id} className={`p-8 rounded-[2.5rem] border flex flex-col justify-between transition-all duration-500 group relative ${active ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.05] z-10' : 'bg-white/40 border-indigo-200/50 backdrop-blur-sm hover:shadow-2xl hover:bg-white hover:border-indigo-400 hover:-translate-y-1'}`}>
      <div className={`absolute top-6 right-6 transition-colors ${active ? 'text-indigo-200' : 'text-indigo-100 group-hover:text-indigo-400'}`}><ICONS.Shield /></div>
      <div className="absolute top-6 left-6 flex items-center gap-1.5">
         <div className={`h-1.5 w-8 rounded-full ${active ? 'bg-white/30' : 'bg-indigo-50'} overflow-hidden`}>
            <div className={`h-full rounded-full transition-all duration-1000 ${active ? 'bg-white' : 'bg-indigo-500'}`} style={{ width: `${score}%` }}></div>
         </div>
         <span className={`text-[8px] font-black uppercase tracking-widest ${active ? 'text-indigo-200' : 'text-slate-400'}`}>{score}% Confidence</span>
      </div>
      <div className="mt-8">
        <p className={`text-[10px] font-black uppercase tracking-[0.3em] mb-4 ${active ? 'text-indigo-100' : 'text-indigo-500'}`}>{label}</p>
        <p className={`text-xl font-black leading-tight tracking-tight ${active ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      </div>
      {citation && (
        <button onClick={() => onViewSource(citation)} className={`mt-8 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest transition-all transform ${active ? 'text-white' : 'text-indigo-500 opacity-0 group-hover:opacity-100 translate-y-3 group-hover:translate-y-0'}`}><ICONS.Document /> Verify Insight</button>
      )}
    </div>
  );
};
