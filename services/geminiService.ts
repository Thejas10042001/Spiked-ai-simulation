
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext, ThinkingLevel, VideoStoryboard } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const THINKING_LEVEL_MAP: Record<ThinkingLevel, number> = {
  'Minimal': 0,
  'Low': 4000,
  'Medium': 16000,
  'High': 32768
};

/**
 * Advanced Semantic OCR using Gemini 3 Pro.
 */
export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  const modelName = 'gemini-3-pro-preview'; 
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { 
            text: `Act as a high-precision Cognitive OCR engine. 
            TRANSCRIPTION TASK:
            1. Extract ALL text from this image exactly as written.
            2. Maintain structural layout.
            3. Output ONLY the extracted text.` 
          },
        ],
      },
    });
    return response.text || "";
  } catch (error) {
    console.error("Vision OCR failed:", error);
    return "";
  }
}

export interface CognitiveSearchResult {
  detailedAnalysis: string;
  useCase: string;
  personaAlignment: string;
  conclusion: string;
  articularSoundbite: string;
}

/**
 * Performs a deeply grounded search utilizing full meeting context.
 * CRITICAL: Optimized for SUB-1-SECOND LATENCY using Gemini Flash & Pruned Schema.
 */
export async function performCognitiveSearch(
  question: string, 
  filesContent: string, 
  context: MeetingContext
): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-flash-preview';
  
  // Pruned grounding to strictly relevant window to minimize processing time
  const groundingContext = filesContent.substring(0, 6000);
  
  const stylesList = context.answerStyles.length > 0 
    ? context.answerStyles.map(s => `### ${s}`).join(', ')
    : "Executive Summary";

  const prompt = `CLIENT: ${context.clientCompany} | PERSONA: ${context.persona} | FOCUS: ${context.meetingFocus}.
  QUESTION: "${question}".
  
  TASK: Synthesize a high-density, multi-paragraph intelligence brief.
  MANDATORY SECTIONS TO INCLUDE IN 'detailedAnalysis': ${stylesList}.
  
  GROUNDING DATA:
  ${groundingContext}
  
  JSON OUTPUT ONLY.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        // PRIORITIZE USER'S NEURAL CORE TUNING
        systemInstruction: `You are an elite Sales Strategist. 
        USER CORE LOGIC OVERRIDE: ${context.baseSystemPrompt || "Provide grounded intelligence."}
        
        INSTRUCTIONS:
        1. 'detailedAnalysis' MUST be long, detailed, and use Markdown headers (###) for the requested styles: ${stylesList}.
        2. 'useCase' must describe a full business scenario.
        3. 'personaAlignment' must explain why this fits a ${context.persona} mindset.
        4. Maintain sub-1s latency. Be direct and high-impact.`,
        responseMimeType: "application/json",
        temperature: 0, // Deterministic speed
        topP: 0.1,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1200, 
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            detailedAnalysis: { type: Type.STRING, description: "Multi-paragraph explanation using ### for styles" },
            useCase: { type: Type.STRING, description: "Comprehensive business use case scenario" },
            personaAlignment: { type: Type.STRING, description: "In-depth psychological fit for the persona" },
            conclusion: { type: Type.STRING, description: "Strong final strategic takeaway" },
            articularSoundbite: { type: Type.STRING, description: "Powerful one-sentence executive summary" }
          },
          required: ["detailedAnalysis", "useCase", "personaAlignment", "conclusion", "articularSoundbite"]
        }
      }
    });
    
    const text = response.text || "{}";
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Flash synthesis failed:", error);
    throw new Error("Velocity inquiry failed.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 strategic questions for ${context.clientCompany} regarding ${context.meetingFocus}. Return JSON array.`;
  const response = await ai.models.generateContent({ model: modelName, contents: prompt, config: { responseMimeType: "application/json" } });
  return JSON.parse(response.text || "[]");
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binaryString.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sampleRate: number, numChannels: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
  }
  return buffer;
}

export async function generateExplanation(question: string, context: AnalysisResult): Promise<string> {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Explain this sales strategy question: "${question}" based on: ${JSON.stringify(context.snapshot)}`,
  });
  return response.text || "";
}

export async function generatePitchAudio(text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> {
  const response = await ai.models.generateContent({
    model: "gemini-2.5-flash-preview-tts",
    contents: [{ parts: [{ text: text }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
    },
  });
  const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
  return base64Audio ? decode(base64Audio) : null;
}

export async function analyzeSalesContext(filesContent: string, context: MeetingContext): Promise<AnalysisResult> {
  const modelName = 'gemini-3-pro-preview';
  const citationSchema = {
    type: Type.OBJECT,
    properties: {
      snippet: { type: Type.STRING },
      sourceFile: { type: Type.STRING },
    },
    required: ["snippet", "sourceFile"],
  };

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      snapshot: {
        type: Type.OBJECT,
        properties: {
          role: { type: Type.STRING },
          roleCitation: citationSchema,
          priorities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          likelyObjections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          decisionStyle: { type: Type.STRING },
          decisionStyleCitation: citationSchema,
          riskTolerance: { type: Type.STRING },
          riskToleranceCitation: citationSchema,
          tone: { type: Type.STRING },
        },
        required: ["role", "roleCitation", "priorities", "likelyObjections", "decisionStyle", "decisionStyleCitation", "riskTolerance", "riskToleranceCitation", "tone"],
      },
      documentInsights: {
        type: Type.OBJECT,
        properties: {
          entities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { name: { type: Type.STRING }, type: { type: Type.STRING }, context: { type: Type.STRING }, citation: citationSchema }, required: ["name", "type", "context", "citation"] } },
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] },
          summaries: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                fileName: { type: Type.STRING },
                summary: { type: Type.STRING },
                strategicImpact: { type: Type.STRING },
                criticalInsights: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["fileName", "summary", "strategicImpact", "criticalInsights"]
            }
          }
        },
        required: ["entities", "structure", "summaries"]
      },
      competitiveComparison: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            name: { type: Type.STRING },
            overview: { type: Type.STRING },
            strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
            weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } },
            ourWedge: { type: Type.STRING },
            citation: citationSchema
          },
          required: ["name", "overview", "strengths", "weaknesses", "ourWedge", "citation"]
        }
      },
      openingLines: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { text: { type: Type.STRING }, label: { type: Type.STRING }, citation: citationSchema }, 
          required: ["text", "label", "citation"] 
        } 
      },
      predictedQuestions: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { customerAsks: { type: Type.STRING }, salespersonShouldRespond: { type: Type.STRING }, reasoning: { type: Type.STRING }, category: { type: Type.STRING }, citation: citationSchema }, required: ["customerAsks", "salespersonShouldRespond", "reasoning", "category", "citation"] } },
      strategicQuestionsToAsk: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { question: { type: Type.STRING }, whyItMatters: { type: Type.STRING }, citation: citationSchema }, required: ["question", "whyItMatters", "citation"] } },
      objectionHandling: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { objection: { type: Type.STRING }, realMeaning: { type: Type.STRING }, strategy: { type: Type.STRING }, exactWording: { type: Type.STRING }, citation: citationSchema }, required: ["objection", "realMeaning", "strategy", "exactWording", "citation"] } },
      toneGuidance: { type: Type.OBJECT, properties: { wordsToUse: { type: Type.ARRAY, items: { type: Type.STRING } }, wordsToAvoid: { type: Type.ARRAY, items: { type: Type.STRING } }, sentenceLength: { type: Type.STRING }, technicalDepth: { type: Type.STRING } }, required: ["wordsToUse", "wordsToAvoid", "sentenceLength", "technicalDepth"] },
      finalCoaching: { type: Type.OBJECT, properties: { dos: { type: Type.ARRAY, items: { type: Type.STRING } }, donts: { type: Type.ARRAY, items: { type: Type.STRING } }, finalAdvice: { type: Type.STRING } }, required: ["dos", "donts", "finalAdvice"] }
    },
    required: ["snapshot", "documentInsights", "competitiveComparison", "openingLines", "predictedQuestions", "strategicQuestionsToAsk", "objectionHandling", "toneGuidance", "finalCoaching"]
  };

  const prompt = `Synthesize high-fidelity cognitive sales intelligence. 
  
  DOCUMENT UNDERSTANDING REQUIREMENTS:
  Extract exactly into 'documentInsights.entities':
  - 'Company': Target client or partners.
  - 'Person': Key personnel with roles.
  - 'Product': Names of software/projects.
  - 'Metric': Financial/KPI data points.
  
  For EVERY entity:
  1. Provide a grounded 'name'.
  2. Assign a 'type' from above.
  3. Include 'context' on relevance to this deal.
  4. Link to a high-quality 'citation'.

  --- GROUNDING DOCUMENTS --- 
  ${filesContent}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: context.baseSystemPrompt || `You are a Cognitive Sales Strategist. Provide grounded intelligence.`,
        responseMimeType: "application/json",
        responseSchema,
        temperature: context.temperature,
        topP: context.topP,
        topK: context.topK,
        seed: context.seed,
        thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] }
      },
    });
    
    return JSON.parse(response.text || "{}") as AnalysisResult;
  } catch (error: any) {
    throw new Error(`Intelligence Analysis Failed: ${error.message}`);
  }
}

export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Generate 3 distinct cinematic video concepts. Return JSON array.`;
  const response = await ai.models.generateContent({
    model: modelName,
    contents: prompt,
    config: { 
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            id: { type: Type.STRING },
            title: { type: Type.STRING },
            description: { type: Type.STRING },
            angle: { type: Type.STRING },
            veoPrompt: { type: Type.STRING },
          },
          required: ["id", "title", "description", "angle", "veoPrompt"]
        }
      }
    }
  });
  return JSON.parse(response.text || "[]");
}

export async function startVideoGeneration(prompt: string, aspectRatio: '16:9' | '9:16') {
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await veoAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: { numberOfVideos: 1, resolution: '720p', aspectRatio: aspectRatio }
  });
}

export async function getVideoStatus(operation: any) {
  const veoAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await veoAi.operations.getVideosOperation({ operation: operation });
}
