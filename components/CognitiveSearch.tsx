
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { ICONS } from '../constants';
import { performCognitiveSearch, generateDynamicSuggestions, CognitiveSearchResult } from '../services/geminiService';
import { UploadedFile, MeetingContext } from '../types';

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-6 text-slate-700 leading-relaxed text-lg font-serif">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-4" />;

        // Detect Style Headers (e.g., ### Executive Summary)
        if (trimmed.startsWith('### ')) {
          const title = trimmed.replace('### ', '');
          return (
            <div key={idx} className="pt-10 pb-4 border-b border-slate-100 mb-4 animate-in fade-in slide-in-from-left-4 first:pt-0">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-indigo-600 rounded-full"></div>
                <h4 className="text-[14px] font-black uppercase tracking-[0.4em] text-slate-900">{title}</h4>
              </div>
            </div>
          );
        }

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        return (
          <div key={idx} className={isBullet ? "flex gap-4 pl-6 border-l-2 border-indigo-50 py-2 bg-slate-50/20 rounded-r-xl" : "py-1"}>
            {isBullet && <div className="mt-2.5 w-2 h-2 rounded-full bg-indigo-500 shrink-0"></div>}
            <div className="flex-1">
              {trimmed.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const inner = part.slice(2, -2);
                  return <strong key={i} className="font-extrabold text-slate-900 bg-indigo-50/80 px-1.5 py-0.5 rounded">{inner}</strong>;
                }
                if (part.startsWith('*') && part.endsWith('*')) {
                  return <em key={i} className="italic text-indigo-700 font-semibold">{part.slice(1, -1)}</em>;
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
  const [progress, setProgress] = useState(0);

  const readyFiles = useMemo(() => files.filter(f => f.status === 'ready'), [files]);
  const progressIntervalRef = useRef<number | null>(null);

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

  const startProgress = () => {
    setProgress(0);
    progressIntervalRef.current = window.setInterval(() => {
      setProgress(prev => {
        if (prev >= 98) return 98;
        const increment = prev < 60 ? 12 : 3; // Ultra fast for 1s target
        return prev + increment;
      });
    }, 40); 
  };

  const stopProgress = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setProgress(100);
    setTimeout(() => setProgress(0), 500);
  };

  const handleSearch = async (e?: React.FormEvent, customQuery?: string) => {
    e?.preventDefault();
    const activeQuery = customQuery || query;
    if (!activeQuery.trim() || isSearching) return;

    setIsSearching(true);
    setError(null);
    setResult(null);
    startProgress();

    try {
      const combinedContent = readyFiles.map(f => `FILE: ${f.name}\n${f.content}`).join('\n\n');
      const searchResult = await performCognitiveSearch(activeQuery, combinedContent, context);
      setResult(searchResult);
    } catch (err: any) {
      setError(err.message || "Velocity path failed.");
    } finally {
      setIsSearching(false);
      stopProgress();
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Search Interface */}
      <div className="bg-white rounded-[3rem] p-10 shadow-2xl border border-slate-200 relative overflow-hidden">
        {isSearching && (
          <div 
            className="absolute top-0 left-0 h-1.5 bg-indigo-600 transition-all duration-300 z-20"
            style={{ width: `${progress}%` }}
          />
        )}
        
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Search /></div>
            <div>
              <h2 className="text-2xl font-black text-slate-900 tracking-tight">Intelligence Inquiry</h2>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Target: {context.clientCompany} | Persona: {context.persona}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-full border border-emerald-100">
             <div className="relative">
                <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping"></div>
                <div className="absolute inset-0 w-2 h-2 bg-emerald-500 rounded-full"></div>
             </div>
             <span className="text-[9px] font-black uppercase tracking-widest">High Velocity Dossier Synthesis</span>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about ${context.persona} strategic alignment...`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-5 text-lg focus:border-indigo-500 focus:bg-white outline-none transition-all pr-40 font-medium shadow-inner"
          />
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className="absolute right-3 top-3 bottom-3 px-8 rounded-[1.5rem] bg-indigo-600 text-white font-black uppercase tracking-widest text-[10px] hover:bg-indigo-700 transition-all shadow-lg flex items-center gap-2"
          >
            {isSearching ? 'Synthesizing...' : 'Analyze'}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-6 bg-rose-50 border border-rose-100 rounded-3xl animate-in shake duration-500">
            <p className="text-rose-600 text-sm font-bold flex items-center gap-2">
              <ICONS.X className="w-4 h-4" /> Inquiry Interrupted: {error}
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-10 animate-in slide-in-from-top-4 duration-500">
          
          {/* ARTICULAR SOUNDBITE */}
          <div className="bg-indigo-900 rounded-[3rem] p-10 shadow-2xl relative overflow-hidden border border-indigo-800">
             <div className="absolute top-0 right-0 p-10 opacity-5"><ICONS.Brain className="w-40 h-40 text-white" /></div>
             <div className="relative z-10 space-y-4">
                <div className="flex items-center gap-3">
                   <div className="w-1.5 h-5 bg-indigo-500 rounded-full"></div>
                   <h4 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.4em]">Sub-1s Executive Pulse</h4>
                </div>
                <p className="text-3xl font-black text-white leading-tight italic tracking-tight">
                   “{result.articularSoundbite}”
                </p>
             </div>
          </div>

          {/* DOSSIER CONTENT */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10">
            
            {/* MAIN ANALYSIS COLUMN */}
            <div className="lg:col-span-8 bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200">
              <div className="mb-10 pb-6">
                <div className="flex items-center justify-between mb-8 border-b border-slate-100 pb-4">
                   <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400">Detailed Strategic Synthesis</h4>
                   <div className="flex gap-1">
                      {context.answerStyles.slice(0, 3).map(style => (
                        <span key={style} className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[8px] font-black uppercase tracking-widest">{style}</span>
                      ))}
                   </div>
                </div>
                <FormattedText text={result.detailedAnalysis} />
              </div>

              <div className="space-y-6 pt-10 border-t border-slate-100">
                <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600">Executive Takeaway</h4>
                <div className="p-10 bg-indigo-50 rounded-[2rem] border border-indigo-100 shadow-inner">
                  <p className="text-2xl font-black text-slate-800 italic leading-snug">
                    "{result.conclusion}"
                  </p>
                </div>
              </div>
            </div>

            {/* PERSONA & USE CASE COLUMN */}
            <div className="lg:col-span-4 space-y-8">
              {/* USE CASE CARD */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 border-t-8 border-t-emerald-500">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><ICONS.Growth /></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-600">Business Use Case</h4>
                 </div>
                 <div className="text-slate-700 text-lg font-bold leading-relaxed italic whitespace-pre-wrap">
                   {result.useCase}
                 </div>
              </div>

              {/* PERSONA ALIGNMENT CARD */}
              <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 border-t-8 border-t-indigo-500">
                 <div className="flex items-center gap-3 mb-6">
                    <div className="p-3 bg-indigo-50 text-indigo-600 rounded-2xl"><ICONS.Brain /></div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-600">{context.persona} Strategic Alignment</h4>
                 </div>
                 <div className="text-slate-600 text-sm font-semibold leading-relaxed italic whitespace-pre-wrap">
                   {result.personaAlignment}
                 </div>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* DYNAMIC SUGGESTIONS */}
      {!result && !isSearching && suggestions.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 text-center">Neural Suggestions</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suggestions.map((text, i) => (
              <button key={i} onClick={() => {setQuery(text); handleSearch(undefined, text);}} className="p-8 bg-white border border-slate-100 rounded-[2rem] text-left hover:border-indigo-400 hover:shadow-xl transition-all shadow-md group border-b-4 border-b-indigo-50 hover:border-b-indigo-500">
                <p className="text-lg font-bold text-slate-800 leading-tight">“{text}”</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
