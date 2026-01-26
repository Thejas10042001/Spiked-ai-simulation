
import React, { useState, useCallback, useMemo } from 'react';
import { Header } from './components/Header';
import { FileUpload } from './components/FileUpload';
import { AnalysisView } from './components/AnalysisView';
import { VideoGenerator } from './components/VideoGenerator';
import { AudioGenerator } from './components/AudioGenerator';
import { PracticeSession } from './components/PracticeSession';
import { analyzeSalesContext } from './services/geminiService';
import { AnalysisResult, UploadedFile } from './types';
import { ICONS } from './constants';

const App: React.FC = () => {
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [activeTab, setActiveTab] = useState<'strategy' | 'video' | 'audio' | 'practice'>('strategy');

  const isAnyFileProcessing = useMemo(() => files.some(f => f.status === 'processing'), [files]);
  const readyFilesCount = useMemo(() => files.filter(f => f.status === 'ready').length, [files]);

  const runAnalysis = useCallback(async () => {
    const readyFiles = files.filter(f => f.status === 'ready');
    if (readyFiles.length === 0) {
      setError("Please ensure at least one document is ready for analysis.");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setStatusMessage("Extracting key themes and intent...");

    try {
      const combinedContent = readyFiles.map(f => `FILE: ${f.name}\n${f.content}`).join('\n\n');
      const timer = setTimeout(() => setStatusMessage("Inferring buyer psychology..."), 2000);
      const timer2 = setTimeout(() => setStatusMessage("Simulating predicted objections..."), 4500);
      const timer3 = setTimeout(() => setStatusMessage("Formulating exact coaching lines..."), 7000);

      const result = await analyzeSalesContext(combinedContent);
      
      clearTimeout(timer);
      clearTimeout(timer2);
      clearTimeout(timer3);
      
      setAnalysis(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setIsAnalyzing(false);
      setStatusMessage("");
    }
  }, [files]);

  const reset = () => {
    setFiles([]);
    setAnalysis(null);
    setError(null);
    setActiveTab('strategy');
  };

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      <Header />
      
      <main className="max-w-6xl mx-auto px-4 pt-28">
        {!analysis && !isAnalyzing ? (
          <div className="space-y-8 animate-in fade-in slide-in-from-top-4 duration-500">
            <div className="text-center space-y-4">
              <h1 className="text-5xl font-extrabold text-slate-900 tracking-tight">
                Cognitive Sales Strategy Agent
              </h1>
              <p className="text-lg text-slate-500 max-w-2xl mx-auto leading-relaxed">
                Upload pitch decks, KYC reports, or meeting notes. Our AI performs cognitive grounding to provide exact scripts and strategic insights.
              </p>
            </div>

            <div className="bg-white rounded-[2rem] shadow-2xl p-10 border border-slate-200">
              <FileUpload files={files} onFilesChange={setFiles} />
              
              <div className="mt-10 flex flex-col items-center">
                {error && (
                  <div className="bg-rose-50 border border-rose-100 rounded-2xl p-6 mb-8 max-w-xl text-center">
                    <p className="text-rose-600 font-bold mb-2">⚠️ Analysis Interrupted</p>
                    <p className="text-rose-500 text-sm leading-relaxed">{error}</p>
                    {error.includes("Quota") && (
                      <p className="text-slate-400 text-[10px] mt-4 uppercase font-bold tracking-widest">
                        Tip: Gemini Free Tier has strict rate limits. Try again in 60 seconds.
                      </p>
                    )}
                  </div>
                )}
                <button
                  onClick={runAnalysis}
                  disabled={readyFilesCount === 0 || isAnyFileProcessing}
                  className={`
                    flex items-center gap-3 px-10 py-5 rounded-full font-black text-lg shadow-2xl transition-all
                    ${(readyFilesCount > 0 && !isAnyFileProcessing)
                      ? 'bg-indigo-600 text-white hover:bg-indigo-700 hover:scale-105 active:scale-95 cursor-pointer shadow-indigo-200' 
                      : 'bg-slate-200 text-slate-400 cursor-not-allowed shadow-none'}
                  `}
                >
                  <ICONS.Brain />
                  {isAnyFileProcessing ? 'Processing Documents...' : 'Build Grounded Strategy'}
                </button>
              </div>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 text-center pt-8">
              <FeatureCard icon={<ICONS.Shield />} title="Cognitive Grounding" description="Every insight is linked directly to a specific segment in your source files." />
              <FeatureCard icon={<ICONS.Brain />} title="Dialectical Empathy" description="Infers unspoken buyer fears by analyzing tone and risk patterns in documents." />
              <FeatureCard icon={<ICONS.Speaker />} title="Auditory Coaching" description="Generate professional strategy briefings and pitch rehearsels with AI voices." />
            </div>
          </div>
        ) : isAnalyzing ? (
          <div className="flex flex-col items-center justify-center py-32 space-y-8">
            <div className="relative">
              <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center text-indigo-600 scale-125">
                <ICONS.Brain />
              </div>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 animate-pulse tracking-tight">{statusMessage}</p>
              <p className="text-sm text-slate-400 mt-3 font-medium uppercase tracking-[0.2em]">Senior Strategy Engine Engaged</p>
            </div>
          </div>
        ) : (
          <div className="space-y-12">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white px-8 py-6 rounded-[2rem] shadow-xl border border-slate-100">
              <div className="flex items-center gap-4 overflow-x-auto no-scrollbar py-2">
                <button 
                  onClick={() => setActiveTab('strategy')}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'strategy' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <ICONS.Document />
                  Strategy Brief
                </button>
                <button 
                  onClick={() => setActiveTab('practice')}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'practice' ? 'bg-rose-50 text-rose-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <ICONS.Chat />
                  Live Practice
                </button>
                <button 
                  onClick={() => setActiveTab('video')}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'video' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <ICONS.Play />
                  Visual Pitch
                </button>
                <button 
                  onClick={() => setActiveTab('audio')}
                  className={`flex items-center gap-3 px-6 py-3 rounded-2xl font-bold transition-all whitespace-nowrap ${activeTab === 'audio' ? 'bg-indigo-50 text-indigo-600 shadow-sm' : 'text-slate-500 hover:bg-slate-50'}`}
                >
                  <ICONS.Speaker />
                  Audio Briefing
                </button>
              </div>
              <button 
                onClick={reset}
                className="px-6 py-3 bg-slate-50 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-slate-100 transition-colors border border-slate-200"
              >
                Reset Session
              </button>
            </div>

            {activeTab === 'strategy' && <AnalysisView result={analysis!} files={files} />}
            {activeTab === 'practice' && <PracticeSession analysis={analysis!} />}
            {activeTab === 'video' && <VideoGenerator analysis={analysis!} />}
            {activeTab === 'audio' && <AudioGenerator analysis={analysis!} />}
          </div>
        )}
      </main>

      <footer className="mt-20 text-center text-slate-400 text-[10px] font-bold uppercase tracking-widest pb-10">
        &copy; 2024 Cognitive Intelligence Systems • Enterprise Sales Architecture
      </footer>
    </div>
  );
};

const FeatureCard = ({ title, description, icon }: { title: string; description: string; icon: React.ReactNode }) => (
  <div className="p-8 bg-white rounded-3xl border border-slate-100 shadow-xl hover:shadow-2xl transition-shadow group">
    <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center mb-6 mx-auto group-hover:bg-indigo-600 group-hover:text-white transition-colors">
      {icon}
    </div>
    <h4 className="font-bold text-slate-800 mb-3 text-lg">{title}</h4>
    <p className="text-sm text-slate-500 leading-relaxed">{description}</p>
  </div>
);

export default App;
