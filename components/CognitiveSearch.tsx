
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { performCognitiveSearch, CognitiveSearchResult } from '../services/geminiService';
import { UploadedFile, MeetingContext } from '../types';

interface CognitiveSearchProps {
  files: UploadedFile[];
  context: MeetingContext;
}

export const CognitiveSearch: React.FC<CognitiveSearchProps> = ({ files, context }) => {
  const [query, setQuery] = useState("");
  const [isSearching, setIsSearching] = useState(false);
  const [result, setResult] = useState<CognitiveSearchResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!query.trim() || isSearching) return;

    if (files.filter(f => f.status === 'ready').length === 0) {
      setError("Please upload and process documents before performing a cognitive search.");
      return;
    }

    setIsSearching(true);
    setError(null);
    setResult(null);

    try {
      const combinedContent = files
        .filter(f => f.status === 'ready')
        .map(f => `FILE: ${f.name}\n${f.content}`)
        .join('\n\n');
      
      const searchResult = await performCognitiveSearch(query, combinedContent, context);
      setResult(searchResult);
    } catch (err: any) {
      setError(err.message || "Cognitive search failed. Please try again.");
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className="absolute top-0 right-0 p-8">
           <div className="flex items-center gap-2 px-4 py-2 bg-indigo-50 border border-indigo-100 rounded-full">
             <div className="w-2 h-2 bg-indigo-500 rounded-full animate-pulse"></div>
             <span className="text-[10px] font-black text-indigo-600 uppercase tracking-widest">Persona: {context.persona} Active</span>
           </div>
        </div>

        <div className="flex items-center gap-4 mb-8">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Search /></div>
          <div>
            <h2 className="text-2xl font-bold text-slate-800 tracking-tight">Cognitive Reasoning Engine</h2>
            <p className="text-sm text-slate-500">Grounded analysis for {context.clientCompany} ({context.persona} Focus).</p>
          </div>
        </div>

        <form onSubmit={handleSearch} className="relative group">
          <input 
            type="text" 
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={`Ask about value mapping (e.g. how does SpikedAI solve the pain points for ${context.clientNames}?)`}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-[2rem] px-8 py-6 text-lg focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner pr-24 font-medium placeholder:text-slate-300"
          />
          <button 
            type="submit"
            disabled={isSearching || !query.trim()}
            className={`absolute right-4 top-4 bottom-4 px-8 rounded-2xl font-black uppercase tracking-widest text-[11px] transition-all flex items-center gap-2 ${isSearching || !query.trim() ? 'bg-slate-200 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-lg'}`}
          >
            {isSearching ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <ICONS.Brain />}
            {isSearching ? 'Analyzing...' : 'Execute Reasoning'}
          </button>
        </form>

        {error && (
          <div className="mt-6 p-4 bg-rose-50 border border-rose-100 rounded-2xl text-rose-500 text-sm font-bold animate-in shake-in duration-300">
            ⚠️ {error}
          </div>
        )}
      </div>

      {result && (
        <div className="space-y-8 animate-in zoom-in-95 duration-500">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <ReasoningStep label="Grounded Pain Point" content={result.reasoningChain.painPoint} color="rose" icon={<ICONS.Security />} />
            <ReasoningStep label="Strategic Capability" content={result.reasoningChain.capability} color="indigo" icon={<ICONS.Brain />} />
            <ReasoningStep label="Projected Value" content={result.reasoningChain.strategicValue} color="emerald" icon={<ICONS.ROI />} />
          </div>

          <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 space-y-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="p-1.5 bg-indigo-600 text-white rounded-lg"><ICONS.Speaker /></div>
                <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-indigo-600">Avi's Strategic Response (Style: {context.answerStyles.slice(0, 2).join(', ')})</h3>
              </div>
              <div className="text-slate-700 text-xl leading-relaxed font-serif whitespace-pre-wrap selection:bg-indigo-100 p-8 bg-slate-50 rounded-[2rem] border border-slate-100 shadow-inner italic">
                "{result.answer}"
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100">
              <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 mb-6 flex items-center gap-2">
                <ICONS.Shield /> Verified Grounding Evidence
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {result.citations.map((cit, i) => (
                  <div key={i} className="p-5 bg-white border border-slate-100 rounded-2xl group hover:border-indigo-200 transition-colors shadow-sm">
                    <p className="text-[9px] font-black text-indigo-400 uppercase tracking-widest mb-3">{cit.source}</p>
                    <p className="text-xs text-slate-600 leading-relaxed italic">"{cit.snippet}"</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !isSearching && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <ExampleSearch onClick={setQuery} text={`What specific value does SpikedAI offer ${context.clientCompany} based on the KYC report?`} />
          <ExampleSearch onClick={setQuery} text={`Map our core capabilities to ${context.clientNames}'s growth blockers.`} />
          <ExampleSearch onClick={setQuery} text={`Summarize the ROI for Jason's team using the Financial persona.`} />
        </div>
      )}
    </div>
  );
};

const ReasoningStep = ({ label, content, color, icon }: { label: string; content: string; color: string; icon: React.ReactNode }) => (
  <div className={`p-6 rounded-[2rem] bg-white border border-slate-100 shadow-xl border-l-4 border-l-${color}-500 group hover:-translate-y-1 transition-all`}>
    <div className="flex items-center gap-3 mb-4">
      <div className={`p-2 rounded-xl bg-${color}-50 text-${color}-600`}>{icon}</div>
      <h4 className={`text-[10px] font-black uppercase tracking-widest text-${color}-500`}>{label}</h4>
    </div>
    <p className="text-xs font-bold text-slate-800 leading-relaxed">{content}</p>
  </div>
);

const ExampleSearch = ({ text, onClick }: { text: string; onClick: (t: string) => void }) => (
  <button 
    onClick={() => onClick(text)}
    className="p-6 bg-white/60 border border-slate-200 rounded-3xl text-left hover:border-indigo-400 hover:bg-white transition-all shadow-sm group"
  >
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 group-hover:text-indigo-500">Cognitive Inquiry</p>
    <p className="text-slate-700 font-semibold leading-snug">{text}</p>
  </button>
);
