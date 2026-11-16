import { randomUUID } from 'node:crypto';
import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../middleware/rateLimit.ts';
import { requireAuth } from '../middleware/requireAuth.ts';
import { createStatelessPublicClient, getSupabaseAdmin } from '../services/supabase/admin.ts';

const router = Router();

const USERNAME_REGEX = /^[a-z0-9_]{3,24}$/;
const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_AVATAR_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

const loginLimiter = createRateLimiter({
  windowMs: 10 * 60 * 1000,
  maxRequests: 15,
  keyBuilder: (req) => {
    const raw = typeof req.body?.username === 'string' ? req.body.username.trim().toLowerCase() : '';
    return `login:${raw.slice(0, 24)}`;
  },
  message: 'Too many sign-in attempts. Please wait a few minutes and try again.',
});

const registerLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  maxRequests: 10,
  keyBuilder: () => 'register',
  message: 'Too many registration attempts. Please try again shortly.',
});

const profileLimiter = createRateLimiter({
  windowMs: 5 * 60 * 1000,
  maxRequests: 30,
  keyBuilder: (req) => `profile:${req.authUser?.id || 'anon'}`,
});

interface ParsedAvatar {
  buffer: Buffer;
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp';
  ext: 'png' | 'jpg' | 'webp';
}

function detectImageMimeFromBytes(buf: Buffer): 'image/png' | 'image/jpeg' | 'image/webp' | null {
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return 'image/png';
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return 'image/jpeg';
  }
  if (
    buf.length >= 12 &&
    buf.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buf.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  return null;
}

function parseAvatarDataUrl(rawDataUrl: unknown): ParsedAvatar | null {
  if (typeof rawDataUrl !== 'string' || !rawDataUrl.trim()) {
    return null;
  }

  const match = rawDataUrl.trim().match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error('Profile photo must be a PNG, JPEG, or WebP image.');
  }

  const declaredMime = match[1];
  if (!ALLOWED_AVATAR_MIME.has(declaredMime)) {
    throw new Error('Profile photo must be a PNG, JPEG, or WebP image.');
  }

  const buffer = Buffer.from(match[2], 'base64');
  if (buffer.length === 0 || buffer.length > MAX_AVATAR_BYTES) {
    throw new Error('Profile photo must be 2 MB or smaller.');
  }

  const detected = detectImageMimeFromBytes(buffer);
  if (!detected || detected !== declaredMime) {
    throw new Error('Invalid image file contents.');
  }

  const ext = detected === 'image/png' ? 'png' : detected === 'image/jpeg' ? 'jpg' : 'webp';
  return { buffer, mimeType: detected, ext };
}

function normalizeUsername(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

function normalizeDisplayName(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().replace(/\s+/g, ' ') : '';
}

async function minimumFailureDelay(startedAt: number, targetMs = 180): Promise<void> {
  const elapsed = Date.now() - startedAt;
  if (elapsed < targetMs) {
    await new Promise((resolve) => setTimeout(resolve, targetMs - elapsed));
  }
}

interface ProfileRow {
  id: string;
  username: string;
  display_name: string;
  avatar_path: string | null;
  created_at: string;
  updated_at: string;
}

async function buildClientProfile(row: ProfileRow) {
  let avatarUrl: string | null = null;
  if (row.avatar_path) {
    const admin = getSupabaseAdmin();
    const { data: signed } = await admin.storage
      .from('avatars')
      .createSignedUrl(row.avatar_path, 3600);
    avatarUrl = signed?.signedUrl || null;
  }

  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * POST /api/auth/register
 * Registers an account using ONLY username, displayName (or name), password, and optional avatarDataUrl.
 */
router.post('/register', registerLimiter, async (req: Request, res: Response) => {
  try {
    const username = normalizeUsername(req.body?.username);
    const displayName = normalizeDisplayName(req.body?.name ?? req.body?.displayName);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!USERNAME_REGEX.test(username)) {
      res.status(400).json({
        error: 'Username must be 3 to 24 characters using lowercase letters, numbers, or underscores.',
      });
      return;
    }

    if (displayName.length < 1 || displayName.length > 60) {
      res.status(400).json({ error: 'Name must be between 1 and 60 characters.' });
      return;
    }

    if (password.length < 8 || password.length > 128) {
      res.status(400).json({ error: 'Password must be between 8 and 128 characters.' });
      return;
    }

    let parsedAvatar: ParsedAvatar | null = null;
    try {
      parsedAvatar = parseAvatarDataUrl(req.body?.avatarDataUrl);
    } catch (avatarErr) {
      res.status(400).json({ error: (avatarErr as Error).message });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: existingRows, error: lookupError } = await admin.rpc('resolve_username_identity', {
      p_username: username,
    });
    if (lookupError) {
      res.status(500).json({ error: 'Could not verify username availability.' });
      return;
    }
    if (Array.isArray(existingRows) && existingRows.length > 0) {
      res.status(409).json({ error: 'That username is already taken.' });
      return;
    }

    const internalEmail = `u_${randomUUID().replace(/-/g, '')}@users.paperandink.local`;
    const { data: createdUser, error: createError } = await admin.auth.admin.createUser({
      email: internalEmail,
      password,
      email_confirm: true,
      user_metadata: {
        username,
        display_name: displayName,
      },
    });

    if (createError || !createdUser.user) {
      res.status(500).json({ error: 'Could not create account. Please try again.' });
      return;
    }

    const userId = createdUser.user.id;
    const { error: mapError } = await admin.rpc('register_username_identity', {
      p_user_id: userId,
      p_username: username,
      p_internal_email: internalEmail,
      p_display_name: displayName,
    });

    if (mapError) {
      await admin.auth.admin.deleteUser(userId);
      const isDuplicate = mapError.code === '23505' || /duplicate/i.test(mapError.message);
      res.status(isDuplicate ? 409 : 500).json({
        error: isDuplicate ? 'That username is already taken.' : 'Could not complete registration.',
      });
      return;
    }

    if (parsedAvatar) {
      const storagePath = `${userId}/avatar.${parsedAvatar.ext}`;
      const { error: uploadError } = await admin.storage
        .from('avatars')
        .upload(storagePath, parsedAvatar.buffer, {
          contentType: parsedAvatar.mimeType,
          upsert: true,
        });

      if (!uploadError) {
        await admin.from('profiles').update({ avatar_path: storagePath }).eq('id', userId);
      }
    }

    const publicClient = createStatelessPublicClient();
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: internalEmail,
      password,
    });

    if (signInError || !signInData.session) {
      res.status(500).json({ error: 'Account created, but automatic sign-in failed. Please sign in.' });
      return;
    }

    const { data: profileRow, error: profileError } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_path, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (profileError || !profileRow) {
      res.status(500).json({ error: 'Could not load created profile.' });
      return;
    }

    res.status(201).json({
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_in: signInData.session.expires_in,
        expires_at: signInData.session.expires_at,
        token_type: signInData.session.token_type,
      },
      profile: await buildClientProfile(profileRow as ProfileRow),
    });
  } catch {
    res.status(500).json({ error: 'Unexpected registration error.' });
  }
});

/**
 * POST /api/auth/login
 * Resolves username server-side and returns identical generic failure on bad credentials
 * to prevent username enumeration.
 */
router.post('/login', loginLimiter, async (req: Request, res: Response) => {
  const startedAt = Date.now();
  try {
    const username = normalizeUsername(req.body?.username);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';

    if (!USERNAME_REGEX.test(username) || !password || password.length > 128) {
      await minimumFailureDelay(startedAt);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const admin = getSupabaseAdmin();
    const { data: identityRows, error: resolveError } = await admin.rpc('resolve_username_identity', {
      p_username: username,
    });

    if (resolveError || !Array.isArray(identityRows) || identityRows.length === 0) {
      await minimumFailureDelay(startedAt);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const identity = identityRows[0] as { user_id: string; internal_email: string };
    const publicClient = createStatelessPublicClient();
    const { data: signInData, error: signInError } = await publicClient.auth.signInWithPassword({
      email: identity.internal_email,
      password,
    });

    if (signInError || !signInData.session) {
      await minimumFailureDelay(startedAt);
      res.status(401).json({ error: 'Invalid username or password.' });
      return;
    }

    const { data: profileRow, error: profileError } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_path, created_at, updated_at')
      .eq('id', identity.user_id)
      .single();

    if (profileError || !profileRow) {
      res.status(500).json({ error: 'Could not load profile.' });
      return;
    }

    res.status(200).json({
      session: {
        access_token: signInData.session.access_token,
        refresh_token: signInData.session.refresh_token,
        expires_in: signInData.session.expires_in,
        expires_at: signInData.session.expires_at,
        token_type: signInData.session.token_type,
      },
      profile: await buildClientProfile(profileRow as ProfileRow),
    });
  } catch {
    await minimumFailureDelay(startedAt);
    res.status(401).json({ error: 'Invalid username or password.' });
  }
});

/**
 * GET /api/auth/me
 * Returns verified profile metadata and a short-lived signed avatar URL.
 */
router.get('/me', requireAuth, profileLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.id;
    const admin = getSupabaseAdmin();
    const { data: profileRow, error } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_path, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (error || !profileRow) {
      res.status(404).json({ error: 'Profile not found.' });
      return;
    }

    res.status(200).json({
      profile: await buildClientProfile(profileRow as ProfileRow),
    });
  } catch {
    res.status(500).json({ error: 'Could not load profile.' });
  }
});

/**
 * PATCH /api/auth/profile
 * Updates display name and/or profile avatar for the authenticated user.
 */
router.patch('/profile', requireAuth, profileLimiter, async (req: Request, res: Response) => {
  try {
    const userId = req.authUser!.id;
    const admin = getSupabaseAdmin();
    const updates: Record<string, string | null> = {};

    if (req.body?.name !== undefined || req.body?.displayName !== undefined) {
      const displayName = normalizeDisplayName(req.body?.name ?? req.body?.displayName);
      if (displayName.length < 1 || displayName.length > 60) {
        res.status(400).json({ error: 'Name must be between 1 and 60 characters.' });
        return;
      }
      updates.display_name = displayName;
      await admin.auth.admin.updateUserById(userId, {
        user_metadata: {
          username: req.authUser?.username,
          display_name: displayName,
        },
      });
    }

    if (req.body?.removeAvatar === true) {
      const { data: existing } = await admin
        .from('profiles')
        .select('avatar_path')
        .eq('id', userId)
        .single();
      if (existing?.avatar_path) {
        await admin.storage.from('avatars').remove([existing.avatar_path]);
      }
      updates.avatar_path = null;
    } else if (req.body?.avatarDataUrl) {
      let parsedAvatar: ParsedAvatar | null = null;
      try {
        parsedAvatar = parseAvatarDataUrl(req.body.avatarDataUrl);
      } catch (avatarErr) {
        res.status(400).json({ error: (avatarErr as Error).message });
        return;
      }
      if (parsedAvatar) {
        const storagePath = `${userId}/avatar.${parsedAvatar.ext}`;
        const { error: uploadError } = await admin.storage
          .from('avatars')
          .upload(storagePath, parsedAvatar.buffer, {
            contentType: parsedAvatar.mimeType,
            upsert: true,
          });
        if (uploadError) {
          res.status(500).json({ error: 'Could not store profile photo.' });
          return;
        }
        updates.avatar_path = storagePath;
      }
    }

    if (Object.keys(updates).length > 0) {
      const { error: updateError } = await admin.from('profiles').update(updates).eq('id', userId);
      if (updateError) {
        res.status(500).json({ error: 'Could not update profile.' });
        return;
      }
    }

    const { data: refreshed, error: fetchError } = await admin
      .from('profiles')
      .select('id, username, display_name, avatar_path, created_at, updated_at')
      .eq('id', userId)
      .single();

    if (fetchError || !refreshed) {
      res.status(500).json({ error: 'Could not reload profile.' });
      return;
    }

    res.status(200).json({
      profile: await buildClientProfile(refreshed as ProfileRow),
    });
  } catch {
    res.status(500).json({ error: 'Unexpected profile update error.' });
  }
});

export default router;
