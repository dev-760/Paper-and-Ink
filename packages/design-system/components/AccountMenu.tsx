import React, { useState } from 'react';
import { User } from 'lucide-react';
import { AuthModal, type AuthModalProps, type SharedUserProfile } from './AuthModal';

export interface AccountMenuProps {
  profile: SharedUserProfile | null;
  isLoading?: boolean;
  onLogin: AuthModalProps['onLogin'];
  onRegister: AuthModalProps['onRegister'];
  onUpdateProfile: AuthModalProps['onUpdateProfile'];
  onLogout: AuthModalProps['onLogout'];
  className?: string;
}

export const AccountMenu: React.FC<AccountMenuProps> = ({
  profile,
  isLoading = false,
  onLogin,
  onRegister,
  onUpdateProfile,
  onLogout,
  className = '',
}) => {
  const [modalOpen, setModalOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={isLoading && !profile}
        className={`pi-focus-ring inline-flex items-center gap-2 min-h-[40px] sm:min-h-[36px] sm:h-9 px-2.5 sm:px-3 rounded-full text-xs font-medium transition-all cursor-pointer active:scale-[0.98] ${className}`}
        style={{
          backgroundColor: 'var(--pi-surface, #FBF7F0)',
          color: 'var(--pi-text, #1F2A3A)',
          border: '1px solid var(--pi-border, rgba(31,42,58,0.1))',
          boxShadow: 'var(--pi-shadow-soft)',
          fontFamily: 'var(--pi-font-sans)',
        }}
        title={profile ? `${profile.displayName} (@${profile.username})` : 'Sign in or create account'}
      >
        {profile?.avatarUrl ? (
          <img
            src={profile.avatarUrl}
            alt={profile.displayName}
            className="w-5 h-5 rounded-full object-cover shrink-0"
          />
        ) : (
          <span
            className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold shrink-0"
            style={{
              backgroundColor: profile ? 'var(--pi-accent, #C4572F)' : 'var(--pi-surface-muted, #ECE3D4)',
              color: profile ? '#FBF7F0' : 'var(--pi-text-muted)',
            }}
          >
            {profile ? profile.displayName.slice(0, 1).toUpperCase() : <User size={12} />}
          </span>
        )}
        <span className="max-w-[96px] truncate hidden sm:inline">
          {profile ? profile.displayName : 'Sign in'}
        </span>
      </button>

      <AuthModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        profile={profile}
        onLogin={onLogin}
        onRegister={onRegister}
        onUpdateProfile={onUpdateProfile}
        onLogout={onLogout}
      />
    </>
  );
};
