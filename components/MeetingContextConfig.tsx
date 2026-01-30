
import React, { useState, useEffect, useRef } from 'react';
import { MeetingContext, CustomerPersonaType, ThinkingLevel } from '../types';
import { ICONS } from '../constants';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (updated: MeetingContext) => void;
}

const PERSONAS: { type: CustomerPersonaType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'Balanced', label: 'Balanced', desc: 'Versatile profile for general business users in B2B settings', icon: <ICONS.Document className="w-8 h-8" /> },
  { type: 'Technical', label: 'Technical', desc: 'Deep technical, jargon-friendly (CTO, VP Engineering, Tech Lead)', icon: <ICONS.Brain className="w-8 h-8" /> },
  { type: 'Financial', label: 'Financial', desc: 'ROI-driven, cost-benefit analysis (CFO, Financial Controller)', icon: <ICONS.ROI className="w-8 h-8" /> },
  { type: 'Business Executives', label: 'Executives', desc: 'Strategic impact, operational clarity (CEO, Founder, MD)', icon: <ICONS.Trophy className="w-8 h-8" /> },
];

const ANSWER_STYLES = [
  "Executive Summary", 
  "Analogy Based", 
  "Data-Driven Insights",
  "Concise Answer", 
  "In-Depth Response", 
  "Answer in Points", 
  "Use Analogy", 
  "Define Technical Terms", 
  "Sales Points", 
  "Key Statistics", 
  "Case Study Summary", 
  "Competitive Comparison", 
  "Anticipated Customer Questions", 
  "Information Gap", 
  "Pricing Overview"
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange }) => {
  const [keywordInput, setKeywordInput] = useState("");
  const [localPrompt, setLocalPrompt] = useState(context.baseSystemPrompt);
  const [isSaved, setIsSaved] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const isCustomizedRef = useRef(false);

  useEffect(() => {
    if (!isCustomizedRef.current) {
      generateBasePrompt();
    }
  }, [context.persona, context.answerStyles, context.meetingFocus]);

  useEffect(() => {
    setLocalPrompt(context.baseSystemPrompt);
  }, [context.baseSystemPrompt]);

  const generateBasePrompt = () => {
    let prompt = `Act as a Cognitive AI Sales Intelligence Agent for ${context.persona} buyers. `;
    if (context.answerStyles.length > 0) {
      prompt += `Your responses should strictly follow these styles as headers: ${context.answerStyles.join(', ')}. `;
    }
    if (context.meetingFocus) {
      prompt += `The primary meeting focus is ${context.meetingFocus}. `;
    }
    prompt += `Always ground your logic in source documents and maintain a ${context.persona.toLowerCase()} tone. Use high-density articulation.`;
    
    if (prompt !== context.baseSystemPrompt) {
      setLocalPrompt(prompt);
      onContextChange({ ...context, baseSystemPrompt: prompt });
    }
  };

  const handleChange = (field: keyof MeetingContext, value: any) => {
    onContextChange({ ...context, [field]: value });
  };

  const handlePromptUpdate = (val: string) => {
    setLocalPrompt(val);
    isCustomizedRef.current = true;
    setIsSaved(false);
  };

  const savePrompt = () => {
    onContextChange({ ...context, baseSystemPrompt: localPrompt });
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 2000);
  };

  const toggleStyle = (style: string) => {
    const updated = context.answerStyles.includes(style)
      ? context.answerStyles.filter(s => s !== style)
      : [...context.answerStyles, style];
    handleChange('answerStyles', updated);
  };

  const addKeyword = () => {
    if (keywordInput.trim()) {
      handleChange('strategicKeywords', [...context.strategicKeywords, keywordInput.trim()]);
      setKeywordInput("");
    }
  };

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      {/* Participant Info */}
      <div className="bg-white rounded-[2.5rem] p-10 shadow-2xl border border-slate-200 overflow-hidden relative">
        <div className="flex items-center gap-3 mb-10">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg"><ICONS.Document /></div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">Meeting Intel Configuration</h3>
            <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">Define the strategic landscape</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-indigo-500"><ICONS.Trophy /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Seller Side</h4>
            </div>
            <div className="space-y-5">
              <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="e.g. Your Organization Name" />
              <Input label="Seller Name(s)" value={context.sellerNames} onChange={v => handleChange('sellerNames', v)} placeholder="e.g. Full names of participants" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-rose-500"><ICONS.Search /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Prospect Side</h4>
            </div>
            <div className="space-y-5">
              <Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="e.g. Prospect Organization Name" />
              <Input label="Client Name(s)" value={context.clientNames} onChange={v => handleChange('clientNames', v)} placeholder="e.g. Primary stakeholder(s)" />
            </div>
          </div>

          <div className="space-y-6">
            <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
               <div className="text-emerald-500"><ICONS.Efficiency /></div>
               <h4 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Solution Context</h4>
            </div>
            <div className="space-y-5">
              <Input label="Target Products / Services" value={context.targetProducts} onChange={v => handleChange('targetProducts', v)} placeholder="e.g. Enterprise Solution XYZ" />
              <Input label="Product Domain" value={context.productDomain} onChange={v => handleChange('productDomain', v)} placeholder="e.g. Cybersecurity, AI SaaS" />
            </div>
          </div>

          <div className="lg:col-span-3 pt-6">
             <Input 
               label="Meeting Focus / Domains" 
               value={context.meetingFocus} 
               onChange={v => handleChange('meetingFocus', v)} 
               placeholder="e.g. ROI presentation, Technical deep-dive on integration APIs, Q3 Budget Review"
               isLarge
             />
          </div>
        </div>
      </div>

      {/* Persona Selection */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Brain /> Target Buyer Persona
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {PERSONAS.map(p => (
            <button
              key={p.type}
              onClick={() => handleChange('persona', p.type)}
              className={`p-8 rounded-[2.5rem] border-2 text-left transition-all relative overflow-hidden group flex flex-col items-center text-center ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-300 shadow-sm'}`}
            >
              <div className={`p-6 rounded-3xl mb-6 inline-block transition-transform duration-500 group-hover:scale-110 ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
              <p className={`font-black text-lg uppercase tracking-widest mb-3 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
              <p className={`text-[11px] leading-relaxed font-medium ${context.persona === p.type ? 'text-indigo-100' : 'text-slate-500'}`}>{p.desc}</p>
              {context.persona === p.type && (
                <div className="absolute top-6 right-6 text-white animate-bounce"><ICONS.Trophy /></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Styles */}
      <div className="space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Sparkles /> Desired Strategic Response Styles
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {ANSWER_STYLES.map(style => (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-6 py-4 rounded-[1.25rem] text-[10px] font-black uppercase tracking-widest border transition-all ${context.answerStyles.includes(style) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200 shadow-sm'}`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Neural Core System Prompt with Advanced Tuning */}
      <div className="bg-slate-900 rounded-[3rem] p-12 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-10 opacity-10 group-hover:opacity-30 transition-opacity">
          <ICONS.Brain className="text-indigo-400 w-24 h-24" />
        </div>
        <div className="relative z-10 space-y-8">
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <div className="w-1.5 h-6 bg-indigo-500 rounded-full"></div>
              <h3 className="text-indigo-400 text-[11px] font-black uppercase tracking-[0.4em]">Neural Core Tuning</h3>
            </div>
            
            <div className="flex items-center gap-4">
              <button 
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-2 px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest bg-slate-800 text-slate-400 hover:text-white transition-all"
              >
                <ICONS.Innovation className="w-4 h-4" /> {showAdvanced ? 'Simple Mode' : 'Advanced Sliders'}
              </button>
              <button 
                onClick={savePrompt}
                className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95 ${isSaved ? 'bg-emerald-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700'}`}
              >
                {isSaved ? 'Prompt Retained' : 'Update & Save Prompt'}
              </button>
            </div>
          </div>

          {showAdvanced && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-8 bg-slate-800/30 rounded-3xl border border-slate-700/50 animate-in fade-in slide-in-from-top-4">
               <SliderInput label="Temperature" min={0} max={2} step={0.1} value={context.temperature} onChange={v => handleChange('temperature', v)} desc="Creativity factor (0 = Deterministic, 2 = Random)" />
               <SliderInput label="Top-P" min={0} max={1} step={0.05} value={context.topP || 0.95} onChange={v => handleChange('topP', v)} desc="Nucleus sampling density" />
               <SliderInput label="Top-K" min={1} max={100} step={1} value={context.topK || 40} onChange={v => handleChange('topK', v)} desc="Vocabulary diversity filter" />
            </div>
          )}

          <div className="space-y-4">
            <textarea
              value={localPrompt}
              onChange={e => handlePromptUpdate(e.target.value)}
              className="w-full bg-slate-800/40 text-slate-200 border-2 border-slate-700/50 rounded-[2.5rem] p-10 text-sm focus:border-indigo-500 outline-none transition-all h-40 font-mono leading-relaxed shadow-inner"
              placeholder="AI system prompt..."
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                 <div className={`w-2 h-2 rounded-full ${isCustomizedRef.current ? 'bg-amber-500' : 'bg-indigo-500 animate-pulse'}`}></div>
                 <p className="text-slate-500 text-[10px] font-black uppercase tracking-widest">
                   {isCustomizedRef.current 
                     ? "Manual Neural Override Active" 
                     : "Engine Auto-Synchronization Enabled"}
                 </p>
              </div>
              {isCustomizedRef.current && (
                <button 
                  onClick={() => { isCustomizedRef.current = false; generateBasePrompt(); }}
                  className="text-[9px] font-black uppercase tracking-widest text-indigo-400 hover:text-indigo-300 transition-colors border-b border-indigo-400/30"
                >
                  Reset to Core Logic
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Opportunity Snapshot & Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Opportunity Snapshot</h3>
            <span className="px-3 py-1 bg-indigo-50 text-indigo-600 text-[9px] font-black uppercase tracking-widest rounded-full">Executive Lens</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">Provide a high-level summary of the deal stage and specific meeting objectives.</p>
          <textarea
            value={context.executiveSnapshot}
            onChange={e => handleChange('executiveSnapshot', e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl p-8 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all h-40 resize-none shadow-inner leading-relaxed"
            placeholder="e.g. Q3 renewal discussion, focus is on expanding to 500 seats while addressing recent concerns..."
          />
        </div>

        <div className="bg-white rounded-[2.5rem] p-10 shadow-xl border border-slate-100 space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-slate-800">Strategic Semantic Keywords</h3>
            <span className="px-3 py-1 bg-emerald-50 text-emerald-600 text-[9px] font-black uppercase tracking-widest rounded-full">Reasoning Anchors</span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed font-medium">Add competitors, internal project names, or critical jargon that should trigger specific logic.</p>
          <div className="flex gap-3 mb-6">
            <input
              type="text"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              placeholder="e.g. Salesforce, Project Hydra, Technical Debt..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-3 text-sm focus:border-indigo-500 focus:bg-white outline-none transition-all shadow-inner"
            />
            <button onClick={addKeyword} className="p-3 bg-indigo-600 text-white rounded-2xl hover:bg-indigo-700 shadow-xl shadow-indigo-100 transform active:scale-95 transition-all"><ICONS.X className="rotate-45" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {context.strategicKeywords.map((kw, i) => (
              <span key={i} className="px-4 py-2 bg-indigo-50 text-indigo-600 rounded-2xl text-[10px] font-black uppercase tracking-[0.1em] border border-indigo-100 flex items-center gap-3 animate-in zoom-in duration-300">
                {kw}
                <button onClick={() => handleChange('strategicKeywords', context.strategicKeywords.filter((_, idx) => idx !== i))} className="hover:text-rose-500 transition-colors bg-white/50 w-5 h-5 flex items-center justify-center rounded-lg">×</button>
              </span>
            ))}
            {context.strategicKeywords.length === 0 && <p className="text-slate-300 text-xs italic">No keywords added yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
};

const SliderInput = ({ label, min, max, step, value, onChange, desc }: { label: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void; desc: string }) => (
  <div className="space-y-3">
    <div className="flex justify-between items-center">
      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
      <span className="text-indigo-400 text-[10px] font-mono font-bold">{value}</span>
    </div>
    <input 
      type="range" min={min} max={max} step={step} value={value} 
      onChange={e => onChange(parseFloat(e.target.value))}
      className="w-full accent-indigo-500 bg-slate-800 rounded-lg h-1.5 cursor-pointer"
    />
    <p className="text-[9px] text-slate-600 font-medium italic opacity-60 leading-tight">{desc}</p>
  </div>
);

const Input = ({ label, value, onChange, placeholder, isLarge }: { label: string; value: string; onChange: (v: string) => void; placeholder: string, isLarge?: boolean }) => (
  <div className="space-y-2">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em] ml-1">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`w-full bg-slate-50 border-2 border-slate-100 rounded-2xl px-6 py-4 text-sm focus:border-indigo-500 focus:bg-white focus:shadow-[0_0_20px_-5px_rgba(79,70,229,0.2)] outline-none transition-all font-semibold text-slate-800 placeholder:text-slate-300 shadow-inner ${isLarge ? 'text-lg py-6' : ''}`}
      placeholder={placeholder}
    />
  </div>
);
