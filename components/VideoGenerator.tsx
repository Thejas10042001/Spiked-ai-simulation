
import React, { useState, useEffect, useMemo } from 'react';
import { AnalysisResult } from '../types';
import { ICONS } from '../constants';
import { startVideoGeneration, getVideoStatus, generateVideoStoryboard, VideoStoryboard } from '../services/geminiService';

interface VideoGeneratorProps {
  analysis: AnalysisResult;
}

export const VideoGenerator: React.FC<VideoGeneratorProps> = ({ analysis }) => {
  const [hasApiKey, setHasApiKey] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState("");
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [error, setError] = useState<string | null>(null);
  
  const [storyboards, setStoryboards] = useState<VideoStoryboard[]>([]);
  const [isIdeating, setIsIdeating] = useState(false);
  const [selectedConcept, setSelectedConcept] = useState<VideoStoryboard | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      const selected = await (window as any).aistudio.hasSelectedApiKey();
      setHasApiKey(selected);
      if (selected) fetchStoryboards();
    };
    checkKey();
  }, []);

  const fetchStoryboards = async () => {
    setIsIdeating(true);
    try {
      const res = await generateVideoStoryboard(analysis);
      setStoryboards(res);
    } catch (e) {
      setError("Failed to conceptualize video strategy.");
    } finally {
      setIsIdeating(false);
    }
  };

  const handleOpenKeySelection = async () => {
    await (window as any).aistudio.openSelectKey();
    setHasApiKey(true); 
    fetchStoryboards();
  };

  const generatePitchVideo = async () => {
    if (!selectedConcept) return;
    setIsGenerating(true);
    setError(null);
    setStatusMessage("Conceptualizing visual metaphor...");

    const messages = [
      "Directing scene transitions...",
      "Synthesizing persona-aligned visuals...",
      "Rendering cinematic strategic frames...",
      "Finalizing high-fidelity explainer...",
      "Grounding visual content in source data..."
    ];

    let msgIdx = 0;
    const interval = setInterval(() => {
      setStatusMessage(messages[msgIdx % messages.length]);
      msgIdx++;
    }, 15000);

    try {
      let operation = await startVideoGeneration(selectedConcept.veoPrompt, aspectRatio);
      
      while (!operation.done) {
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await getVideoStatus(operation);
      }

      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      const response = await fetch(`${downloadLink}&key=${process.env.API_KEY}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
    } catch (err: any) {
      console.error(err);
      if (err.message?.includes("entity was not found")) {
        setHasApiKey(false);
        setError("Selected API key project not found. Please re-select a paid project.");
      } else {
        setError("Video generation failed. Please try again.");
      }
    } finally {
      clearInterval(interval);
      setIsGenerating(false);
      setStatusMessage("");
    }
  };

  if (!hasApiKey) {
    return (
      <div className="bg-slate-900 text-white rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl border border-slate-800">
        <div className="w-20 h-20 bg-indigo-600 rounded-3xl flex items-center justify-center mx-auto shadow-indigo-500/20 shadow-lg rotate-3">
          <ICONS.Sparkles />
        </div>
        <h3 className="text-3xl font-black tracking-tight">Activate Visual Intelligence</h3>
        <p className="text-slate-400 max-w-lg mx-auto leading-relaxed">
          High-fidelity video generation requires access to a paid Google Cloud project via the Gemini API. 
          Please select a project with active billing to continue.
        </p>
        <div className="flex flex-col items-center gap-4">
          <button 
            onClick={handleOpenKeySelection}
            className="px-8 py-4 bg-white text-slate-900 font-black rounded-full hover:bg-indigo-50 transition-all transform hover:scale-105 active:scale-95"
          >
            Select Paid API Key
          </button>
          <a 
            href="https://ai.google.dev/gemini-api/docs/billing" 
            target="_blank" 
            className="text-xs text-indigo-400 font-bold uppercase tracking-widest hover:text-indigo-300 transition-colors"
          >
            Review Billing Documentation
          </a>
        </div>
        {error && <p className="text-rose-400 text-xs font-bold bg-rose-950/30 py-2 px-4 rounded-full border border-rose-900/50">{error}</p>}
      </div>
    );
  }

  return (
    <div className="bg-white border border-slate-200 rounded-[2.5rem] p-10 shadow-xl overflow-hidden relative min-h-[600px]">
      <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-10">
        <div className="flex items-center gap-3">
          <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-100">
            <ICONS.Play />
          </div>
          <div>
            <h3 className="text-2xl font-bold text-slate-800 tracking-tight">AI Explainer Studio</h3>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Grounded Sales Visuals</p>
          </div>
        </div>

        {!videoUrl && !isGenerating && (
          <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-full border border-slate-200">
            <button 
              onClick={() => setAspectRatio('16:9')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${aspectRatio === '16:9' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              16:9 Desktop
            </button>
            <button 
              onClick={() => setAspectRatio('9:16')}
              className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${aspectRatio === '9:16' ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-800'}`}
            >
              9:16 Mobile
            </button>
          </div>
        )}
      </div>

      {isIdeating ? (
        <div className="py-20 text-center space-y-4">
           <div className="w-12 h-12 border-2 border-indigo-100 border-t-indigo-600 rounded-full animate-spin mx-auto"></div>
           <p className="text-slate-400 text-xs font-black uppercase tracking-widest">Crafting Storyboards...</p>
        </div>
      ) : !videoUrl && !isGenerating ? (
        <div className="space-y-10 animate-in fade-in duration-700">
          <div className="max-w-2xl">
            <h4 className="text-xl font-bold text-slate-800 mb-2">Step 1: Select Your Visual Strategy</h4>
            <p className="text-sm text-slate-500 leading-relaxed">
              We've conceptualized three distinct cinematic approaches based on your analysis of the <strong>{analysis.snapshot.role}</strong>. Choose one to trigger neural rendering.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {storyboards.map((story) => (
              <button
                key={story.id}
                onClick={() => setSelectedConcept(story)}
                className={`p-8 rounded-[2rem] border-2 text-left transition-all relative overflow-hidden group ${selectedConcept?.id === story.id ? 'bg-indigo-600 border-indigo-600 shadow-2xl scale-[1.02]' : 'bg-slate-50 border-slate-100 hover:border-indigo-300 shadow-sm'}`}
              >
                <div className={`text-[9px] font-black uppercase tracking-widest mb-3 ${selectedConcept?.id === story.id ? 'text-indigo-200' : 'text-indigo-500'}`}>{story.angle} Strategy</div>
                <p className={`font-black text-lg mb-4 tracking-tight leading-tight ${selectedConcept?.id === story.id ? 'text-white' : 'text-slate-800'}`}>{story.title}</p>
                <p className={`text-xs leading-relaxed ${selectedConcept?.id === story.id ? 'text-indigo-100' : 'text-slate-500'}`}>{story.description}</p>
                {selectedConcept?.id === story.id && (
                  <div className="absolute top-4 right-4 text-white animate-bounce"><ICONS.Trophy /></div>
                )}
              </button>
            ))}
          </div>

          {selectedConcept && (
            <div className="flex flex-col items-center pt-8 border-t border-slate-100">
               <button 
                onClick={generatePitchVideo}
                className="inline-flex items-center gap-3 px-12 py-6 bg-indigo-600 text-white rounded-full font-black text-xl hover:bg-indigo-700 transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-indigo-100"
              >
                <ICONS.Play />
                Render Concept: {selectedConcept.title}
              </button>
              <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-4">Estimated Time: 60-90 Seconds</p>
            </div>
          )}
        </div>
      ) : isGenerating ? (
        <div className="bg-slate-50 border border-slate-100 rounded-[2rem] py-24 flex flex-col items-center justify-center space-y-6">
          <div className="relative">
            <div className="w-24 h-24 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin"></div>
            <div className="absolute inset-0 flex items-center justify-center text-indigo-600 animate-pulse">
               <ICONS.Brain />
            </div>
          </div>
          <div className="text-center">
            <p className="text-xl font-bold text-slate-800 animate-pulse">{statusMessage}</p>
            <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em] mt-2">Veo 3.1 Neural Engine Engaged</p>
          </div>
          {/* Animated Render Bar */}
          <div className="w-64 h-1 bg-slate-200 rounded-full overflow-hidden mt-4">
             <div className="h-full bg-indigo-500 animate-[progress_1.5s_infinite]"></div>
          </div>
        </div>
      ) : videoUrl && (
        <div className="space-y-6 animate-in fade-in zoom-in duration-700">
          <div className="aspect-video bg-black rounded-[2.5rem] overflow-hidden shadow-2xl relative group">
            <video src={videoUrl} controls className="w-full h-full object-contain" />
            <div className="absolute bottom-6 left-6 p-4 bg-black/40 backdrop-blur-md border border-white/20 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity">
               <p className="text-white text-xs font-bold">{selectedConcept?.title}</p>
               <p className="text-white/60 text-[10px] uppercase tracking-widest">{selectedConcept?.angle} Angle</p>
            </div>
          </div>
          <div className="flex justify-between items-center px-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></span>
                <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Neural Render Complete</p>
              </div>
              <div className="h-4 w-px bg-slate-200"></div>
              <p className="text-[10px] text-slate-400 italic">Inspired by {analysis.snapshot.priorities[0].text}</p>
            </div>
            <div className="flex gap-4">
              <button 
                onClick={() => {setVideoUrl(null); setSelectedConcept(null);}}
                className="px-8 py-3 bg-slate-100 text-slate-600 text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-slate-200 transition-colors"
              >
                New Concept
              </button>
              <a 
                href={videoUrl} 
                download="sales-pitch-explainer.mp4"
                className="px-8 py-3 bg-indigo-600 text-white text-[10px] font-black uppercase tracking-widest rounded-full hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                Download MP4
              </a>
            </div>
          </div>
        </div>
      )}
      
      <style>{`
        @keyframes progress {
          0% { width: 0%; transform: translateX(-100%); }
          50% { width: 100%; transform: translateX(0%); }
          100% { width: 0%; transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
};
