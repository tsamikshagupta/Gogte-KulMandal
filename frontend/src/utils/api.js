import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:4000';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
});

// Runtime baseURL auto-detection (accept only healthy 2xx test response)
async function pingBase(base) {
  const url = base.replace(/\/$/, '') + '/api/test';
  const res = await axios.get(url, { timeout: 3000 });
  return res && res.status >= 200 && res.status < 300 && typeof res.data === 'object' && !!res.data.message;
}

async function detectBaseURL() {
  // 1) verify cached base
  try {
    const cached = localStorage.getItem('apiBaseUrl');
    if (cached && await pingBase(cached)) {
      api.defaults.baseURL = cached;
      // eslint-disable-next-line no-console
      console.info('[api] using cached baseURL:', cached);
      return;
    }
  } catch (_) {}

  // 2) try explicit env
  const candidates = [];
  if (process.env.REACT_APP_API_URL) candidates.push(process.env.REACT_APP_API_URL);
  // 3) try localhost:4000 (backend default)
  candidates.push('http://localhost:4000');
  // 4) finally, origin (only if it serves the API test successfully)
  try {
    if (typeof window !== 'undefined' && window.location && window.location.origin) {
      candidates.push(window.location.origin);
    }
  } catch (_) {}

  for (const base of candidates) {
    try {
      if (await pingBase(base)) {
        api.defaults.baseURL = base;
        try { localStorage.setItem('apiBaseUrl', base); } catch(_) {}
        // eslint-disable-next-line no-console
        console.info('[api] using baseURL:', base);
        return;
      }
    } catch (_) { /* try next */ }
  }
}
(async () => { try { await detectBaseURL(); } catch(_) {} })();

// Request interceptor
api.interceptors.request.use(
  (config) => {
    // Add auth token if available
    const token = localStorage.getItem('authToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    // If sending FormData, let the browser set the correct multipart boundary
    if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
      if (config.headers && config.headers['Content-Type']) {
        delete config.headers['Content-Type'];
      }
    } else {
      // For JSON payloads ensure content-type
      if (config.data && typeof config.data === 'object') {
        config.headers = config.headers || {};
        if (!config.headers['Content-Type']) {
          config.headers['Content-Type'] = 'application/json';
        }
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor
api.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Handle unauthorized access
      localStorage.removeItem('authToken');
      try {
        const current = window.location?.pathname || '/';
        if (current !== '/login') {
          window.location.replace('/login');
        }
      } catch (_) {}
    }
    return Promise.reject(error);
  }
);

export default api;

export async function apiLogin(email, password) {
  const res = await api.post('/api/auth/login', { email, password });
  return res.data;
}

export async function apiRegister(payload) {
  const res = await api.post('/api/auth/register', payload);
  return res.data;
}

// Create event with multipart form data
export async function apiCreateEvent(formData) {
  // Let Axios set multipart boundaries automatically
  const res = await api.post('/api/events', formData);
  return res.data;
}

// Fetch events
export async function apiListEvents() {
  const res = await api.get('/api/events');
  return res.data;
}

// News
export async function apiCreateNews(formData) {
  // Let Axios set multipart boundaries automatically
  const res = await api.post('/api/news', formData);
  return res.data;
}
export async function apiListNews() {
  const res = await api.get('/api/news');
  return res.data;
}

// Photos
export async function apiCreatePhoto(formData) {
  const res = await api.post('/api/photos', formData);
  return res.data;
}
export async function apiListPhotos() {
  const res = await api.get('/api/photos');
  return res.data;
}
