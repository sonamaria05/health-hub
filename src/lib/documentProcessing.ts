import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { buildManualReviewRecord, extractMedicalRecordFromText, type LocalExtractionResult } from './localMedicalExtraction';
import { createWorker } from 'tesseract.js';
import { extractWithGeminiVision } from './geminiVisionExtraction';
import { preprocessImage } from './preprocessImage';
import { canonicalizeMedicalTerms } from './fuzzyMatch';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface ExtractionPayload {
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

function stripDataUrlPrefix(dataUrl: string) {
  if (dataUrl.includes(';base64,')) {
    return dataUrl.split(';base64,')[1];
  }
  return dataUrl.replace(/^data:[^;]+;base64,/, '');
}

async function fileToBase64(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        reject(new Error('Could not read the selected file.'));
        return;
      }

      resolve(stripDataUrlPrefix(reader.result));
    };
    reader.onerror = () => reject(reader.error ?? new Error('Could not read the selected file.'));
    reader.readAsDataURL(file);
  });
}

async function renderPdfToBase64(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pagesToRender = Math.min(pdf.numPages, 3);
  const renderedPages: HTMLCanvasElement[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRender; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const originalViewport = page.getViewport({ scale: 1 });
    const desiredLongSide = 2000; // pixels (~300 DPI for A4)
    const currentLongSide = Math.max(originalViewport.width, originalViewport.height);
    const scaleFactor = Math.max(desiredLongSide / currentLongSide, 1.5);
    const viewport = page.getViewport({ scale: scaleFactor });
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');

    if (!context) {
      throw new Error('Canvas rendering is not available in this browser.');
    }

    canvas.width = Math.ceil(viewport.width);
    canvas.height = Math.ceil(viewport.height);

    await page.render({ canvasContext: context, viewport }).promise;
    renderedPages.push(canvas);
  }

  const maxWidth = Math.max(...renderedPages.map(canvas => canvas.width));
  const totalHeight = renderedPages.reduce((sum, canvas) => sum + canvas.height, 0);
  const mergedCanvas = document.createElement('canvas');
  const mergedContext = mergedCanvas.getContext('2d');

  if (!mergedContext) {
    throw new Error('Canvas rendering is not available in this browser.');
  }

  mergedCanvas.width = maxWidth;
  mergedCanvas.height = totalHeight;
  mergedContext.fillStyle = '#ffffff';
  mergedContext.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height);

  let offsetY = 0;
  for (const canvas of renderedPages) {
    mergedContext.drawImage(canvas, 0, offsetY);
    offsetY += canvas.height;
  }

  return stripDataUrlPrefix(mergedCanvas.toDataURL('image/png', 0.92));
}

async function extractPdfText(file: File) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await getDocument({ data: arrayBuffer }).promise;
  const pagesToRead = Math.min(pdf.numPages, 10);
  const pageTexts: string[] = [];

  for (let pageNumber = 1; pageNumber <= pagesToRead; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ('str' in item ? item.str : ''))
      .join(' ')
      .trim();
    pageTexts.push(pageText);
  }

  return pageTexts.join('\n');
}

export interface OcrResult {
  text: string;
  /** Average word-level confidence, 0–1. */
  confidence: number;
}

export async function performOcrOnImage(
  imageSource: File | Blob | HTMLCanvasElement | string
): Promise<OcrResult> {
  try {
    let target: string | File | Blob = imageSource as string | File | Blob;
    if (typeof HTMLCanvasElement !== 'undefined' && imageSource instanceof HTMLCanvasElement) {
      target = imageSource.toDataURL('image/png');
    }

    const worker = await createWorker('eng');
    const result = await worker.recognize(target);
    await worker.terminate();

    // Compute average word-level confidence (tesseract.js exposes result.data.words)
    const words = result.data.words ?? [];
    const avgConf = words.length > 0
      ? words.reduce((sum: number, w: { confidence: number }) => sum + w.confidence, 0) / words.length / 100
      : 0;

    return {
      text: result.data.text || '',
      confidence: parseFloat(avgConf.toFixed(3)),
    };
  } catch (err) {
    console.error('OCR processing error:', err);
    return { text: '', confidence: 0 };
  }
}

export async function extractMedicalRecordWithAI(
  file: File,
  geminiApiKey?: string
): Promise<LocalExtractionResult> {
  const isImageOrPdf =
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    /\.(pdf|png|jpe?g|webp)$/i.test(file.name);

  if (geminiApiKey && isImageOrPdf) {
    try {
      // 1. Rasterize PDF / read image as base64
      const payload = await buildExtractionPayload(file);

      // 2. Preprocess: contrast-enhanced grayscale for Gemini, binarized for Tesseract
      const { enhanced, binarized } = await preprocessImage(payload.fileBase64);

      // 3. Run Tesseract on binarized image → get confidence score
      const { confidence: ocrConfidence } = await performOcrOnImage(
        `data:image/png;base64,${binarized}`
      );
      console.debug(`[extractMedicalRecordWithAI] Tesseract avg confidence: ${ocrConfidence}`);

      // FIX 3: preprocessImage always returns PNG canvas — always send image/png to Gemini
      const processedMime = 'image/png';

      // FIX 9: Combined single Gemini call — classify + extract in one request
      const rawRecord = await extractWithGeminiVision(
        enhanced,
        processedMime,   // ← always PNG after preprocessing
        geminiApiKey,
        undefined,       // docType: will be determined inside by combined prompt
        ocrConfidence
      );

      // 5. Fuzzy-match extracted term names against canonical dictionaries
      const { record, summary } = canonicalizeMedicalTerms(rawRecord);
      console.debug(
        `[fuzzyMatch] corrected: ${summary.corrected}, flagged: ${summary.flagged}`,
        summary.changes
      );

      return { record, source: 'local_parser' };
    } catch (err) {
      console.warn('Direct Gemini Vision extraction error, falling back to local OCR:', err);
    }
  }

  return extractMedicalRecordLocally(file);
}




export function canAttemptRemoteExtraction(file: File) {
  return (
    file.type === 'application/pdf' ||
    file.type.startsWith('image/') ||
    /\.(pdf|png|jpe?g|webp)$/i.test(file.name)
  );
}

export async function extractMedicalRecordLocally(file: File): Promise<LocalExtractionResult> {
  const lowerName = file.name.toLowerCase();

  try {
    if (file.type === 'application/pdf' || lowerName.endsWith('.pdf')) {
      const text = await extractPdfText(file);
      if (text.trim().length > 30) {
        return extractMedicalRecordFromText(text, file.name);
      }

      // If PDF has no digital text layer, run in-browser OCR on the rendered base64 canvas
      try {
        const base64Img = await renderPdfToBase64(file);
        // Preprocess: get binarized image for best Tesseract accuracy
        const { binarized } = await preprocessImage(base64Img);
        const { text: ocrText, confidence: ocrConf } = await performOcrOnImage(
          `data:image/png;base64,${binarized}`
        );
        console.debug(`[OCR] scanned-PDF confidence: ${ocrConf}`);
        if (ocrText.trim().length > 15) {
          return extractMedicalRecordFromText(ocrText, file.name);
        }
      } catch (ocrErr) {
        console.warn('Scanned PDF OCR fallback failed:', ocrErr);
      }

      return buildManualReviewRecord(file.name, 'Scanned PDF uploaded. Review or tweak the extracted fields before saving.');
    }

    if (file.type.startsWith('text/') || /\.(csv|txt|json)$/i.test(file.name)) {
      const text = await file.text();
      return extractMedicalRecordFromText(text, file.name);
    }

    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
      const { text: ocrText, confidence: ocrConf } = await performOcrOnImage(file);
      console.debug(`[OCR] image confidence: ${ocrConf}`);
      if (ocrText.trim().length > 15) {
        return extractMedicalRecordFromText(ocrText, file.name);
      }
      return buildManualReviewRecord(file.name, 'Image processed. Review the extracted fields manually before saving.');
    }

    if (/\.(doc|docx)$/i.test(file.name)) {
      return buildManualReviewRecord(file.name, 'Word documents can be uploaded and stored. Review the fields before saving.');
    }
  } catch (error) {
    console.error('Local extraction failed:', error);
  }

  return buildManualReviewRecord(file.name);
}

export async function buildExtractionPayload(file: File): Promise<ExtractionPayload> {
  const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);

  if (isPdf) {
    return {
      fileBase64: await renderPdfToBase64(file),
      fileName: file.name,
      mimeType: 'image/png',
    };
  }

  return {
    fileBase64: await fileToBase64(file),
    fileName: file.name,
    mimeType: file.type || 'image/png',
  };
}
