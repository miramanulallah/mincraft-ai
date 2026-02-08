
import { GoogleGenAI, GenerateContentResponse } from "@google/genai";

const API_KEY = process.env.API_KEY || "";

export class MinecraftAIService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY });
  }

  async generateResponse(prompt: string, history: { role: string; content: string }[]) {
    try {
      const contents = [
        ...history.map(h => ({
          role: h.role === 'user' ? 'user' : 'model',
          parts: [{ text: h.content }]
        })),
        { role: 'user', parts: [{ text: prompt }] }
      ];

      const response = await this.ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: contents as any,
        config: {
          systemInstruction: `You are "Minecraft AI", a helpful and adventurous companion. 
          Your tone is enthusiastic, blocky, and knowledgeable about all things Minecraft.
          
          CRITICAL LANGUAGE RULE: 
          If the user speaks or types in Hindi (Devanagari or Romanized), you MUST respond in Hindi but using ENGLISH LETTERS (Romanized Hindi/Hinglish). 
          Example: Instead of "मैं ठीक हूँ", say "Main theek hoon". 
          Always keep the Minecraft theme. Use emojis like ⛏️, 💎, 🧱.
          If the user speaks English, respond in English with Minecraft flair.`,
          temperature: 0.8,
          topP: 0.9,
          maxOutputTokens: 500,
        },
      });

      return response.text;
    } catch (error) {
      console.error("Gemini API Error:", error);
      return "Oof! Connection lost. Check your redstone! 🧨";
    }
  }
}

export const minecraftAI = new MinecraftAIService();
