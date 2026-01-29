
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS } from '../constants';
import { performCognitiveSearch, generateDynamicSuggestions, CognitiveSearchResult } from '../services/geminiService';
import { UploadedFile, MeetingContext } from '../types';

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-8 text-slate-700 leading-relaxed text-lg font-serif">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-4" />;

        // Detect Style Headers (e.g., ### Executive Summary)
        if (trimmed.startsWith('### ')) {
          const title = trimmed.replace('### ', '');
          return (
            <div key={idx} className="pt-8 pb-4 border-b border-slate-100 mb-4 animate-in fade-in slide-in-from-left-4">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-slate-900">{title}</h4>
              </div>
            </div>
          );
        }

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        return (
          <div key={idx} className={isBullet ? "flex gap-5 pl-8 border-l-4 border-indigo-50 py-2" : "py-1"}>
            {isBullet && <div className="mt-2.5 w-2 h-2 rounded-full bg-indigo-400 shadow-sm shrink-0"></div>}
            <div className="flex-1">
              {trimmed.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const inner = part.slice(2, -2);
                  return <strong key={i} className="font-extrabold text-slate-900 bg-indigo-50/50 px-1.5 rounded">{inner}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                  return <em key={i} className="italic text-indigo-600 font-medium">{part.slice(1, -1)}</em>;
                }
                return part;
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// Added missing interface for CognitiveSearch props
interface CognitiveSearchProps {
  files: UploadedFile[];
  context: MeetingContext;
}

export const CognitiveSearch: React.FC<CognitiveSearchProps> = ({ files, context }) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<CognitiveSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const readyFiles = useMemo(() => files.filter(f => f.status === 'ready'), [files]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (readyFiles.length > 0) {
        try {
          const combinedContent = readyFiles.map(f => f.content).join('\n');
          const res = await generateDynamicSuggestions(combinedContent, context);
          setSuggestions(res);
        } catch (e) { console.error(e); }
      }
    };
    fetchSuggestions();
  }, [readyFiles, context]);

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const activeQuery = customQuery || query;
    if (!activeQuery.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const combinedContent = readyFiles.map(f => `FILE: ${f.name}\n${f.content}`).join('\n\n');
      const searchResult = await performCognitiveSearch(activeQuery, combinedContent, context);
      setResult(searchResult);
    } catch (err: any) {
      setError(err.message || "Cognitive search failed.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Search Header */}
      <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-200"><ICONS.Search /></div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Articular Strategy Inquiry</h2>
            <p className="text-sm text-slate-500 font-medium">Modeling {context.persona} logic for <strong>{context.clientCompany}</strong>.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`e.g. Map our ROI to their ${context.persona} budget cycle...`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-10 py-7 text-xl focus:border-indigo-500 focus:bg-white outline-none transition-all pr-40 font-medium"
          />
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-4 top-4 bottom-4 px-10 rounded-[2rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-[11px] hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            {isSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Analyze'}
          </button>
        </form>
      </div>

      {result && (
        <div className="space-y-12 animate-in slide-in-from-top-4 duration-700">
          {/* ARTICULAR SOUNDBITE: VERBATIM HOOK */}
          <div className="bg-indigo-600 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-12 opacity-10"><ICONS.Speaker className="w-32 h-32" /></div>
             <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-6 bg-white rounded-full"></div>
                   <h4 className="text-[11px] font-black text-indigo-200 uppercase tracking-[0.4em]">The Articular Soundbite (Say this verbatim)</h4>
                </div>
                <p className="text-3xl md:text-4xl font-black text-white leading-tight italic">
                   “{result.articularSoundbite}”
                </p>
                <p className="text-indigo-200 text-sm font-medium pt-4 border-t border-white/10 max-w-2xl">
                   {result.briefExplanation}
                </p>
             </div>
          </div>

          {/* PSYCHOLOGICAL PROJECTION LAYER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ProjectionCard label="Professional Incentive" content={result.psychologicalProjection.buyerIncentive} color="emerald" icon={<ICONS.Growth />} />
            <ProjectionCard label="Hidden Fear/Risk" content={result.psychologicalProjection.buyerFear} color="rose" icon={<ICONS.Security />} />
            <ProjectionCard label="Strategic Lever" content={result.psychologicalProjection.strategicLever} color="indigo" icon={<ICONS.Trophy />} />
          </div>

          {/* DETAILED ARTICULATION */}
          <div className="bg-white rounded-[4rem] p-16 shadow-2xl border border-slate-200 relative">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 border-b border-slate-100 pb-10">
               <div className="flex items-center gap-4">
                  <div className="p-3 bg-slate-900 text-white rounded-2xl"><ICONS.Brain /></div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-slate-900">Neural Answering Core</h3>
               </div>
               
               <div className="flex flex-wrap gap-2 justify-end">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 py-2">Active Strategic Encodings:</span>
                  {context.answerStyles.map((style, i) => (
                    <span key={i} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[9px] font-black uppercase tracking-widest border border-indigo-100 animate-in zoom-in duration-300">
                      {style}
                    </span>
                  ))}
               </div>
            </div>
            
            <FormattedText text={result.answer} />

            <div className="mt-20 pt-16 border-t border-slate-100 space-y-10">
               <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-3">
                  <ICONS.Shield /> Documentary Grounding Citations
               </h5>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                 {result.citations.map((cit, i) => (
                   <div key={i} className="p-8 bg-slate-50 border border-slate-100 rounded-3xl group hover:bg-white transition-all shadow-sm">
                      <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-4">{cit.source}</p>
                      <p className="text-sm text-slate-600 leading-relaxed italic">“{cit.snippet}”</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* SUGGESTIONS */}
      {!result && !isSearching && suggestions.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {suggestions.map((text, i) => (
            <button key={i} onClick={() => {setQuery(text); handleSearch(undefined, text);}} className="p-10 bg-white border border-slate-100 rounded-[2.5rem] text-left hover:border-indigo-400 hover:shadow-2xl transition-all shadow-md group">
               <p className="text-slate-400 text-[10px] font-black uppercase tracking-widest mb-4 group-hover:text-indigo-500">Inference Target</p>
               <p className="text-lg font-bold text-slate-800 leading-tight">“{text}”</p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

const ProjectionCard = ({ label, content, color, icon }: { label: string; content: string; color: string; icon: React.ReactNode }) => (
  <div className={`p-10 rounded-[3rem] bg-white border border-slate-100 shadow-xl border-t-8 border-t-${color}-500 hover:-translate-y-2 transition-transform`}>
    <div className="flex items-center gap-4 mb-6">
       <div className={`p-4 bg-${color}-50 text-${color}-600 rounded-2xl`}>{icon}</div>
       <h4 className={`text-[11px] font-black uppercase tracking-[0.2em] text-${color}-600`}>{label}</h4>
    </div>
    <p className="text-lg font-bold text-slate-800 leading-relaxed italic">“{content}”</p>
  </div>
);
