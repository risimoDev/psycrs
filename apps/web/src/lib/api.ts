export const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
}

class ApiError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let accessToken: string | null = null;
let isRefreshing = false;
let refreshPromise: Promise<boolean> | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function getAccessToken() {
  return accessToken;
}

async function tryRefreshToken(): Promise<boolean> {
  const rt = typeof window !== 'undefined' ? localStorage.getItem('refreshToken') : null;
  if (!rt) return false;

  try {
    const res = await fetch(`${API_BASE}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: rt }),
    });

    if (!res.ok) return false;

    const tokens = await res.json();
    accessToken = tokens.accessToken;
    localStorage.setItem('refreshToken', tokens.refreshToken);
    return true;
  } catch {
    return false;
  }
}

function refreshOnce(): Promise<boolean> {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshPromise = tryRefreshToken().finally(() => {
      isRefreshing = false;
      refreshPromise = null;
    });
  }
  return refreshPromise!;
}

async function request<T>(path: string, options: FetchOptions = {}): Promise<T> {
  const { body, headers: customHeaders, ...rest } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(customHeaders as Record<string, string>),
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...rest,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as T;
  }

  // On 401, try to refresh token and retry once
  if (res.status === 401 && !path.startsWith('/auth/')) {
    const refreshed = await refreshOnce();
    if (refreshed && accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...rest,
        headers,
        body: body ? JSON.stringify(body) : undefined,
      });

      if (retryRes.status === 204) return undefined as T;
      const retryData = await retryRes.json();
      if (!retryRes.ok) throw new ApiError(retryRes.status, retryData.message ?? 'Request failed');
      return retryData as T;
    }
  }

  const data = await res.json();

  if (!res.ok) {
    throw new ApiError(res.status, data.message ?? 'Request failed');
  }

  return data as T;
}

// ─── Auth ──────────────────────────────────────────────

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface UserProfile {
  id: string;
  email: string;
  role: string;
  createdAt: string;
}

export const authApi = {
  register: (email: string, password: string) =>
    request<AuthTokens>('/auth/register', {
      method: 'POST',
      body: { email, password },
    }),

  login: (email: string, password: string) =>
    request<AuthTokens>('/auth/login', {
      method: 'POST',
      body: { email, password },
    }),

  refresh: (refreshToken: string) =>
    request<AuthTokens>('/auth/refresh', {
      method: 'POST',
      body: { refreshToken },
    }),

  logout: (refreshToken: string) =>
    request<void>('/auth/logout', {
      method: 'POST',
      body: { refreshToken },
    }),

  me: () => request<UserProfile>('/auth/me'),
};

// ─── Subscription ──────────────────────────────────────

export interface SubscriptionStatus {
  status: string;
  currentPeriodEnd: string | null;
}

export const subscriptionApi = {
  getStatus: () => request<SubscriptionStatus>('/subscription/status'),
};

// ─── Payment ───────────────────────────────────────────

export interface PaymentResult {
  paymentId: string;
  confirmationUrl: string;
}

export const paymentApi = {
  create: () =>
    request<PaymentResult>('/payment/create', { method: 'POST' }),
};

// ─── Video / Lessons ───────────────────────────────────

export interface Lesson {
  id: string;
  title: string;
  slug: string;
  order: number;
  module: number;
}

export type ContentType = 'lecture' | 'affirmation' | 'article_pdf';

export interface ContentItem {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  order: number;
  contentType: ContentType;
  pdfUrl: string | null;
  duration: number | null;
  videoId: string | null;
  isMarkedViewed: boolean;
}

export interface PlaybackToken {
  playbackUrl: string;
  drm?: {
    mode: 'clearkey' | 'widevine';
    dashUrl: string;
    clearKeys?: Record<string, string>;
    widevineUrl?: string;
  };
}

export const videoApi = {
  lessons: () => request<Lesson[]>('/video/lessons'),

  requestPlayback: (lessonId: string) =>
    request<PlaybackToken>('/video/request-playback', {
      method: 'POST',
      body: { lessonId },
    }),
};

// ─── Content (dashboard library) ───────────────────────

export const contentApi = {
  list: (type: ContentType) =>
    request<ContentItem[]>(`/content?type=${encodeURIComponent(type)}`),

  getById: (id: string) => request<ContentItem>(`/content/${id}`),

  markViewed: (id: string, viewed: boolean) =>
    request<{ isMarkedViewed: boolean }>(`/content/${id}/mark-viewed`, {
      method: 'POST',
      body: { viewed },
    }),
};

// ─── Progress ──────────────────────────────────────────

export interface ProgressRecord {
  lessonId: string;
  progress: number;
  lastPosition: number;
  updatedAt: string;
}

export interface ContinueWatching {
  lessonId: string;
  progress: number;
  lastPosition: number;
  lesson: { id: string; title: string; slug: string; order: number };
}

export interface CourseCompletion {
  totalLessons: number;
  completedLessons: number;
  overallProgress: number;
}

export const progressApi = {
  upsert: (lessonId: string, progress: number, lastPosition: number) =>
    request<ProgressRecord>('/progress', {
      method: 'POST',
      body: { lessonId, progress, lastPosition },
    }),

  getAll: () => request<ProgressRecord[]>('/progress'),

  continueWatching: () => request<ContinueWatching | null>('/progress/continue'),

  completion: () => request<CourseCompletion>('/progress/completion'),
};

// ─── Admin ─────────────────────────────────────────────

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminUser {
  id: string;
  email: string;
  role: string;
  isBanned: boolean;
  lastIp: string | null;
  lastLoginAt: string | null;
  createdAt: string;
  subscription: { status: string; currentPeriodEnd: string; retryCount?: number } | null;
}

export interface AdminUserDetail extends AdminUser {
  lastUserAgent: string | null;
  payments: Array<{
    id: string;
    amount: string;
    currency: string;
    status: string;
    createdAt: string;
  }>;
  progress: Array<{
    lessonId: string;
    progress: number;
    lastPosition: number;
    updatedAt: string;
    lesson: { title: string; slug: string; module: number; order: number };
  }>;
  refreshTokens: Array<{
    id: string;
    createdAt: string;
    expiresAt: string;
  }>;
  _count: {
    payments: number;
    progress: number;
    refreshTokens: number;
    auditLogs: number;
  };
}

export interface AdminSubscription {
  id: string;
  userId: string;
  status: string;
  currentPeriodEnd: string;
  retryCount: number;
  createdAt: string;
  updatedAt: string;
  user: { id: string; email: string };
}

export interface AdminLesson {
  id: string;
  title: string;
  slug: string;
  description: string | null;
  order: number;
  module: number;
  videoId: string;
  duration: number | null;
  isPublished: boolean;
  contentType: ContentType;
  pdfUrl: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVideo {
  id: string;
  filename: string;
  originalName: string;
  status: 'uploading' | 'processing' | 'ready' | 'error';
  duration: number | null;
  size: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface DashboardData {
  totalUsers: number;
  activeSubscriptions: number;
  gracePeriodSubscriptions: number;
  expiredSubscriptions: number;
  totalRevenue: number;
  totalPayments: number;
  mrr: number;
  churnRate: number;
  recentPayments: Array<{
    id: string;
    amount: string;
    createdAt: string;
    user: { email: string };
  }>;
  usersByMonth: Array<{ month: string; count: number }>;
}

export interface RetentionData {
  dau: number;
  wau: number;
  mau: number;
  retention7d: number;
  retention30d: number;
  avgCourseCompletion: number;
}

export type SiteSettings = Record<string, string>;

export interface AdminReview {
  id: string;
  name: string;
  role: string | null;
  text: string | null;
  imageUrl: string | null;
  order: number;
  isVisible: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface PublicReview {
  id: string;
  name: string;
  role: string | null;
  text: string | null;
  imageUrl: string | null;
}

export interface AdminTariff {
  id: string;
  title: string;
  description: string;
  price: number;
  oldPrice: number | null;
  period: string;
  features: string[];
  isActive: boolean;
  isPopular: boolean;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicTariff {
  id: string;
  title: string;
  description: string;
  price: number;
  oldPrice: number | null;
  period: string;
  features: string[];
  isPopular: boolean;
}

export const adminApi = {
  // Dashboard
  dashboard: () => request<DashboardData>('/admin/dashboard'),
  retention: () => request<RetentionData>('/admin/retention'),

  // Lessons
  lessons: (page = 1, limit = 20) =>
    request<PaginatedResponse<AdminLesson>>(`/admin/lessons?page=${page}&limit=${limit}`),
  createLesson: (data: {
    title: string;
    slug: string;
    description?: string;
    videoId?: string;
    pdfUrl?: string;
    contentType: ContentType;
    order?: number;
    duration?: number;
    isPublished?: boolean;
  }) =>
    request<AdminLesson>('/admin/lessons', { method: 'POST', body: data }),
  updateLesson: (id: string, data: {
    title?: string;
    slug?: string;
    description?: string;
    videoId?: string;
    pdfUrl?: string;
    contentType?: ContentType;
    order?: number;
    duration?: number;
    isPublished?: boolean;
  }) =>
    request<AdminLesson>(`/admin/lessons/${id}`, { method: 'PATCH', body: data }),
  deleteLesson: (id: string) =>
    request<void>(`/admin/lessons/${id}`, { method: 'DELETE' }),

  // Videos
  videos: (page = 1, limit = 20, status?: string) =>
    request<PaginatedResponse<AdminVideo>>(
      `/admin/videos?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`,
    ),
  uploadVideo: async (file: File): Promise<AdminVideo> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await fetch(`${API_BASE}/admin/videos/upload`, {
      method: 'POST',
      headers,
      body: formData,
    });

    // On 401, try to refresh and retry
    if (res.status === 401) {
      const refreshed = await refreshOnce();
      if (refreshed && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        const retryFormData = new FormData();
        retryFormData.append('file', file);
        res = await fetch(`${API_BASE}/admin/videos/upload`, {
          method: 'POST',
          headers,
          body: retryFormData,
        });
      }
    }

    if (!res.ok) {
      const data = await res.json();
      throw new ApiError(res.status, data.message ?? 'Upload failed');
    }

    return res.json();
  },
  deleteVideo: (id: string) =>
    request<void>(`/admin/videos/${id}`, { method: 'DELETE' }),

  // Settings
  getSettings: () => request<SiteSettings>('/admin/settings'),
  updateSettings: (data: SiteSettings) =>
    request<SiteSettings>('/admin/settings', { method: 'PUT', body: data }),

  // Users
  users: (page = 1, limit = 20, search?: string) =>
    request<PaginatedResponse<AdminUser>>(
      `/admin/users?page=${page}&limit=${limit}${search ? `&search=${encodeURIComponent(search)}` : ''}`,
    ),
  user: (id: string) => request<AdminUserDetail>(`/admin/users/${id}`),

  // Subscriptions
  subscriptions: (page = 1, limit = 20, status?: string) =>
    request<PaginatedResponse<AdminSubscription>>(
      `/admin/subscriptions?page=${page}&limit=${limit}${status ? `&status=${status}` : ''}`,
    ),
  cancelSubscription: (id: string) =>
    request<AdminSubscription>(`/admin/subscriptions/${id}/cancel`, { method: 'POST' }),
  grantSubscription: (userId: string, days = 30) =>
    request<AdminSubscription>(`/admin/subscriptions/${userId}/grant`, { method: 'POST', body: { days } }),
  revokeSubscription: (userId: string) =>
    request<AdminSubscription>(`/admin/subscriptions/${userId}/revoke`, { method: 'POST' }),

  // User management
  banUser: (userId: string) =>
    request<AdminUser>(`/admin/users/${userId}/ban`, { method: 'POST' }),
  unbanUser: (userId: string) =>
    request<AdminUser>(`/admin/users/${userId}/unban`, { method: 'POST' }),

  // Reviews
  reviews: (page = 1, limit = 50) =>
    request<PaginatedResponse<AdminReview>>(`/admin/reviews?page=${page}&limit=${limit}`),
  createReview: (data: { name: string; role?: string; text?: string; order?: number; isVisible?: boolean }) =>
    request<AdminReview>('/admin/reviews', { method: 'POST', body: data }),
  updateReview: (id: string, data: { name?: string; role?: string; text?: string; order?: number; isVisible?: boolean }) =>
    request<AdminReview>(`/admin/reviews/${id}`, { method: 'PATCH', body: data }),
  uploadReviewImage: async (id: string, file: File): Promise<AdminReview> => {
    const formData = new FormData();
    formData.append('file', file);

    const headers: Record<string, string> = {};
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    let res = await fetch(`${API_BASE}/admin/reviews/${id}/image`, {
      method: 'POST',
      headers,
      body: formData,
    });

    if (res.status === 401) {
      const refreshed = await refreshOnce();
      if (refreshed && accessToken) {
        headers['Authorization'] = `Bearer ${accessToken}`;
        const retryForm = new FormData();
        retryForm.append('file', file);
        res = await fetch(`${API_BASE}/admin/reviews/${id}/image`, {
          method: 'POST',
          headers,
          body: retryForm,
        });
      }
    }

    if (!res.ok) {
      const data = await res.json();
      throw new ApiError(res.status, data.message ?? 'Upload failed');
    }

    return res.json();
  },
  deleteReview: (id: string) =>
    request<void>(`/admin/reviews/${id}`, { method: 'DELETE' }),

  // Tariffs
  tariffs: (page = 1, limit = 50) =>
    request<PaginatedResponse<AdminTariff>>(`/admin/tariffs?page=${page}&limit=${limit}`),
  createTariff: (data: {
    title: string;
    description?: string;
    price: number;
    oldPrice?: number | null;
    period?: string;
    features?: string[];
    isActive?: boolean;
    isPopular?: boolean;
    order?: number;
  }) =>
    request<AdminTariff>('/admin/tariffs', { method: 'POST', body: data }),
  updateTariff: (id: string, data: {
    title?: string;
    description?: string;
    price?: number;
    oldPrice?: number | null;
    period?: string;
    features?: string[];
    isActive?: boolean;
    isPopular?: boolean;
    order?: number;
  }) =>
    request<AdminTariff>(`/admin/tariffs/${id}`, { method: 'PATCH', body: data }),
  deleteTariff: (id: string) =>
    request<void>(`/admin/tariffs/${id}`, { method: 'DELETE' }),
};

// ─── Public Settings ───────────────────────────────────

export const settingsApi = {
  getPublic: () => request<SiteSettings>('/settings'),
};

export const reviewsApi = {
  getAll: () => request<PublicReview[]>('/reviews'),
};

export const tariffApi = {
  getAll: () => request<PublicTariff[]>('/tariffs'),
};
