
import { GoogleGenAI, Type, Modality } from "@google/genai";
import { AnalysisResult, MeetingContext } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export async function performVisionOcr(base64Data: string, mimeType: string): Promise<string> {
  // Use gemini-3-flash-preview for basic text extraction tasks
  const modelName = 'gemini-3-flash-preview';
  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: {
        parts: [
          { inlineData: { data: base64Data, mimeType: mimeType } },
          { text: "Extract all text from this image exactly as written." },
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

/**
 * Performs complex reasoning to map client pain points to capabilities.
 * Upgraded to gemini-3-pro-preview for advanced reasoning.
 */
export async function performCognitiveSearch(question: string, filesContent: string, context: MeetingContext): Promise<CognitiveSearchResult> {
  const modelName = 'gemini-3-pro-preview';
  
  const prompt = `MEETING DETAILS:
  Seller: ${context.sellerNames} at ${context.sellerCompany}
  Client: ${context.clientNames} at ${context.clientCompany}
  Focus: ${context.meetingFocus}
  Strategic Keywords: ${context.strategicKeywords.join(', ')}
  Snapshot: ${context.executiveSnapshot}

  TASK: Perform COGNITIVE GROUNDING to answer the question using the source documents.
  REASONING STYLE: Map Client Pain Point (from KYC/docs) -> SpikedAI Capability -> Strategic Value.

  QUESTION: ${question}
  
  --- SOURCE DOCUMENTS ---
  ${filesContent || "No documents uploaded yet."}
  
  Return your response ONLY as a JSON object with:
  - "answer": A comprehensive response following the requested Answer Styles: ${context.answerStyles.join(', ')}.
  - "citations": Array of { "snippet": string, "source": string }.
  - "reasoningChain": { "painPoint": string, "capability": string, "strategicValue": string }`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction: `ACT AS: Avi from Spiked. ${context.baseSystemPrompt}`,
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
    throw new Error("Could not retrieve a grounded answer. Ensure documents are uploaded.");
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
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

export async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

export async function generateExplanation(question: string, context: AnalysisResult): Promise<string> {
  const prompt = `Based on the following sales analysis:
  ${JSON.stringify(context, null, 2)}
  
  Please answer this salesperson's question about the strategy: "${question}"
  Provide a concise, professional, and coaching-oriented explanation in about 2-3 sentences. Speak as a senior sales mentor.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
      config: {
        systemInstruction: "You are a senior sales consultant providing verbal coaching. Keep it brief and high-impact."
      }
    });
    return response.text || "I'm sorry, I couldn't formulate an explanation for that.";
  } catch (error) {
    console.error("Explanation generation failed:", error);
    return "I encountered an error while trying to analyze that specific question.";
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
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) return null;
    return decode(base64Audio);
  } catch (error) {
    console.error("Audio generation failed:", error);
    return null;
  }
}

/**
 * Performs core analysis of sales context and documents.
 * Upgraded to gemini-3-pro-preview for complex reasoning and synthesis.
 */
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

  const systemInstruction = `You are a Cognitive AI Sales Intelligence Agent. 
  PERSONA: ${context.persona}
  TARGET: ${context.clientNames} at ${context.clientCompany}
  ${context.baseSystemPrompt}
  
  Structure your entire response as a single valid JSON object adhering strictly to the provided schema. 
  Ensure all citations are derived from the source documents provided.`;

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
          structure: { type: Type.OBJECT, properties: { sections: { type: Type.ARRAY, items: { type: Type.STRING } }, keyHeadings: { type: Type.ARRAY, items: { type: Type.STRING } }, detectedTablesSummary: { type: Type.STRING } }, required: ["sections", "keyHeadings", "detectedTablesSummary"] }
        },
        required: ["entities", "structure"]
      },
      openingLines: { 
        type: Type.ARRAY, 
        minItems: 2,
        maxItems: 3,
        items: { 
          type: Type.OBJECT, 
          properties: { 
            text: { type: Type.STRING }, 
            label: { type: Type.STRING },
            citation: citationSchema 
          }, 
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

  const prompt = `Analyze these documents for ${context.clientCompany}. 
  Meeting Focus: ${context.meetingFocus}
  Strategic Context: ${context.executiveSnapshot}
  --- DOCUMENTS --- ${filesContent} --- END DOCUMENTS ---`;

  try {
    const response = await ai.models.generateContent({
      model: modelName,
      contents: prompt,
      config: {
        systemInstruction,
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
    if (error.message?.includes('429')) {
      throw new Error("Gemini API Rate Limit Reached. Please wait 60s.");
    }
    throw new Error(`Intelligence Analysis Failed: ${error.message}`);
  }
}
