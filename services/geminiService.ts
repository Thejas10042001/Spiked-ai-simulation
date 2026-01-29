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
  answer: string;
  briefExplanation: string;
  articularSoundbite: string; // Verbatim one-liner for the seller
  psychologicalProjection: {
    buyerFear: string;
    buyerIncentive: string;
    strategicLever: string;
  };
  citations: { snippet: string; source: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

export async function performCognitiveSearch(
  question: string, 
  filesContent: string, 
  context: MeetingContext
): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-pro-preview';
  
  // Refined prompt to enforce the strategic response styles as headers
  const prompt = `MEETING INTELLIGENCE CONTEXT:
  Seller: ${context.sellerNames} (${context.sellerCompany})
  Client Stakeholder: ${context.clientNames} (${context.clientCompany})
  Target Persona: ${context.persona}
  Meeting Focus: ${context.meetingFocus}
  
  STRATEGIC ENCODING REQUIREMENTS:
  You MUST organize the "answer" field using the following Strategic Response Styles as explicit section headers:
  ${context.answerStyles.length > 0 ? context.answerStyles.map(style => `### ${style}`).join('\n') : "### Strategic Analysis"}

  TASK: Synthesize a COGNITIVE ARTICULAR RESPONSE. 
  1. Use "High-Density Articulation": Precise, professional, and grounded.
  2. For each requested section style header, provide the relevant intelligence briefly but deeply.
  3. Simulate how this stakeholder perceives the logic.

  DOCUMENT SOURCE DATA:
  ${filesContent || "No documents provided."}

  QUESTION: ${question}

  RESPONSE REQUIREMENTS:
  - "answer": The structured response using the headers requested above. Use Markdown for sections.
  - "briefExplanation": A 2-sentence executive summary.
  - "articularSoundbite": A punchy, 10-word verbatim sentence for the seller.
  - "psychologicalProjection": Mapping of Fear, Incentive, and Lever.

  Return as JSON.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: context.baseSystemPrompt || `You are Avi from Spiked, a world-class Sales Strategist. Provide "Cognitive Articulation" — speaking to the buyer's hidden professional motivations using the user's selected styles.`,
        responseMimeType: "application/json",
        temperature: context.temperature,
        thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] },
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
            briefExplanation: { type: Type.STRING },
            articularSoundbite: { type: Type.STRING },
            psychologicalProjection: {
              type: Type.OBJECT,
              properties: {
                buyerFear: { type: Type.STRING },
                buyerIncentive: { type: Type.STRING },
                strategicLever: { type: Type.STRING }
              },
              required: ["buyerFear", "buyerIncentive", "strategicLever"]
            },
            citations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  snippet: { type: Type.STRING },
                  source: { type: Type.STRING }
                },
                required: ["snippet", "source"]
              }
            },
            reasoningChain: {
              type: Type.OBJECT,
              properties: {
                painPoint: { type: Type.STRING },
                capability: { type: Type.STRING },
                strategicValue: { type: Type.STRING }
              },
              required: ["painPoint", "capability", "strategicValue"]
            }
          },
          required: ["answer", "briefExplanation", "articularSoundbite", "psychologicalProjection", "citations", "reasoningChain"]
        }
      }
    });
    
    return JSON.parse(response.text || "{}");
  } catch (error: any) {
    throw new Error("Cognitive articulation failed.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 strategic questions to ask our AI for a ${context.persona} stakeholder at ${context.clientCompany} regarding ${context.meetingFocus}. Return as JSON array.`;
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

  const prompt = `Perform a high-fidelity cognitive sales intelligence analysis for: ${context.clientCompany}. 
  Meeting Context: ${context.meetingFocus}.
  Solution Domain: ${context.productDomain}.
  
  TASK: Synthesize the provided documents into a strategic weapon.
  
  --- GROUNDING DOCUMENTS --- 
  ${filesContent}`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: context.baseSystemPrompt || `You are a Cognitive AI Sales Strategist. Persona: ${context.persona}. Target Solution: ${context.targetProducts}.`,
        responseMimeType: "application/json",
        responseSchema,
        temperature: context.temperature,
        thinkingConfig: { thinkingBudget: THINKING_LEVEL_MAP[context.thinkingLevel] }
      },
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    throw new Error(`Intelligence Analysis Failed: ${error.message}`);
  }
}

// Fixed generateVideoStoryboard with VideoStoryboard type and responseSchema
export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Generate 3 distinct cinematic video concepts based on this sales analysis. Return JSON array.`;
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
          required: ["id", "title", "description", "angle", "veoPrompt"],
          propertyOrdering: ["id", "title", "description", "angle", "veoPrompt"],
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