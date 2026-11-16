import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { getLiveNewsFeed } from '../services/news/feedService.ts';
import { rewriteSingleStoryForVoice } from '../services/news/summarizer.ts';
import { normalizeCountryCode, type WritingStyle } from '../services/news/types.ts';

const router = Router();

const VALID_VOICES = new Set<WritingStyle>(['brief', 'explainer', 'witty', 'plain']);

function parseVoice(raw: unknown): WritingStyle {
  return typeof raw === 'string' && VALID_VOICES.has(raw as WritingStyle)
    ? (raw as WritingStyle)
    : 'brief';
}

const newsFeedLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 40,
  keyBuilder: (req) => `news-feed:${req.ip || 'local'}`,
  message: 'Too many edition refreshes briefly. Please wait a moment.',
});

const newsAiLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 35,
  keyBuilder: (req) => `news-ai:${req.ip || 'local'}`,
  message: 'AI rewriting limit reached briefly. Please try again in a moment.',
});

/**
 * GET /api/news/feed?country=us&voice=brief|explainer|witty|plain&refresh=1
 * Fetches live country-scoped stories and rewrites them via OpenRouter in the user's selected Voice.
 */
router.get('/feed', newsFeedLimiter, async (req: Request, res: Response) => {
  try {
    const forceRefresh = req.query.refresh === '1' || req.query.refresh === 'true';
    const voice = parseVoice(req.query.voice);
    const country = normalizeCountryCode(req.query.country);
    const bundle = await getLiveNewsFeed({ forceRefresh, voice, country });
    res.status(200).json(bundle);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to assemble live news edition.';
    res.status(502).json({ error: message });
  }
});

/**
 * POST /api/news/summarize
 * Rewrites an individual story (both card summary and full article prose) in the user's chosen Voice.
 */
router.post('/summarize', newsAiLimiter, async (req: Request, res: Response) => {
  try {
    const id = typeof req.body?.id === 'string' ? req.body.id.slice(0, 100) : '';
    const headline = typeof req.body?.headline === 'string' ? req.body.headline.trim().slice(0, 300) : '';
    const source = typeof req.body?.source === 'string' ? req.body.source.trim().slice(0, 120) : 'Wire';
    const topic = typeof req.body?.topic === 'string' ? req.body.topic.trim().slice(0, 40) : 'Top Story';
    const snippet = typeof req.body?.snippet === 'string' ? req.body.snippet.trim().slice(0, 2000) : '';
    const originalUrl = typeof req.body?.originalUrl === 'string' ? req.body.originalUrl.trim().slice(0, 1000) : '';
    const voice = parseVoice(req.body?.voice);

    if (!id || !headline) {
      res.status(400).json({ error: 'Story id and headline are required.' });
      return;
    }

    const result = await rewriteSingleStoryForVoice({
      id,
      topic,
      source,
      headline,
      snippet,
      originalUrl,
      voice,
    });
    res.status(200).json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to rewrite story with AI.';
    res.status(502).json({ error: message });
  }
});

export default router;
