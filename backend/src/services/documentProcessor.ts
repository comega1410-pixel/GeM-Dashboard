import fs from 'fs';
import path from 'path';
// @ts-ignore - pdf-parse v2 exports PDFParse
import { PDFParse } from 'pdf-parse';

export interface ParsedPage {
  pageNumber: number;
  text: string;
}

export interface ParsedDocument {
  totalPages: number;
  fullText: string;
  pages: ParsedPage[];
  ocrUsed: boolean;
}

/**
 * Extract text from a PDF file.
 * Uses pdf-parse for text-based PDFs.
 * Falls back to basic extraction if OCR would be needed.
 */
export async function extractTextFromPDF(filePath: string): Promise<ParsedDocument> {
  const absolutePath = path.resolve(filePath);
  const dataBuffer = fs.readFileSync(absolutePath);

  try {
    const parser = new (PDFParse as any)({ data: dataBuffer });
    const data = await parser.getText();

    const fullText = data.text || '';
    const totalPages = data.total || data.pages?.length || 1;

    // Use native page breakdown if available, else fallback to splitIntoPages
    let pages: ParsedPage[] = [];
    if (Array.isArray(data.pages) && data.pages.length > 0) {
      pages = data.pages.map((p: any, idx: number) => ({
        pageNumber: typeof p.num === 'number' ? p.num : idx + 1,
        text: (p.text || '').trim(),
      }));
    } else {
      pages = splitIntoPages(fullText, totalPages);
    }

    const ocrUsed = fullText.trim().length < 50; // If very little text, might need OCR

    return {
      totalPages,
      fullText,
      pages,
      ocrUsed,
    };
  } catch (error) {
    console.error('PDF parsing error:', error);
    return {
      totalPages: 0,
      fullText: '',
      pages: [],
      ocrUsed: false,
    };
  }
}

function splitIntoPages(text: string, numPages: number): ParsedPage[] {
  // Try splitting by form feed character first
  const formFeedSplit = text.split('\f');

  if (formFeedSplit.length >= numPages) {
    return formFeedSplit.slice(0, numPages).map((pageText, i) => ({
      pageNumber: i + 1,
      text: pageText.trim(),
    }));
  }

  // If no form feeds, split text evenly
  if (numPages <= 1) {
    return [{ pageNumber: 1, text: text.trim() }];
  }

  const avgCharsPerPage = Math.ceil(text.length / numPages);
  const pages: ParsedPage[] = [];

  for (let i = 0; i < numPages; i++) {
    const start = i * avgCharsPerPage;
    const end = Math.min(start + avgCharsPerPage, text.length);
    pages.push({
      pageNumber: i + 1,
      text: text.slice(start, end).trim(),
    });
  }

  return pages;
}
