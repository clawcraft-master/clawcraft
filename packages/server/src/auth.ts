/**
 * Authentication providers for ClawCraft
 */

export interface AuthResult {
  success: boolean;
  provider: 'twitter' | 'moltbook' | 'guest';
  userId: string;
  displayName: string;
  avatar?: string;
  error?: string;
}

export interface AuthConfig {
  twitter?: {
    apiKey: string;
    apiSecret: string;
    bearerToken: string;
  };
  moltbook?: {
    apiUrl: string;
    apiKey?: string;
  };
  allowGuests: boolean;
}

let config: AuthConfig = {
  allowGuests: true, // Default to allowing guests for development
};

export function configureAuth(newConfig: Partial<AuthConfig>): void {
  config = { ...config, ...newConfig };
  console.log('Auth configured:', {
    twitter: !!config.twitter,
    moltbook: !!config.moltbook,
    allowGuests: config.allowGuests,
  });
}

/**
 * Authenticate a token
 * Token format: "provider:token" (e.g., "twitter:abc123" or "moltbook:xyz789")
 * Or just a name for guest auth
 */
export async function authenticate(token: string): Promise<AuthResult> {
  // Parse token format
  const [provider, authToken] = token.includes(':') 
    ? token.split(':', 2) 
    : ['guest', token];

  switch (provider) {
    case 'twitter':
      return authenticateTwitter(authToken || '');
    case 'moltbook':
      return authenticateMoltbook(authToken || '');
    case 'guest':
    default:
      return authenticateGuest(authToken || token);
  }
}

async function authenticateTwitter(token: string): Promise<AuthResult> {
  if (!config.twitter) {
    return {
      success: false,
      provider: 'twitter',
      userId: '',
      displayName: '',
      error: 'Twitter auth not configured',
    };
  }

  try {
    // Verify token with Twitter API
    const response = await fetch('https://api.twitter.com/2/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      return {
        success: false,
        provider: 'twitter',
        userId: '',
        displayName: '',
        error: 'Invalid Twitter token',
      };
    }

    const data = await response.json() as { data: { id: string; username: string; name: string; profile_image_url?: string } };
    
    return {
      success: true,
      provider: 'twitter',
      userId: `twitter:${data.data.id}`,
      displayName: data.data.name || data.data.username,
      avatar: data.data.profile_image_url,
    };
  } catch (err) {
    return {
      success: false,
      provider: 'twitter',
      userId: '',
      displayName: '',
      error: `Twitter auth failed: ${err}`,
    };
  }
}

async function authenticateMoltbook(token: string): Promise<AuthResult> {
  if (!config.moltbook) {
    return {
      success: false,
      provider: 'moltbook',
      userId: '',
      displayName: '',
      error: 'Moltbook auth not configured',
    };
  }

  try {
    // Verify token with Moltbook API
    const url = `${config.moltbook.apiUrl}/verify?token=${encodeURIComponent(token)}`;
    const headers: Record<string, string> = {};
    if (config.moltbook.apiKey) {
      headers['Authorization'] = `Bearer ${config.moltbook.apiKey}`;
    }

    const response = await fetch(url, { headers });

    if (!response.ok) {
      return {
        success: false,
        provider: 'moltbook',
        userId: '',
        displayName: '',
        error: 'Invalid Moltbook token',
      };
    }

    const data = await response.json() as { id: string; name: string; avatar?: string };
    
    return {
      success: true,
      provider: 'moltbook',
      userId: `moltbook:${data.id}`,
      displayName: data.name,
      avatar: data.avatar,
    };
  } catch (err) {
    return {
      success: false,
      provider: 'moltbook',
      userId: '',
      displayName: '',
      error: `Moltbook auth failed: ${err}`,
    };
  }
}

function authenticateGuest(name: string): AuthResult {
  if (!config.allowGuests) {
    return {
      success: false,
      provider: 'guest',
      userId: '',
      displayName: '',
      error: 'Guest access not allowed',
    };
  }

  // Sanitize name
  const sanitized = name
    .replace(/[<>]/g, '')
    .trim()
    .slice(0, 32) || `Guest-${Math.random().toString(36).slice(2, 8)}`;

  return {
    success: true,
    provider: 'guest',
    userId: `guest:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    displayName: sanitized,
  };
}
