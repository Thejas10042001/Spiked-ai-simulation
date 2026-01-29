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
            <div key={idx} className="pt-12 pb-6 border-b-2 border-slate-100 mb-6 animate-in fade-in slide-in-from-left-4 first:pt-0">
              <div className="flex items-center gap-4">
                <div className="w-2 h-8 bg-indigo-600 rounded-full"></div>
                <h4 className="text-[14px] font-black uppercase tracking-[0.4em] text-slate-900 drop-shadow-sm">{title}</h4>
              </div>
            </div>
          );
        }

        const isBullet = trimmed.startsWith('- ') || trimmed.startsWith('* ');
        return (
          <div key={idx} className={isBullet ? "flex gap-5 pl-8 border-l-4 border-indigo-50 py-3 bg-slate-50/30 rounded-r-2xl" : "py-2"}>
            {isBullet && <div className="mt-3 w-2.5 h-2.5 rounded-full bg-indigo-500 shadow-sm shrink-0"></div>}
            <div className="flex-1">
              {trimmed.split(/(\*\*.*?\*\*|\*.*?\*)/g).map((part, i) => {
                if (part.startsWith('**') && part.endsWith('**')) {
                  const inner = part.slice(2, -2);
                  return <strong key={i} className="font-extrabold text-slate-900 bg-indigo-50/80 px-2 py-0.5 rounded-md">{inner}</strong>;
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
      setError(err.message || "Cognitive search failed to synthesize logic.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Search Interface */}
      <div className="bg-white rounded-[3rem] p-12 shadow-2xl border border-slate-200">
        <div className="flex items-center gap-4 mb-10">
          <div className="p-4 bg-indigo-600 text-white rounded-[1.5rem] shadow-xl shadow-indigo-200"><ICONS.Search /></div>
          <div>
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">Intelligence Inquiry</h2>
            <p className="text-sm text-slate-500 font-medium">Querying the documentary memory for <strong>{context.clientCompany}</strong>.</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about ${context.persona} motivations, technical gaps, or ROI targets...`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2.5rem] px-10 py-7 text-xl focus:border-indigo-500 focus:bg-white outline-none transition-all pr-40 font-medium shadow-inner"
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
          
          {/* ARTICULAR SOUNDBITE & BRIEF SUMMARY */}
          <div className="bg-indigo-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group border border-indigo-800">
             <div className="absolute top-0 right-0 p-12 opacity-5"><ICONS.Brain className="w-48 h-48 text-white" /></div>
             <div className="relative z-10 space-y-8">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                     <div className="w-2 h-6 bg-indigo-500 rounded-full"></div>
                     <h4 className="text-[11px] font-black text-indigo-300 uppercase tracking-[0.4em]">Strategic Articulation: The Verbatim Hook</h4>
                  </div>
                  <p className="text-3xl md:text-5xl font-black text-white leading-[1.1] italic tracking-tight">
                     “{result.articularSoundbite}”
                  </p>
                </div>
                
                <div className="pt-8 border-t border-white/10">
                  <h5 className="text-[10px] font-black text-indigo-400 uppercase tracking-[0.3em] mb-4">Strategic Executive Briefing</h5>
                  <p className="text-indigo-100 text-lg font-medium leading-relaxed max-w-4xl italic">
                     {result.briefExplanation}
                  </p>
                </div>
             </div>
          </div>

          {/* PSYCHOLOGICAL MATRIX */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <ProjectionCard label="Professional Motivator" content={result.psychologicalProjection.buyerIncentive} color="emerald" icon={<ICONS.Growth />} />
            <ProjectionCard label="Frictional Fear" content={result.psychologicalProjection.buyerFear} color="rose" icon={<ICONS.Security />} />
            <ProjectionCard label="Conversational Lever" content={result.psychologicalProjection.strategicLever} color="indigo" icon={<ICONS.Trophy />} />
          </div>

          {/* STRUCTURED INTELLIGENCE REPOSITORY */}
          <div className="bg-white rounded-[4rem] p-16 shadow-2xl border border-slate-200 relative overflow-hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-8 mb-16 border-b border-slate-100 pb-12">
               <div className="flex items-center gap-4">
                  <div className="p-4 bg-slate-900 text-white rounded-2xl shadow-xl shadow-slate-100"><ICONS.Brain /></div>
                  <div>
                    <h3 className="text-[14px] font-black uppercase tracking-[0.4em] text-slate-900">Neural Intelligence Output</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Structured by: {context.persona} Strategic Styles</p>
                  </div>
               </div>
               
               <div className="flex flex-wrap gap-2 justify-end max-w-md">
                  {context.answerStyles.map((style, i) => (
                    <span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[9px] font-black uppercase tracking-widest border border-indigo-100 shadow-sm animate-in zoom-in duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                      {style}
                    </span>
                  ))}
               </div>
            </div>
            
            <FormattedText text={result.answer} />

            {/* GROUNDING FOOTER */}
            <div className="mt-24 pt-16 border-t border-slate-100 space-y-12">
               <div className="flex items-center justify-between">
                 <h5 className="text-[12px] font-black text-slate-400 uppercase tracking-[0.3em] flex items-center gap-3">
                    <ICONS.Shield /> Source Document Grounding
                 </h5>
                 <span className="text-[10px] font-bold text-slate-300 italic uppercase">Citations: {result.citations.length} Verified</span>
               </div>
               <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                 {result.citations.map((cit, i) => (
                   <div key={i} className="p-10 bg-slate-50 border border-slate-100 rounded-[2.5rem] group hover:bg-white hover:border-indigo-200 transition-all shadow-sm">
                      <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-6 flex items-center gap-2">
                        <ICONS.Document className="w-3 h-3" /> {cit.source}
                      </p>
                      <p className="text-md text-slate-600 leading-relaxed font-serif italic">“{cit.snippet}”</p>
                   </div>
                 ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* DYNAMIC SUGGESTIONS */}
      {!result && !isSearching && suggestions.length > 0 && (
        <div className="space-y-6">
          <h4 className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 text-center">Neural Suggested Inquiries</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {suggestions.map((text, i) => (
              <button key={i} onClick={() => {setQuery(text); handleSearch(undefined, text);}} className="p-10 bg-white border border-slate-100 rounded-[2.5rem] text-left hover:border-indigo-400 hover:shadow-2xl transition-all shadow-md group border-b-4 border-b-indigo-50 hover:border-b-indigo-500">
                <p className="text-indigo-400 text-[9px] font-black uppercase tracking-widest mb-4 group-hover:translate-x-1 transition-transform">Analyze Factor {i + 1}</p>
                <p className="text-lg font-bold text-slate-800 leading-tight">“{text}”</p>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ProjectionCard = ({ label, content, color, icon }: { label: string; content: string; color: string; icon: React.ReactNode }) => (
  <div className={`p-12 rounded-[3.5rem] bg-white border border-slate-100 shadow-xl border-t-8 border-t-${color}-500 hover:-translate-y-2 transition-transform duration-500 group`}>
    <div className="flex items-center gap-5 mb-8">
       <div className={`p-5 bg-${color}-50 text-${color}-600 rounded-3xl group-hover:scale-110 transition-transform`}>{icon}</div>
       <h4 className={`text-[12px] font-black uppercase tracking-[0.2em] text-${color}-600`}>{label}</h4>
    </div>
    <p className="text-xl font-bold text-slate-800 leading-relaxed italic tracking-tight">“{content}”</p>
  </div>
);