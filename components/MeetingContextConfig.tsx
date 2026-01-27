
import React, { useState, useEffect } from 'react';
import { MeetingContext, CustomerPersonaType } from '../types';
import { ICONS } from '../constants';

interface MeetingContextConfigProps {
  context: MeetingContext;
  onContextChange: (updated: MeetingContext) => void;
}

const PERSONAS: { type: CustomerPersonaType; label: string; desc: string; icon: React.ReactNode }[] = [
  { type: 'Balanced', label: 'Balanced', desc: 'Versatile profile for general business users in B2B settings', icon: <ICONS.Document /> },
  { type: 'Technical', label: 'Technical', desc: 'Deep technical, jargon-friendly (CTO, VP Engineering, Tech Lead)', icon: <ICONS.Brain /> },
  { type: 'Financial', label: 'Financial', desc: 'ROI-driven, cost-benefit analysis (CFO, Financial Controller)', icon: <ICONS.ROI /> },
  { type: 'Business Executives', label: 'Executives', desc: 'Strategic impact, operational clarity (CEO, Founder, MD)', icon: <ICONS.Trophy /> },
];

const ANSWER_STYLES = [
  "Concise Answer", "In-Depth Response", "Answer in Points", "Use Analogy", 
  "Define Technical Terms", "Sales Points", "Key Statistics", "Case Study Summary", 
  "Competitive Comparison", "Anticipated Customer Questions", "Information Gap", 
  "Pricing Overview"
];

export const MeetingContextConfig: React.FC<MeetingContextConfigProps> = ({ context, onContextChange }) => {
  const [keywordInput, setKeywordInput] = useState("");

  useEffect(() => {
    generateBasePrompt();
  }, [context.persona, context.answerStyles, context.meetingFocus]);

  const generateBasePrompt = () => {
    let prompt = `Act as a Cognitive AI Sales Intelligence Agent for ${context.persona} buyers. `;
    if (context.answerStyles.length > 0) {
      prompt += `Your responses should strictly follow these styles: ${context.answerStyles.join(', ')}. `;
    }
    prompt += `Always ground your logic in source documents and maintain a ${context.persona.toLowerCase()} tone.`;
    
    if (prompt !== context.baseSystemPrompt) {
      onContextChange({ ...context, baseSystemPrompt: prompt });
    }
  };

  const handleChange = (field: keyof MeetingContext, value: any) => {
    onContextChange({ ...context, [field]: value });
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
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Participant Info */}
      <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-6">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Document /> Meeting Participants & Context
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input label="Seller Company" value={context.sellerCompany} onChange={v => handleChange('sellerCompany', v)} placeholder="e.g. SpikedAI" />
          <Input label="Seller Name(s)" value={context.sellerNames} onChange={v => handleChange('sellerNames', v)} placeholder="e.g. Avi Sahi" />
          <Input label="Client Company" value={context.clientCompany} onChange={v => handleChange('clientCompany', v)} placeholder="e.g. Harbor Best Investments" />
          <Input label="Client Name(s)" value={context.clientNames} onChange={v => handleChange('clientNames', v)} placeholder="e.g. Jason" />
          <Input label="Target Products / Services" value={context.targetProducts} onChange={v => handleChange('targetProducts', v)} placeholder="e.g. Sales Efficiency Engine" />
          <Input label="Product Domain" value={context.productDomain} onChange={v => handleChange('productDomain', v)} placeholder="e.g. Enterprise SaaS" />
          <div className="md:col-span-2">
            <Input label="Meeting Focus / Domains" value={context.meetingFocus} onChange={v => handleChange('meetingFocus', v)} placeholder="e.g. Q4 Growth, Reducing Deal Friction" />
          </div>
        </div>
      </div>

      {/* Persona Selection */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Brain /> Customer Persona
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {PERSONAS.map(p => (
            <button
              key={p.type}
              onClick={() => handleChange('persona', p.type)}
              className={`p-6 rounded-[2rem] border-2 text-left transition-all relative overflow-hidden group ${context.persona === p.type ? 'bg-indigo-600 border-indigo-600 shadow-xl scale-[1.02]' : 'bg-white border-slate-100 hover:border-indigo-200 shadow-sm'}`}
            >
              <div className={`p-3 rounded-2xl mb-4 inline-block ${context.persona === p.type ? 'bg-white/20 text-white' : 'bg-indigo-50 text-indigo-500'}`}>{p.icon}</div>
              <p className={`font-black text-sm uppercase tracking-widest mb-2 ${context.persona === p.type ? 'text-white' : 'text-slate-800'}`}>{p.label}</p>
              <p className={`text-[10px] leading-tight font-medium ${context.persona === p.type ? 'text-indigo-100' : 'text-slate-500'}`}>{p.desc}</p>
              {context.persona === p.type && (
                <div className="absolute top-4 right-4 text-white"><ICONS.Trophy /></div>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Answer Styles */}
      <div className="space-y-4">
        <h3 className="text-xl font-bold text-slate-800 flex items-center gap-2">
          <ICONS.Sparkles /> Answer Styles
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {ANSWER_STYLES.map(style => (
            <button
              key={style}
              onClick={() => toggleStyle(style)}
              className={`px-4 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest border transition-all ${context.answerStyles.includes(style) ? 'bg-indigo-600 text-white border-indigo-600 shadow-lg' : 'bg-white text-slate-500 border-slate-100 hover:border-indigo-200 shadow-sm'}`}
            >
              {style}
            </button>
          ))}
        </div>
      </div>

      {/* Executive Snapshot & Keywords */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Executive Snapshot</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Brief summary of the opportunity</p>
          <textarea
            value={context.executiveSnapshot}
            onChange={e => handleChange('executiveSnapshot', e.target.value)}
            className="w-full bg-slate-50 border-2 border-slate-100 rounded-2xl p-6 text-sm focus:border-indigo-500 outline-none transition-all h-32 resize-none"
            placeholder="e.g. Q3 renewal discussion, focus is on expanding to 500 seats while addressing recent downtime concerns..."
          />
        </div>

        <div className="bg-white rounded-[2rem] p-8 shadow-xl border border-slate-100 space-y-4">
          <h3 className="text-lg font-bold text-slate-800">Strategic Keywords</h3>
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Competitors or jargon to watch for</p>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              value={keywordInput}
              onChange={e => setKeywordInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addKeyword()}
              placeholder="Add a keyword..."
              className="flex-1 bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2 text-sm focus:border-indigo-500 outline-none transition-all"
            />
            <button onClick={addKeyword} className="p-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 shadow-lg"><ICONS.X className="rotate-45" /></button>
          </div>
          <div className="flex flex-wrap gap-2">
            {context.strategicKeywords.map((kw, i) => (
              <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-600 rounded-full text-[10px] font-black uppercase tracking-widest border border-indigo-100 flex items-center gap-2">
                {kw}
                <button onClick={() => handleChange('strategicKeywords', context.strategicKeywords.filter((_, idx) => idx !== i))} className="hover:text-rose-500 transition-colors">×</button>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Base Prompt Preview */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden group">
        <div className="absolute top-0 right-0 p-6 opacity-20 group-hover:opacity-100 transition-opacity">
          <ICONS.Brain className="text-indigo-400 w-12 h-12" />
        </div>
        <h3 className="text-indigo-400 text-[10px] font-black uppercase tracking-[0.3em] mb-4">Base System Prompt (Auto-Generated)</h3>
        <textarea
          value={context.baseSystemPrompt}
          onChange={e => handleChange('baseSystemPrompt', e.target.value)}
          className="w-full bg-slate-800/50 text-slate-200 border-2 border-slate-700/50 rounded-2xl p-6 text-sm focus:border-indigo-500 outline-none transition-all h-24 font-mono leading-relaxed"
          placeholder="AI system prompt..."
        />
        <p className="text-slate-500 text-[9px] mt-4 italic">You can edit this prompt directly if you need to override the automatic generation.</p>
      </div>
    </div>
  );
};

const Input = ({ label, value, onChange, placeholder }: { label: string; value: string; onChange: (v: string) => void; placeholder: string }) => (
  <div className="space-y-1.5">
    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</label>
    <input
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      className="w-full bg-slate-50 border-2 border-slate-100 rounded-xl px-4 py-2.5 text-sm focus:border-indigo-500 outline-none transition-all font-medium"
      placeholder={placeholder}
    />
  </div>
);
