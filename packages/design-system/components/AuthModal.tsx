import React, { useState } from 'react';
import { Camera, ShieldCheck, Trash2 } from 'lucide-react';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';

export interface SharedUserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
}

export interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  profile: SharedUserProfile | null;
  initialMode?: 'login' | 'register';
  onLogin: (input: { username: string; password: string }) => Promise<SharedUserProfile>;
  onRegister: (input: {
    username: string;
    name: string;
    password: string;
    avatarDataUrl?: string | null;
  }) => Promise<SharedUserProfile>;
  onUpdateProfile: (input: {
    name?: string;
    avatarDataUrl?: string | null;
    removeAvatar?: boolean;
  }) => Promise<SharedUserProfile>;
  onLogout: () => Promise<void>;
}

const MAX_PHOTO_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME = new Set(['image/png', 'image/jpeg', 'image/webp']);

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!ALLOWED_MIME.has(file.type)) {
      reject(new Error('Please choose a PNG, JPEG, or WebP image.'));
      return;
    }
    if (file.size > MAX_PHOTO_BYTES) {
      reject(new Error('Profile photo must be 2 MB or smaller.'));
      return;
    }
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Could not read the selected image file.'));
    reader.readAsDataURL(file);
  });
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  profile,
  initialMode = 'login',
  onLogin,
  onRegister,
  onUpdateProfile,
  onLogout,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(initialMode);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [avatarDataUrl, setAvatarDataUrl] = useState<string | null>(null);
  const [editName, setEditName] = useState(profile?.displayName || '');
  const [editAvatar, setEditAvatar] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (open) {
      setMode(initialMode);
      setError(null);
      setNotice(null);
      setEditName(profile?.displayName || '');
      setEditAvatar(null);
      setRemoveAvatar(false);
    }
  }, [open, initialMode, profile?.displayName]);

  const handlePhotoSelect = async (
    event: React.ChangeEvent<HTMLInputElement>,
    target: 'register' | 'edit',
  ) => {
    setError(null);
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (target === 'register') {
        setAvatarDataUrl(dataUrl);
      } else {
        setEditAvatar(dataUrl);
        setRemoveAvatar(false);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Invalid photo selection.');
    }
  };

  const handleSubmitAuth = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === 'login') {
        await onLogin({ username: username.trim().toLowerCase(), password });
      } else {
        await onRegister({
          username: username.trim().toLowerCase(),
          name: displayName.trim(),
          password,
          avatarDataUrl,
        });
      }
      setPassword('');
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not complete authentication.');
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setNotice(null);
    setBusy(true);
    try {
      await onUpdateProfile({
        name: editName.trim(),
        avatarDataUrl: editAvatar || undefined,
        removeAvatar: removeAvatar || undefined,
      });
      setNotice('Profile saved.');
      setEditAvatar(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update profile.');
    } finally {
      setBusy(false);
    }
  };

  if (profile) {
    const shownAvatar = removeAvatar ? null : editAvatar || profile.avatarUrl;
    const createdFormatted = new Date(profile.createdAt).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    return (
      <Modal
        open={open}
        onClose={onClose}
        title="Your Paper & Ink Account"
        subtitle={`Signed in as @${profile.username} · Member since ${createdFormatted}`}
        maxWidthClass="max-w-md"
      >
        <form onSubmit={handleProfileSave} className="space-y-4">
          <div className="flex items-center gap-4">
            <div
              className="w-16 h-16 rounded-full overflow-hidden flex items-center justify-center text-lg font-medium shrink-0"
              style={{
                backgroundColor: 'var(--pi-surface-muted, #ECE3D4)',
                border: '1px solid var(--pi-border, rgba(31,42,58,0.12))',
                fontFamily: 'var(--pi-font-display)',
              }}
            >
              {shownAvatar ? (
                <img src={shownAvatar} alt={profile.displayName} className="w-full h-full object-cover" />
              ) : (
                profile.displayName.slice(0, 1).toUpperCase()
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium cursor-pointer border border-current/15 hover:opacity-80">
                <Camera size={13} />
                <span>{shownAvatar ? 'Change photo' : 'Upload photo'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void handlePhotoSelect(e, 'edit')}
                />
              </label>
              {shownAvatar && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditAvatar(null);
                    setRemoveAvatar(true);
                  }}
                >
                  <Trash2 size={13} />
                  Remove
                </Button>
              )}
            </div>
          </div>

          <Input
            label="Display name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            maxLength={60}
            required
          />

          <div
            className="flex items-start gap-2.5 p-3 rounded-xl text-xs leading-relaxed"
            style={{
              backgroundColor: 'var(--pi-surface-muted, #ECE3D4)',
              color: 'var(--pi-text-muted)',
            }}
          >
            <ShieldCheck size={15} className="shrink-0 mt-0.5 text-[#526B59]" />
            <span>
              Your identity lives with Supabase Auth. Books, notes, handwriting, reading progress,
              and saved articles stay stored strictly on this device.
            </span>
          </div>

          {error && <p className="text-xs text-[#B83B2B]">{error}</p>}
          {notice && <p className="text-xs text-[#526B59]">{notice}</p>}

          <div className="flex items-center justify-between pt-2">
            <Button
              type="button"
              variant="ghost"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await onLogout();
                  onClose();
                } finally {
                  setBusy(false);
                }
              }}
            >
              Sign out
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              {busy ? 'Saving…' : 'Save profile'}
            </Button>
          </div>
        </form>
      </Modal>
    );
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'login' ? 'Sign in to Paper & Ink' : 'Create your Paper & Ink account'}
      subtitle="Username and password only — no email or phone required."
      maxWidthClass="max-w-md"
    >
      <div
        className="grid grid-cols-2 p-1 rounded-full mb-5"
        style={{ backgroundColor: 'var(--pi-surface-muted, #ECE3D4)' }}
      >
        <button
          type="button"
          onClick={() => {
            setMode('login');
            setError(null);
          }}
          className="h-8 rounded-full text-xs font-medium transition-all cursor-pointer"
          style={{
            backgroundColor: mode === 'login' ? 'var(--pi-surface, #FBF7F0)' : 'transparent',
            boxShadow: mode === 'login' ? 'var(--pi-shadow-soft)' : undefined,
          }}
        >
          Sign in
        </button>
        <button
          type="button"
          onClick={() => {
            setMode('register');
            setError(null);
          }}
          className="h-8 rounded-full text-xs font-medium transition-all cursor-pointer"
          style={{
            backgroundColor: mode === 'register' ? 'var(--pi-surface, #FBF7F0)' : 'transparent',
            boxShadow: mode === 'register' ? 'var(--pi-shadow-soft)' : undefined,
          }}
        >
          Create account
        </button>
      </div>

      <form onSubmit={handleSubmitAuth} className="space-y-4">
        <Input
          label="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="e.g. ada_lovelace"
          autoComplete="username"
          hint={mode === 'register' ? '3–24 lowercase letters, numbers, or underscores.' : undefined}
          required
        />

        {mode === 'register' && (
          <Input
            label="Name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Your display name"
            maxLength={60}
            required
          />
        )}

        <Input
          label="Password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={mode === 'register' ? 'At least 8 characters' : 'Enter your password'}
          autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
          minLength={8}
          maxLength={128}
          required
        />

        {mode === 'register' && (
          <div className="flex items-center gap-3 pt-1">
            <div
              className="w-12 h-12 rounded-full overflow-hidden flex items-center justify-center text-sm font-medium shrink-0"
              style={{
                backgroundColor: 'var(--pi-surface-muted, #ECE3D4)',
                border: '1px solid var(--pi-border)',
              }}
            >
              {avatarDataUrl ? (
                <img src={avatarDataUrl} alt="Avatar preview" className="w-full h-full object-cover" />
              ) : (
                <Camera size={16} className="opacity-50" />
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full text-xs font-medium cursor-pointer border border-current/15 hover:opacity-80">
                <span>{avatarDataUrl ? 'Change photo' : 'Profile photo (optional)'}</span>
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="sr-only"
                  onChange={(e) => void handlePhotoSelect(e, 'register')}
                />
              </label>
              {avatarDataUrl && (
                <Button type="button" size="sm" variant="ghost" onClick={() => setAvatarDataUrl(null)}>
                  Clear
                </Button>
              )}
            </div>
          </div>
        )}

        <div
          className="flex items-start gap-2.5 p-3 rounded-xl text-xs leading-relaxed"
          style={{
            backgroundColor: 'var(--pi-surface-muted, #ECE3D4)',
            color: 'var(--pi-text-muted)',
          }}
        >
          <ShieldCheck size={15} className="shrink-0 mt-0.5 text-[#526B59]" />
          <span>
            Authenticated with Supabase Auth using only your username and password. Signed-in
            Notes also sync across your devices.
          </span>
        </div>

        {error && <p className="text-xs text-[#B83B2B]">{error}</p>}

        <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pt-1">
          <Button type="button" variant="ghost" onClick={onClose} className="w-full sm:w-auto">
            Continue as guest
          </Button>
          <Button type="submit" variant="primary" disabled={busy} className="w-full sm:w-auto">
            {busy ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
