import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { generateBookBrief } from '../services/ai/book-brief.ts';
import { transcribeHandwrittenNote } from '../services/ai/ocr.ts';
import { extractPdfPagesWithAi } from '../services/ai/pdf-extraction.ts';

const router = Router();

const aiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  keyBuilder: (req) => `ai:${req.authUser?.id || req.ip || 'guest'}`,
  message: 'AI processing limit reached briefly. Please wait a moment and try again.',
});

/**
 * POST /api/ai/ocr
 * Transcribes handwritten notes/canvas snapshots using Gemini API.
 */
router.post('/ocr', aiLimiter, async (req: Request, res: Response) => {
  try {
    const imageDataUrl = typeof req.body?.imageDataUrl === 'string' ? req.body.imageDataUrl : '';
    const pageTitle = typeof req.body?.pageTitle === 'string' ? req.body.pageTitle : undefined;
    const typedContext = typeof req.body?.typedContext === 'string' ? req.body.typedContext : undefined;

    if (!imageDataUrl) {
      res.status(400).json({ error: 'An image is required for handwriting OCR.' });
      return;
    }

    const result = await transcribeHandwrittenNote({
      imageDataUrl,
      pageTitle,
      typedContext,
    });

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Handwriting transcription failed.';
    const isValidation = /must be|too large|valid|required/i.test(message);
    res.status(isValidation ? 400 : 502).json({ error: message });
  }
});

/**
 * POST /api/ai/pdf-extract
 * Cleans embedded PDF text or OCRs rendered scanned PDF pages into readable book chapters/pages.
 */
router.post('/pdf-extract', aiLimiter, async (req: Request, res: Response) => {
  try {
    const titleHint = typeof req.body?.titleHint === 'string' ? req.body.titleHint : undefined;
    const pages = Array.isArray(req.body?.pages) ? req.body.pages : [];

    if (pages.length === 0) {
      res.status(400).json({ error: 'At least one PDF page is required.' });
      return;
    }

    const result = await extractPdfPagesWithAi({
      titleHint,
      pages,
    });

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'PDF text extraction failed.';
    const isValidation = /must have|at most|at least|invalid|oversized/i.test(message);
    res.status(isValidation ? 400 : 502).json({ error: message });
  }
});

/**
 * POST /api/ai/book-brief
 * Generates an editorial AI brief and theme tags for an imported Reader book.
 */
router.post('/book-brief', aiLimiter, async (req: Request, res: Response) => {
  try {
    const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
    const author = typeof req.body?.author === 'string' ? req.body.author.trim() : undefined;
    const totalPages =
      typeof req.body?.totalPages === 'number' && Number.isFinite(req.body.totalPages)
        ? req.body.totalPages
        : undefined;
    const chapterTitles = Array.isArray(req.body?.chapterTitles)
      ? req.body.chapterTitles.filter((c: unknown): c is string => typeof c === 'string')
      : undefined;
    const excerpt = typeof req.body?.excerpt === 'string' ? req.body.excerpt.trim() : '';

    if (!title || !excerpt) {
      res.status(400).json({ error: 'Book title and text excerpt are required.' });
      return;
    }

    const result = await generateBookBrief({
      title,
      author,
      totalPages,
      chapterTitles,
      excerpt,
    });

    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Could not generate AI book brief.';
    const isValidation = /required/i.test(message);
    res.status(isValidation ? 400 : 502).json({ error: message });
  }
});

export default router;
