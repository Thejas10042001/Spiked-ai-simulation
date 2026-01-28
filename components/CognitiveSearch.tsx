
import React, { useState, useEffect, useMemo } from 'react';
import { ICONS } from '../constants';
import { performCognitiveSearch, generateDynamicSuggestions, CognitiveSearchResult } from '../services/geminiService';
import { UploadedFile, MeetingContext } from '../types';

interface CognitiveSearchProps {
  files: UploadedFile[];
  context: MeetingContext;
}

const FormattedText: React.FC<{ text: string }> = ({ text }) => {
  const lines = text.split('\n');
  return (
    <div className="space-y-6 text-slate-700 leading-relaxed text-lg font-serif text-justify selection:bg-indigo-100 px-2">
      {lines.map((line, idx) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={idx} className="h-4" />;
        
        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        const content = isBullet ? trimmed.substring(2) : trimmed;

        // Visual Hierarchy Processing
        const formatted = content.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
          if (part.startsWith('**') && part.endsWith('**')) {
            const inner = part.slice(2, -2);
            
            // Strategic Block Mapping
            if (inner === "CONCISE EXECUTIVE SUMMARY") {
              return (
                <div key={i} className="block mt-12 mb-6 bg-slate-900 border-l-8 border-indigo-400 p-8 rounded-r-[2rem] shadow-2xl animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-indigo-400"><ICONS.Efficiency className="w-6 h-6" /></div>
                    <span className="text-white text-[12px] font-black uppercase tracking-[0.4em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }

            if (inner === "SALES STRATEGY POINTS") {
              return (
                <div key={i} className="block mt-12 mb-6 bg-emerald-50 border-l-8 border-emerald-500 p-8 rounded-r-[2rem] shadow-lg animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-emerald-600"><ICONS.ROI className="w-6 h-6" /></div>
                    <span className="text-emerald-600 text-[12px] font-black uppercase tracking-[0.4em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }

            if (inner === "TECHNICAL GLOSSARY") {
              return (
                <div key={i} className="block mt-12 mb-6 bg-slate-50 border-l-8 border-slate-300 p-8 rounded-r-[2rem] shadow-inner animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-slate-500"><ICONS.Brain className="w-6 h-6" /></div>
                    <span className="text-slate-500 text-[12px] font-black uppercase tracking-[0.4em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }

            if (inner === "COMPETITIVE LANDSCAPE") {
              return (
                <div key={i} className="block mt-12 mb-6 bg-indigo-50 border-l-8 border-indigo-500 p-8 rounded-r-[2rem] shadow-lg animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-indigo-600"><ICONS.Efficiency className="w-6 h-6" /></div>
                    <span className="text-indigo-600 text-[12px] font-black uppercase tracking-[0.4em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }

            if (inner === "ANTICIPATED FRICTION") {
              return (
                <div key={i} className="block mt-12 mb-6 bg-rose-50 border-l-8 border-rose-500 p-8 rounded-r-[2rem] shadow-lg animate-in slide-in-from-left-4">
                  <div className="flex items-center gap-4 mb-2">
                    <div className="text-rose-600"><ICONS.Shield className="w-6 h-6" /></div>
                    <span className="text-rose-600 text-[12px] font-black uppercase tracking-[0.4em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }

            const isAllUpper = inner === inner.toUpperCase() && inner.length > 3;
            if (isAllUpper) {
              return (
                <div key={i} className="block mt-12 mb-6 first:mt-0">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-1.5 bg-indigo-600 rounded-full"></div>
                    <span className="text-indigo-600 text-sm font-black uppercase tracking-[0.3em]">
                      {inner}
                    </span>
                  </div>
                </div>
              );
            }
            
            return (
              <strong key={i} className="font-extrabold text-slate-900 border-b-2 border-indigo-100 bg-indigo-50/20 px-1 rounded-sm">
                {inner}
              </strong>
            );
          }
          if (part.startsWith('*') && part.endsWith('*')) {
            return (
              <em key={i} className="italic text-indigo-500 font-medium border-b border-indigo-100 decoration-indigo-200/50 underline-offset-4 bg-slate-50 px-1 rounded">
                {part.slice(1, -1)}
              </em>
            );
          }
          return part;
        });

        return (
          <div key={idx} className={isBullet ? "flex gap-5 pl-8 border-l-4 border-indigo-100/50 py-3 mb-2 bg-white/40 rounded-r-xl" : "py-2"}>
            {isBullet && <div className="mt-2.5 w-2 h-2 rounded-full bg-indigo-500 shadow-[0_0_10px_rgba(79,70,229,0.3)]"></div>}
            <div className={isBullet ? "flex-1" : ""}>{formatted}</div>
          </div>
        );
      })}
    </div>
  );
};

export const CognitiveSearch: React.FC<CognitiveSearchProps> = ({ files, context }) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<CognitiveSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);

  const readyFiles = useMemo(() => files.filter(f => f.status === 'ready'), [files]);

  useEffect(() => {
    const fetchSuggestions = async () => {
      if (readyFiles.length > 0) {
        setIsSuggesting(true);
        try {
          const combinedContent = readyFiles.map(f => f.content).join('\n');
          const res = await generateDynamicSuggestions(combinedContent, context);
          setSuggestions(res);
        } catch (e) {
          console.error("Failed to fetch suggestions");
        } finally {
          setIsSuggesting(false);
        }
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
      <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8">
           <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full">
             <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Cognitive Core Active</span>
           </div>
        </div>

        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-200"><ICONS.Search /></div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Inquiry</h2>
            <p className="text-sm text-slate-500 font-medium">Synthesizing detailed strategy for <strong>{context.clientCompany}</strong>.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`e.g. Map their technical debt to our platform's legacy modernization ROI...`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-10 py-7 text-xl focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner pr-32 font-medium placeholder:text-slate-300"
          />
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className={`absolute right-4 top-4 bottom-4 px-10 rounded-[2rem] font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 ${isSearching || !query.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-xl shadow-indigo-100'}`}
          >
            {isSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Brain />}
            {isSearching ? 'Processing...' : 'Analyze'}
          </button>
        </form>

        {error && (
          <div className="mt-8 p-5 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-sm font-bold animate-in shake-in flex items-center gap-3">
            <ICONS.Shield /> {error}
          </div>
        )}
      </div>

      {/* Suggestions and Results ... unchanged ... */}
      {!result && !isSearching && suggestions.length > 0 && (
        <div className="space-y-6 animate-in fade-in slide-in-from-top-4">
          <h4 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3 ml-4">
            <ICONS.Sparkles /> Strategic Reasoning Triggers
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suggestions.map((text, i) => (
              <button 
                key={i}
                onClick={() => { setQuery(text); handleSearch(undefined, text); }}
                className="p-8 bg-white border border-slate-100 rounded-[2.5rem] text-left hover:border-indigo-400 hover:shadow-2xl transition-all shadow-md group relative overflow-hidden"
              >
                <div className="absolute top-0 left-0 w-2 h-full bg-indigo-50 group-hover:bg-indigo-500 transition-colors"></div>
                <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3">Target Objective</p>
                <p className="text-slate-800 font-bold leading-relaxed group-hover:text-indigo-900 transition-colors text-base italic">“{text}”</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results Section */}
      {result && (
        <div className="space-y-12 animate-in zoom-in-95 duration-700 pb-20">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ReasoningStep label="Identified Conflict" content={result.reasoningChain.painPoint} color="rose" icon={<ICONS.Security />} />
            <ReasoningStep label="Strategic Fix" content={result.reasoningChain.capability} color="indigo" icon={<ICONS.Brain />} />
            <ReasoningStep label="Expected Velocity" content={result.reasoningChain.strategicValue} color="emerald" icon={<ICONS.ROI />} />
          </div>

          <div className="bg-white rounded-[4rem] p-16 shadow-2xl border border-slate-200 relative overflow-hidden">
             <div className="absolute top-0 left-0 w-full h-3 bg-gradient-to-r from-indigo-500 via-rose-400 to-emerald-400 opacity-80"></div>
            
            <div className="space-y-12">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Speaker /></div>
                  <h3 className="text-[12px] font-black uppercase tracking-[0.4em] text-indigo-600">Grounded Sales Strategy Analysis</h3>
                </div>
                <button 
                   onClick={() => {setResult(null); setQuery("");}}
                   className="px-6 py-2 border-2 border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest rounded-xl hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all flex items-center gap-2"
                >
                  <ICONS.X className="w-3 h-3" /> New Inquiry
                </button>
              </div>

              {/* BRIEF EXPLANATION CALLOUT */}
              <div className="bg-slate-900 rounded-[2.5rem] p-10 shadow-2xl relative overflow-hidden border border-slate-800 animate-in slide-in-from-top-4 duration-1000">
                <div className="absolute top-0 right-0 p-6 opacity-20">
                  <ICONS.Play className="w-20 h-20 text-indigo-400" />
                </div>
                <div className="relative z-10 flex flex-col md:flex-row gap-8 items-start">
                  <div className="shrink-0 p-4 bg-indigo-500 text-white rounded-2xl shadow-xl shadow-indigo-500/20">
                    <ICONS.Efficiency />
                  </div>
                  <div className="space-y-4">
                    <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-400">Executive Briefing (TL;DR)</h4>
                    <p className="text-xl md:text-2xl font-black text-white leading-tight italic">
                      “{result.briefExplanation}”
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="relative">
                <div className="absolute -left-12 top-0 bottom-0 w-px bg-slate-100"></div>
                <FormattedText text={result.answer} />
              </div>

              <div className="pt-16 border-t border-slate-100">
                <div className="flex items-center justify-between mb-10">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.3em] text-slate-400 flex items-center gap-3">
                    <ICONS.Shield /> Documentary Proof & Citations
                  </h3>
                  <span className="text-[9px] font-bold bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full uppercase tracking-widest border border-emerald-100">Truthfulness Validated</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {result.citations.map((cit, i) => (
                    <div key={i} className="p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] group hover:border-indigo-300 transition-all hover:bg-white shadow-inner relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-5 group-hover:opacity-10 transition-opacity">
                         <ICONS.Document />
                      </div>
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-indigo-400 rounded-full shadow-[0_0_10px_rgba(79,70,229,0.3)]"></div> {cit.source}
                      </p>
                      <p className="text-base text-slate-600 leading-relaxed italic font-medium">“{cit.snippet}”</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const ReasoningStep = ({ label, content, color, icon }: { label: string; content: string; color: string; icon: React.ReactNode }) => (
  <div className={`p-10 rounded-[3rem] bg-white border border-slate-100 shadow-2xl border-l-[12px] border-l-${color}-500 group hover:-translate-y-3 transition-all duration-500`}>
    <div className="flex items-center gap-5 mb-8">
      <div className={`p-5 rounded-2xl bg-${color}-50 text-${color}-600 shadow-lg shadow-${color}-100/20`}>{icon}</div>
      <h4 className={`text-[12px] font-black uppercase tracking-[0.25em] text-${color}-600`}>{label}</h4>
    </div>
    <p className="text-lg font-bold text-slate-800 leading-relaxed italic border-l-4 border-slate-50 pl-5">“{content}”</p>
  </div>
);
