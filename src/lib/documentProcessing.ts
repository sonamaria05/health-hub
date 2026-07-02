import { GlobalWorkerOptions, getDocument } from 'pdfjs-dist';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { buildManualReviewRecord, extractMedicalRecordFromText, type LocalExtractionResult } from './localMedicalExtraction';

GlobalWorkerOptions.workerSrc = pdfWorker;

interface ExtractionPayload {
  fileBase64: string;
  fileName: string;
  mimeType: string;
}

function stripDataUrlPrefix(dataUrl: string) {
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
    const viewport = page.getViewport({ scale: 1.5 });
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
      if (text.trim()) {
        return extractMedicalRecordFromText(text, file.name);
      }
      return buildManualReviewRecord(file.name, 'PDF uploaded successfully, but this file appears to be image-only. Review the extracted fields manually.');
    }

    if (file.type.startsWith('text/') || /\.(csv|txt|json)$/i.test(file.name)) {
      const text = await file.text();
      return extractMedicalRecordFromText(text, file.name);
    }

    if (file.type.startsWith('image/') || /\.(png|jpe?g|webp)$/i.test(file.name)) {
      return buildManualReviewRecord(file.name, 'Image uploaded successfully. If cloud OCR is unavailable, review the fields manually before saving.');
    }

    if (/\.(doc|docx)$/i.test(file.name)) {
      return buildManualReviewRecord(file.name, 'Word documents can be uploaded and stored, but automatic extraction may require cloud OCR. Review the fields manually before saving.');
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
