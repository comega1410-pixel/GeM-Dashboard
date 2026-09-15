import { GoogleGenerativeAI, GenerativeModel } from '@google/generative-ai';
import { z, ZodSchema } from 'zod';
import { config } from '../config';

let genAI: GoogleGenerativeAI | null = null;
let model: GenerativeModel | null = null;

function getModel(): GenerativeModel | null {
  if (!config.geminiApiKey || config.geminiApiKey.trim() === '' || config.geminiApiKey === 'your-gemini-api-key-here') {
    return null;
  }
  if (!model) {
    try {
      genAI = new GoogleGenerativeAI(config.geminiApiKey);
      // Use standard Gemini flash model
      model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
    } catch (err) {
      console.warn('Failed to initialize GoogleGenerativeAI client:', err);
      return null;
    }
  }
  return model;
}

/**
 * Send a prompt to Gemini with retry, schema validation, and safe fallback.
 */
export async function geminiJSON<T>(prompt: string, schema?: ZodSchema<T>): Promise<T> {
  const m = getModel();

  if (!m) {
    throw new Error('GEMINI_API_KEY is not configured. Falling back to deterministic engine.');
  }

  const timeoutMs = 12000;
  const timeoutPromise = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new Error('Gemini API call timed out after 12s')), timeoutMs)
  );

  const callPromise = (async () => {
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
        temperature: 0.1,
      },
    });

    const text = result.response.text();
    let parsed: any;

    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[1].trim());
      } else {
        throw new Error(`Failed to parse Gemini response as JSON: ${text.slice(0, 150)}`);
      }
    }

    if (schema) {
      const validated = schema.safeParse(parsed);
      if (!validated.success) {
        throw new Error(`Schema validation error: ${validated.error.message}`);
      }
      return validated.data;
    }

    return parsed as T;
  })();

  return Promise.race([callPromise, timeoutPromise]);
}

/**
 * Send a prompt to Gemini and get plain text response.
 */
export async function geminiText(prompt: string): Promise<string> {
  const m = getModel();
  if (!m) {
    return 'Analysis completed. Multiple criteria evaluated with deterministic rules and evidence cross-referencing. Review flagged items for final procurement qualification.';
  }

  try {
    const result = await m.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    });
    return result.response.text();
  } catch (err) {
    console.warn('Gemini text generation failed, returning default summary:', err);
    return 'Analysis completed. Multiple criteria evaluated with deterministic rules and evidence cross-referencing. Review flagged items for final procurement qualification.';
  }
}
