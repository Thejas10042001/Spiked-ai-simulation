
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

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
            TRANSCRIPTION OBJECTIVE:
            1. EXTRACT ALL text from this image with 100% fidelity.
            2. LAYOUT: Maintain the structural hierarchy of the document.
            3. TABLES: Reconstruct into clean Markdown tables.
            4. ZERO COMMENTARY: Output only the extracted text.` 
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
  citations: { snippet: string; source: string }[];
  reasoningChain: {
    painPoint: string;
    capability: string;
    strategicValue: string;
  };
}

export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-pro-preview';
  
  const prompt = `MEETING DETAILS:
  Seller: ${context.sellerNames} at ${context.sellerCompany}
  Client: ${context.clientNames} at ${context.clientCompany}
  Focus: ${context.meetingFocus}
  Strategic Keywords: ${context.strategicKeywords.join(', ')}

  TASK: Perform a HIGH-FIDELITY SALES STRATEGY analysis to answer the following question using the source documents.
  
  REQUIRED OUTPUT STRUCTURE:
  1. **EXECUTIVE OVERVIEW**: A high-impact summary of the strategic alignment.
  2. **THE PROBLEM SPACE**: Use *Italicized Subheadings* to identify specific pain points from the docs.
  3. **THE STRATEGIC SOLUTION**: Map organization capabilities directly to those pain points.
  4. **DETAILED SALES JUSTIFICATION**: Provide a deep, logical explanation of *why* this approach works, focusing on ROI, risk mitigation, and long-term value.
  
  FORMATTING RULES:
  - Use **BOLD UPPERCASE** for major section headers (e.g., **EXECUTIVE OVERVIEW**).
  - Use *Italicized Text* for sub-points or to provide nuanced context.
  - Use **Bold** for critical keywords, metrics, or key takeaways.
  - Ensure the explanation is highly detailed and grounded in the provided files.

  QUESTION: ${question}
  
  --- SOURCE DOCUMENTS ---
  ${filesContent || "No documents uploaded yet."}
  
  Return your response ONLY as a JSON object with:
  - "answer": The detailed, beautifully formatted Markdown response.
  - "citations": Array of { "snippet": string, "source": string }.
  - "reasoningChain": { "painPoint": string, "capability": string, "strategicValue": string }`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a Cognitive AI Sales Intelligence & Conversation Strategy Agent. ${context.baseSystemPrompt}. You communicate with precision, authority, and deep logical justification. Your goal is to win high-stakes enterprise deals through documentary evidence.`,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            answer: { type: Type.STRING },
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
          required: ["answer", "citations", "reasoningChain"]
        }
      }
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    return JSON.parse(text);
  } catch (error: any) {
    console.error("Cognitive search failed:", error);
    throw new Error("Could not retrieve a grounded answer.");
  }
}

export async function generateDynamicSuggestions(filesContent: string, context: MeetingContext): Promise<string[]> {
  const modelName = 'gemini-3-flash-preview';
  const prompt = `Suggest 3 highly strategic sales questions for this context:
  Seller: ${context.sellerCompany} (Product: ${context.targetProducts})
  Client: ${context.clientCompany}
  Meeting Focus: ${context.meetingFocus}
  
  Return ONLY a JSON array of 3 strings.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [
      `What are the top 3 deal risks for ${context.clientCompany}?`,
      `How does ${context.targetProducts} map to their stated growth priorities?`,
      `What technical objections should I anticipate?`
    ];
  }
}

export interface VideoStoryboard {
  id: string;
  title: string;
  angle: string;
  description: string;
  veoPrompt: string;
}

export async function generateVideoStoryboard(analysis: AnalysisResult): Promise<VideoStoryboard[]> {
  const modelName = 'gemini-3-pro-preview';
  const prompt = `Create 3 distinct 10-second video concepts for: ${analysis.snapshot.role}. Tone: ${analysis.snapshot.tone}.`;
  try {
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
              angle: { type: Type.STRING },
              description: { type: Type.STRING },
              veoPrompt: { type: Type.STRING }
            },
            required: ["id", "title", "angle", "description", "veoPrompt"]
          }
        }
      }
    });
    return JSON.parse(response.text || "[]");
  } catch (error) {
    return [];
  }
}

export async function startVideoGeneration(prompt: string, aspectRatio: '16:9' | '9:16') {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await dynamicAi.models.generateVideos({
    model: 'veo-3.1-fast-generate-preview',
    prompt: prompt,
    config: {
      numberOfVideos: 1,
      resolution: '720p',
      aspectRatio: aspectRatio
    }
  });
}

export async function getVideoStatus(operationId: any) {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  return await dynamicAi.operations.getVideosOperation({ operation: operationId });
}

export function decode(base64: string) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) bytes[i] = binaryString.charCodeAt(i);
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
  const prompt = `Based on this analysis: ${JSON.stringify(context, null, 2)}\nAnswer: "${question}"`;
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: { systemInstruction: "You are a senior sales consultant." }
    });
    return response.text || "";
  } catch (error) {
    return "";
  }
}

export async function generatePitchAudio(text: string, voiceName: string = 'Kore'): Promise<Uint8Array | null> {
  const dynamicAi = new GoogleGenAI({ apiKey: process.env.API_KEY });
  try {
    const response = await dynamicAi.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: voiceName } } },
      },
    });
    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    return decode(base64Audio);
  } catch (error) {
    return null;
  }
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
          roleConfidence: { type: Type.NUMBER },
          priorities: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          likelyObjections: { type: Type.ARRAY, items: { type: Type.OBJECT, properties: { text: { type: Type.STRING }, citation: citationSchema }, required: ["text", "citation"] } },
          decisionStyle: { type: Type.STRING },
          decisionStyleCitation: citationSchema,
          decisionStyleConfidence: { type: Type.NUMBER },
          riskTolerance: { type: Type.STRING },
          riskToleranceCitation: citationSchema,
          riskToleranceConfidence: { type: Type.NUMBER },
          tone: { type: Type.STRING },
        },
        required: ["role", "roleCitation", "roleConfidence", "priorities", "likelyObjections", "decisionStyle", "decisionStyleCitation", "decisionStyleConfidence", "riskTolerance", "riskToleranceCitation", "riskToleranceConfidence", "tone"],
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
    required: ["snapshot", "documentInsights", "openingLines", "predictedQuestions", "strategicQuestionsToAsk", "objectionHandling", "toneGuidance", "finalCoaching"]
  };

  const prompt = `ACT AS: Cognitive AI Sales Intelligence Agent.
  
  CONTEXT:
  Target Client: ${context.clientCompany}
  Meeting Goal: ${context.meetingFocus}
  Product: ${context.targetProducts}

  --- SOURCE DOCUMENTS ---
  ${filesContent}
  
  Return analysis as JSON. Ground every strategic point in documentary evidence.`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `You are a world-class sales analyst. Ground everything in documentary proof.`,
        responseMimeType: "application/json",
        responseSchema,
        thinkingConfig: { thinkingBudget: 12000 }
      },
    });
    
    let text = response.text || "{}";
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) text = jsonMatch[0];
    
    return JSON.parse(text) as AnalysisResult;
  } catch (error: any) {
    throw new Error(`Analysis Failed: ${error.message}`);
  }
}
