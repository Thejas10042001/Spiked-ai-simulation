
import React, { useState, useRef, useMemo } from 'react';
import { AnalysisResult, Citation, UploadedFile, BuyerSnapshot, DocumentEntity, MeetingContext } from '../types';
import { ICONS } from '../constants';
import { generatePitchAudio, decodeAudioData } from '../services/geminiService';

interface AnalysisViewProps {
  result: AnalysisResult;
  files: UploadedFile[];
  context: MeetingContext;
}

const VOICES = [
  { name: 'Kore', label: 'Pro Male' },
  { name: 'Puck', label: 'High Energy' },
  { name: 'Charon', label: 'Deep Authority' },
  { name: 'Zephyr', label: 'Calm Strategist' },
];

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

const parseIntensity = (str: string, highKeys: string[], lowKeys: string[], base: number = 50) => {
  const s = (str || "").toLowerCase();
  let val = base;
  highKeys.forEach(k => { if (s.includes(k)) val += 20; });
  lowKeys.forEach(k => { if (s.includes(k)) val -= 20; });
  return Math.min(100, Math.max(10, val));
};

/**
 * Cinematic SVG Radar Chart for psychological trait visualization.
 */
const CognitiveRadarChart = ({ data }: { data: { label: string, value: number }[] }) => {
  const size = 320;
  const center = size / 2;
  const radius = size * 0.35;
  const angleStep = (Math.PI * 2) / data.length;

  const points = data.map((d, i) => {
    const angle = i * angleStep - Math.PI / 2;
    const r = (d.value / 100) * radius;
    return {
      x: center + r * Math.cos(angle),
      y: center + r * Math.sin(angle),
      labelX: center + (radius + 40) * Math.cos(angle),
      labelY: center + (radius + 40) * Math.sin(angle),
    };
  });

  const polygonPath = points.map(p => `${p.x},${p.y}`).join(' ');

  return (
    <div className="relative flex items-center justify-center animate-in zoom-in duration-1000 p-8">
      <div className="absolute inset-0 bg-indigo-500/5 rounded-full blur-3xl scale-125"></div>
      <svg width={size + 140} height={size + 80} className="overflow-visible drop-shadow-2xl relative z-10">
        <defs>
          <radialGradient id="radarGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="rgba(79, 70, 229, 0.4)" />
            <stop offset="100%" stopColor="rgba(79, 70, 229, 0.05)" />
          </radialGradient>
        </defs>
        
        {/* Radar Background Rings */}
        {[0.2, 0.4, 0.6, 0.8, 1].map((r, idx) => (
          <circle
            key={idx}
            cx={center}
            cy={center}
            r={radius * r}
            fill={idx === 4 ? "url(#radarGrad)" : "none"}
            stroke="rgba(79, 70, 229, 0.1)"
            strokeWidth="1"
            strokeDasharray={idx < 4 ? "2 2" : "0"}
          />
        ))}
        
        {/* Axis Lines */}
        {data.map((_, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={center + radius * Math.cos(i * angleStep - Math.PI / 2)}
            y2={center + radius * Math.sin(i * angleStep - Math.PI / 2)}
            stroke="rgba(79, 70, 229, 0.2)"
            strokeWidth="1"
          />
        ))}

        {/* The Data Polygon */}
        <polygon
          points={polygonPath}
          fill="rgba(79, 70, 229, 0.25)"
          stroke="rgba(79, 70, 229, 0.8)"
          strokeWidth="3"
          strokeLinejoin="round"
          className="transition-all duration-1000 ease-in-out"
        />
        
        {/* Labels */}
        {data.map((d, i) => (
          <text
            key={i}
            x={points[i].labelX}
            y={points[i].labelY}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-[10px] font-black uppercase tracking-[0.2em] fill-slate-400"
          >
            {d.label}
          </text>
        ))}
      </svg>
    </div>
  );
};

export const AnalysisView: React.FC<AnalysisViewProps> = ({ result, files, context }) => {
  const [highlightedSnippet, setHighlightedSnippet] = useState<string | null>(null);
  const [expandedObjections, setExpandedObjections] = useState<Set<number>>(new Set([0]));
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [selectedVoice, setSelectedVoice] = useState('Kore');
  const [isGeneratingAudio, setIsGeneratingAudio] = useState(false);
  const [entityFilter, setEntityFilter] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioSourceRef = useRef<AudioBufferSourceNode | null>(null);

  const archetype = useMemo(() => getArchetype(result.snapshot), [result.snapshot]);

  const radarData = useMemo(() => [
    { label: "Risk Appetite", value: parseIntensity(result.snapshot.riskTolerance, ['high', 'aggressive', 'bold'], ['low', 'averse', 'cautious']) },
    { label: "Analytical Logic", value: parseIntensity(result.snapshot.decisionStyle, ['analytical', 'data', 'metrics'], ['fast', 'intuition', 'gut']) },
    { label: "Velocity Focus", value: parseIntensity(result.snapshot.tone, ['fast', 'direct', 'urgent'], ['slow', 'patient', 'deliberate']) },
    { label: "Executive Level", value: parseIntensity(result.snapshot.role, ['ceo', 'vp', 'executive', 'lead', 'head'], ['analyst', 'associate', 'junior'], 70) },
    { label: "Consensus Need", value: parseIntensity(result.snapshot.decisionStyle, ['consensus', 'committee', 'peer'], ['unilateral', 'decisive'], 50) },
  ], [result.snapshot]);

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
    (result.documentInsights.entities || []).forEach((e, i) => add(e.citation, `Entity: ${e.name}`, `entity-${i}`, "Documentary"));
    
    return list;
  }, [result]);

  const filteredEntities = useMemo(() => {
    const entities = result.documentInsights.entities || [];
    if (!entityFilter) return entities;
    return entities.filter(e => e.type === entityFilter);
  }, [result.documentInsights.entities, entityFilter]);

  const toggleObjection = (idx: number) => {
    const next = new Set(expandedObjections);
    if (next.has(idx)) next.delete(idx);
    else next.add(idx);
    setExpandedObjections(next);
  };

  const playAudioForText = async (text: string, id: string) => {
    if (playingAudioId === id) {
      audioSourceRef.current?.stop();
      setPlayingAudioId(null);
      return;
    }

    setIsGeneratingAudio(true);
    setPlayingAudioId(id);
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      }
      const bytes = await generatePitchAudio(text, selectedVoice);
      if (!bytes) throw new Error("Audio generation failed");
      
      const buffer = await decodeAudioData(bytes, audioContextRef.current, 24000, 1);
      const source = audioContextRef.current.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContextRef.current.destination);
      source.onended = () => setPlayingAudioId(null);
      
      audioSourceRef.current?.stop();
      audioSourceRef.current = source;
      source.start();
    } catch (e) {
      console.error(e);
      setPlayingAudioId(null);
    } finally {
      setIsGeneratingAudio(false);
    }
  };

  const scrollToSource = (citation: Citation) => {
    if (!citation?.snippet) return;
    setHighlightedSnippet(citation.snippet);
    const explorer = document.getElementById('grounding-explorer');
    if (explorer) explorer.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const generateReportPDF = async () => {
    setIsExporting(true);
    try {
      const { jsPDF } = (window as any).jspdf;
      const doc = new jsPDF();
      let y = 20;
      const margin = 20;
      const pageWidth = doc.internal.pageSize.getWidth();
      const lineSpacing = 8;

      const addPageIfNeeded = (height: number) => {
        if (y + height > 280) {
          doc.addPage();
          y = 20;
        }
      };

      // Header
      doc.setFont("helvetica", "bold");
      doc.setFontSize(22);
      doc.setTextColor(79, 70, 229); // Indigo
      doc.text("Cognitive Sales Strategy Report", margin, y);
      y += 15;

      // Basic Context
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.setFont("helvetica", "normal");
      doc.text(`Client: ${context.clientCompany || "Unknown"}`, margin, y);
      y += 8;
      doc.text(`Seller: ${context.sellerCompany || "Unknown"}`, margin, y);
      y += 8;
      doc.text(`Meeting Focus: ${context.meetingFocus || "General Strategy"}`, margin, y);
      y += 20;

      // Buyer Snapshot Section
      addPageIfNeeded(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(16);
      doc.setTextColor(0);
      doc.text("Buyer Psychological Profile", margin, y);
      y += 12;

      doc.setFontSize(14);
      doc.setTextColor(79, 70, 229);
      doc.text(archetype.title, margin, y);
      y += 8;

      doc.setFontSize(11);
      doc.setTextColor(100);
      doc.setFont("helvetica", "italic");
      const archeText = doc.splitTextToSize(`“${archetype.desc}”`, pageWidth - margin * 2);
      doc.text(archeText, margin, y);
      y += archeText.length * 5 + 10;

      doc.setFont("helvetica", "bold");
      doc.setTextColor(0);
      doc.setFontSize(12);
      doc.text("Core Traits:", margin, y);
      y += 8;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      doc.text(`- Risk Tolerance: ${result.snapshot.riskTolerance}`, margin + 5, y); y += 6;
      doc.text(`- Decision Style: ${result.snapshot.decisionStyle}`, margin + 5, y); y += 6;
      doc.text(`- Interaction Tone: ${result.snapshot.tone}`, margin + 5, y); y += 15;

      // Priorities
      addPageIfNeeded(50);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Strategic Priorities", margin, y);
      y += 10;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      (result.snapshot.priorities || []).forEach(p => {
        addPageIfNeeded(10);
        doc.text(`• ${p.text}`, margin + 5, y);
        y += 7;
      });
      y += 10;

      // Entity Intelligence
      addPageIfNeeded(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Key Identified Entities", margin, y);
      y += 10;
      (result.documentInsights.entities || []).slice(0, 15).forEach(e => {
        addPageIfNeeded(20);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(`${e.name} (${e.type})`, margin + 5, y);
        y += 5;
        doc.setFont("helvetica", "normal");
        const ctxText = doc.splitTextToSize(e.context, pageWidth - margin * 3);
        doc.text(ctxText, margin + 8, y);
        y += ctxText.length * 5 + 5;
      });
      y += 10;

      // Objection Battle Drills
      addPageIfNeeded(60);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Objection Battle-Drills", margin, y);
      y += 10;
      (result.objectionHandling || []).forEach((obj, idx) => {
        addPageIfNeeded(40);
        doc.setFont("helvetica", "bold");
        doc.setFontSize(11);
        doc.setTextColor(79, 70, 229);
        doc.text(`${idx + 1}. Objection: ${obj.objection}`, margin + 5, y);
        y += 7;
        doc.setFontSize(10);
        doc.setTextColor(150, 50, 50);
        doc.text("Cognitive Meanining:", margin + 8, y);
        doc.setFont("helvetica", "italic");
        doc.text(`“${obj.realMeaning}”`, margin + 45, y);
        y += 7;
        doc.setFont("helvetica", "bold");
        doc.setTextColor(0);
        doc.text("Tactical Response:", margin + 8, y);
        doc.setFont("helvetica", "normal");
        const respText = doc.splitTextToSize(`“${obj.exactWording}”`, pageWidth - margin * 4);
        doc.text(respText, margin + 45, y);
        y += respText.length * 5 + 10;
      });

      // Tone Guidance
      addPageIfNeeded(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Tone & Delivery Guidance", margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Words to Use: ${result.toneGuidance.wordsToUse.join(", ")}`, margin + 5, y); y += 7;
      doc.text(`Words to Avoid: ${result.toneGuidance.wordsToAvoid.join(", ")}`, margin + 5, y); y += 7;
      doc.text(`Sentence Structure: ${result.toneGuidance.sentenceLength}`, margin + 5, y); y += 15;

      // Final Coaching
      addPageIfNeeded(40);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(14);
      doc.text("Executive Summary & Final Coaching", margin, y);
      y += 10;
      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      const adviceText = doc.splitTextToSize(result.finalCoaching.finalAdvice, pageWidth - margin * 2);
      doc.text(adviceText, margin + 5, y);
      y += adviceText.length * 5 + 10;

      // Save PDF
      doc.save(`Cognitive-Strategy-${context.clientCompany || "Report"}.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <div className="relative space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-700 pb-20">
      
      {/* HEADER CONTROLS */}
      <div className="flex justify-end">
        <button
          onClick={generateReportPDF}
          disabled={isExporting}
          className={`
            flex items-center gap-2 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-xl transition-all
            ${isExporting ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 active:scale-95'}
          `}
        >
          {isExporting ? (
            <><div className="w-3 h-3 border-2 border-slate-300 border-t-slate-500 rounded-full animate-spin"></div> Generating PDF...</>
          ) : (
            <><ICONS.Document className="w-4 h-4" /> Download Strategy Report</>
          )}
        </button>
      </div>

      {/* BUYER SNAPSHOT HERO */}
      <section className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200 relative overflow-hidden">
        <div className="absolute top-0 right-0 p-12 opacity-[0.03] pointer-events-none">
          <ICONS.Brain className="w-96 h-96 text-indigo-900" />
        </div>
        
        <div className="relative z-10 space-y-16">
          <div className="flex flex-col xl:flex-row gap-16 items-center">
            
            {/* Radar Matrix Visualization */}
            <div className="w-full xl:w-1/2 flex flex-col items-center">
              <div className="mb-4 text-center space-y-1">
                <h3 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-500">Neural Cognitive Matrix</h3>
                <p className="text-3xl font-black text-slate-900 tracking-tight">Psychological Profile</p>
              </div>
              <CognitiveRadarChart data={radarData} />
            </div>

            {/* Inferred Archetype & Core Traits */}
            <div className="w-full xl:w-1/2 space-y-10">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-indigo-50 text-indigo-600 rounded-full border border-indigo-100">
                  <ICONS.Trophy className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest">Inferred Archetype</span>
                </div>
                <h2 className="text-5xl font-black text-slate-900 tracking-tight leading-none">{archetype.title}</h2>
                <p className="text-xl text-slate-500 font-medium leading-relaxed italic border-l-4 border-indigo-200 pl-6">
                  “{archetype.desc}”
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                <TraitBar label="Risk Tolerance" value={radarData[0].value} text={result.snapshot.riskTolerance} color="rose" />
                <TraitBar label="Decision Style" value={radarData[1].value} text={result.snapshot.decisionStyle} color="indigo" />
                <TraitBar label="Interaction Tone" value={radarData[2].value} text={result.snapshot.tone} color="emerald" />
                <div className="space-y-4">
                  <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Audio Persona Selection</span>
                  <div className="grid grid-cols-2 gap-2">
                    {VOICES.map(v => (
                      <button 
                        key={v.name}
                        onClick={() => setSelectedVoice(v.name)}
                        className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-tighter border transition-all ${selectedVoice === v.name ? 'bg-indigo-600 border-indigo-600 text-white' : 'bg-slate-50 border-slate-100 text-slate-400'}`}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Core Priorities */}
          <div className="pt-12 border-t border-slate-100">
            <h4 className="text-[11px] font-black uppercase tracking-[0.4em] text-slate-400 mb-8 text-center">Core Strategic Priorities</h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
               {(result.snapshot.priorities || []).map((item, i) => (
                 <div key={i} className="group p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-300 hover:shadow-2xl transition-all duration-500 relative">
                    <div className="flex items-center justify-between mb-4">
                      <div className="p-3 bg-white text-indigo-600 rounded-2xl group-hover:bg-indigo-600 group-hover:text-white transition-colors shadow-sm"><ICONS.Trophy className="w-4 h-4" /></div>
                      <button 
                        onClick={() => playAudioForText(item.text, `priority-${i}`)}
                        className={`p-3 rounded-2xl transition-all ${playingAudioId === `priority-${i}` ? 'bg-rose-100 text-rose-600 animate-pulse' : 'bg-white text-slate-300 hover:text-indigo-600'}`}
                      >
                        <ICONS.Speaker className="w-4 h-4" />
                      </button>
                    </div>
                    <p className="text-lg font-black text-slate-800 leading-tight group-hover:text-indigo-900">{item.text}</p>
                 </div>
               ))}
            </div>
          </div>
        </div>
      </section>

      {/* DOCUMENTARY ENTITY INTELLIGENCE */}
      <section className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200">
        <div className="flex flex-col md:flex-row items-center justify-between gap-8 mb-12">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-emerald-600 text-white rounded-2xl shadow-xl shadow-emerald-50"><ICONS.Innovation /></div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Documentary Entity Intelligence</h2>
              <p className="text-sm text-slate-500 font-medium italic">High-precision extraction of grounded business objects.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 justify-center">
            {['All', 'Company', 'Person', 'Product', 'Metric'].map(type => (
              <button
                key={type}
                onClick={() => setEntityFilter(type === 'All' ? null : type)}
                className={`px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border transition-all ${((!entityFilter && type === 'All') || entityFilter === type) ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300'}`}
              >
                {type}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredEntities.map((entity, i) => (
            <div 
              key={i} 
              className="p-8 rounded-[2.5rem] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-300 hover:shadow-2xl transition-all duration-500 group relative flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <span className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border ${getEntityColor(entity.type)}`}>
                    {entity.type}
                  </span>
                  <button 
                    onClick={() => scrollToSource(entity.citation)}
                    className="p-2 text-slate-300 hover:text-indigo-600 transition-colors"
                  >
                    <ICONS.Shield className="w-4 h-4" />
                  </button>
                </div>
                <div>
                  <h4 className="text-xl font-black text-slate-900 leading-tight mb-2">{entity.name}</h4>
                  <p className="text-xs text-slate-500 font-medium leading-relaxed italic line-clamp-3">“{entity.context}”</p>
                </div>
              </div>
              <div className="mt-6 pt-4 border-t border-slate-100 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                 <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full"></div>
                 <span className="text-[8px] font-black uppercase tracking-[0.2em] text-indigo-400 truncate">Source: {entity.citation.sourceFile}</span>
              </div>
            </div>
          ))}
          {filteredEntities.length === 0 && (
            <div className="col-span-full py-12 text-center text-slate-400 italic font-medium">No {entityFilter?.toLowerCase()} entities identified in the provided documents.</div>
          )}
        </div>
      </section>

      {/* OBJECTION DRILLS */}
      <section className="bg-white rounded-[3.5rem] p-12 shadow-2xl border border-slate-200">
        <div className="flex items-center justify-between mb-12">
          <div className="flex items-center gap-4">
            <div className="p-4 bg-indigo-600 text-white rounded-2xl shadow-xl"><ICONS.Security /></div>
            <div>
              <h2 className="text-3xl font-black text-slate-900 tracking-tight">Objection Battle-Drills</h2>
              <p className="text-sm text-slate-500 font-medium italic">Strategically scripted logic grounded in data.</p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          {(result.objectionHandling || []).map((obj, idx) => {
            const isExpanded = expandedObjections.has(idx);
            const audioId = `obj-audio-${idx}`;
            return (
              <div 
                key={idx} 
                className={`rounded-[2.5rem] border-2 transition-all duration-500 overflow-hidden ${isExpanded ? 'bg-slate-50 border-indigo-200 shadow-xl' : 'bg-white border-slate-100 hover:border-slate-300 shadow-sm'}`}
              >
                <button 
                  onClick={() => toggleObjection(idx)}
                  className="w-full text-left px-10 py-8 flex items-center justify-between group focus:outline-none"
                >
                  <div className="flex items-center gap-6">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center font-black text-sm transition-all ${isExpanded ? 'bg-indigo-600 text-white rotate-12' : 'bg-slate-100 text-slate-400 group-hover:bg-slate-200'}`}>
                      {idx + 1}
                    </div>
                    <span className={`text-xl font-black tracking-tight ${isExpanded ? 'text-indigo-600' : 'text-slate-800'}`}>
                      {obj.objection}
                    </span>
                  </div>
                  <div className={`transition-transform duration-500 ${isExpanded ? 'rotate-180' : ''}`}>
                    <svg xmlns="http://www.w3.org/2000/svg" className={`w-6 h-6 ${isExpanded ? 'text-indigo-600' : 'text-slate-300'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                </button>

                {isExpanded && (
                  <div className="px-10 pb-10 pt-2 animate-in slide-in-from-top-4 duration-500 grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="space-y-8">
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-rose-500 mb-3 flex items-center gap-2">
                          <ICONS.Brain className="w-4 h-4" /> Cognitive Decoding
                        </h4>
                        <p className="text-lg text-slate-700 font-black italic leading-relaxed pl-6 border-l-4 border-rose-100">
                          “{obj.realMeaning}”
                        </p>
                      </div>
                      <div>
                        <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-500 mb-3 flex items-center gap-2">
                          <ICONS.Efficiency className="w-4 h-4" /> Tactical Strategy
                        </h4>
                        <p className="text-sm text-slate-500 font-semibold leading-relaxed pl-6 border-l-4 border-indigo-100">
                          {obj.strategy}
                        </p>
                      </div>
                      <button 
                        onClick={() => scrollToSource(obj.citation)}
                        className="inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-600 transition-colors"
                      >
                        <ICONS.Shield className="w-3.5 h-3.5" /> Reference Grounding Data
                      </button>
                    </div>

                    <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden flex flex-col justify-between group">
                      <div className="absolute -top-4 -right-4 p-8 opacity-5"><ICONS.Speaker className="w-40 h-40 text-white" /></div>
                      <div className="relative z-10 space-y-4">
                        <div className="flex items-center gap-3">
                          <div className="w-1 h-5 bg-indigo-500 rounded-full"></div>
                          <h4 className="text-[9px] font-black uppercase tracking-[0.4em] text-indigo-400">Verbatim Logic Script</h4>
                        </div>
                        <p className="text-2xl font-black italic leading-tight text-white tracking-tight">
                          “{obj.exactWording}”
                        </p>
                      </div>
                      <div className="relative z-10 pt-8 flex items-center gap-4">
                        <button 
                          onClick={() => playAudioForText(obj.exactWording, audioId)}
                          disabled={isGeneratingAudio && playingAudioId === audioId}
                          className={`flex-1 flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg active:scale-95 ${playingAudioId === audioId ? 'bg-rose-600 text-white' : 'bg-white text-slate-900 hover:bg-indigo-50'}`}
                        >
                          {playingAudioId === audioId ? (
                             <>Terminate Playback</>
                          ) : (
                             <><ICONS.Play className="w-4 h-4" /> Synthesize Audio Pitch</>
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* GROUNDING MATRIX */}
      <section id="grounding-explorer" className="bg-white rounded-[4rem] p-12 shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-slate-900 text-white rounded-2xl"><ICONS.Shield /></div>
          <div>
            <h2 className="text-2xl font-black text-slate-800 tracking-tight">Cognitive Evidence Matrix</h2>
            <p className="text-sm text-slate-500 font-medium">Verified grounding from source documents.</p>
          </div>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-10">
          <div className="lg:col-span-1 space-y-3 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
            {allCitations.map((cit, idx) => (
              <button 
                key={idx} 
                onClick={() => scrollToSource(cit)} 
                className={`w-full text-left p-5 rounded-2xl border-2 transition-all ${highlightedSnippet === cit.snippet ? 'bg-indigo-600 border-indigo-600 text-white shadow-xl scale-[1.02]' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-300'}`}
              >
                <div className="flex items-center gap-2 mb-2 opacity-60">
                  <ICONS.Document className="w-3 h-3" />
                  <span className="text-[9px] font-black uppercase tracking-widest truncate">{cit.sourceFile}</span>
                </div>
                <p className="text-xs font-bold leading-tight line-clamp-3">"{cit.label}"</p>
              </button>
            ))}
          </div>
          <div className="lg:col-span-3 bg-slate-50 rounded-[2.5rem] border border-slate-200 h-[600px] overflow-y-auto p-12 font-serif text-lg leading-relaxed text-slate-700 whitespace-pre-wrap shadow-inner relative">
            <div className="absolute top-4 right-8 text-[9px] font-black text-slate-300 uppercase tracking-[0.5em]">Document Viewer</div>
            {files.map((file, i) => (
              <div key={i} className="mb-20">
                <h5 className="text-[11px] font-black text-indigo-400 uppercase tracking-[0.4em] mb-8 sticky top-0 bg-slate-50/90 backdrop-blur-sm py-4 z-10 border-b border-indigo-100/50">{file.name}</h5>
                <DocumentHighlighter text={file.content} citations={allCitations.filter(c => c.sourceFile === file.name)} highlightedSnippet={highlightedSnippet} />
              </div>
            ))}
          </div>
        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 5px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 10px; }
        .grounding-active { background-color: #fbbf24 !important; color: #78350f !important; font-weight: 800; border-radius: 4px; padding: 2px 0; }
      `}</style>
    </div>
  );
};

const getEntityColor = (type: string) => {
  switch (type) {
    case 'Company': return 'bg-blue-50 text-blue-600 border-blue-100';
    case 'Person': return 'bg-amber-50 text-amber-600 border-amber-100';
    case 'Product': return 'bg-purple-50 text-purple-600 border-purple-100';
    case 'Metric': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
    default: return 'bg-slate-50 text-slate-600 border-slate-100';
  }
};

const TraitBar = ({ label, value, text, color }: { label: string, value: number, text: string, color: string }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-end">
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">{label}</span>
      <span className={`text-[11px] font-black text-${color}-600 tracking-tight`}>{text}</span>
    </div>
    <div className="relative h-2 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner">
      <div 
        className={`h-full rounded-full bg-gradient-to-r from-${color}-400 to-${color}-600 transition-all duration-[1.5s] ease-out shadow-lg`} 
        style={{ width: `${value}%` }}
      >
        <div className="absolute inset-0 bg-white/20 animate-pulse"></div>
      </div>
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
        newParts.push(<mark key={cit.id} className={`transition-all duration-500 ${highlightedSnippet === cit.snippet ? 'grounding-active' : 'bg-indigo-100/50 text-indigo-900 border-b border-indigo-200'}`}>{cit.snippet}</mark>);
        newParts.push(part.slice(index + cit.snippet.length));
      }
    });
    parts = newParts;
  });
  return <>{parts}</>;
};
