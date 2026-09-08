import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { config } from '../config';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function getModel(): GenerativeModel {
  if (!model) {
    genAI = new GoogleGenerativeAI(config.geminiApiKey);
    model = genAI.getGenerativeModel({ model: 'gemini-3.5-flash' });
  }
  return model;
}

/**
 * Send a prompt to Gemini and get a structured JSON response.
 * The prompt should instruct the model to return valid JSON.
 */
export async function geminiJSON<T>(prompt: string): Promise<T> {
  const m = getModel();
  const result = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      temperature: 0.1,
    },
  });

  const text = result.response.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    // Sometimes the model wraps JSON in markdown code blocks
    const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[1].trim()) as T;
    }
    throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 200)}`);
  }
}

/**
 * Send a prompt to Gemini and get a plain text response.
 */
export async function geminiText(prompt: string): Promise<string> {
  const m = getModel();
  const result = await m.generateContent({
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: 0.3,
    },
  });
  return result.response.text();
}
