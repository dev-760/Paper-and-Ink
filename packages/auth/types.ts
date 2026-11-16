export interface UserProfile {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthSession {
  access_token: string;
  refresh_token: string;
  expires_in?: number;
  expires_at?: number;
  token_type?: string;
}

export interface AuthPayload {
  session: AuthSession;
  profile: UserProfile;
}

export interface RegisterInput {
  username: string;
  name: string;
  password: string;
  avatarDataUrl?: string | null;
}

export interface LoginInput {
  username: string;
  password: string;
}

export interface UpdateProfileInput {
  name?: string;
  avatarDataUrl?: string | null;
  removeAvatar?: boolean;
}
