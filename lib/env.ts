function getApiBaseUrl() {
  if (process.env.NEXT_PUBLIC_API_BASE_URL) return process.env.NEXT_PUBLIC_API_BASE_URL;
  
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "http://localhost:8000/api/v1";
    }
    return "/_/backend/api/v1";
  }
  
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}/_/backend/api/v1`;
  }
  
  return "http://localhost:8000/api/v1";
}

function getWsBaseUrl() {
  if (process.env.NEXT_PUBLIC_WS_BASE_URL) return process.env.NEXT_PUBLIC_WS_BASE_URL;
  
  if (typeof window !== "undefined") {
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "ws://localhost:8000/api/v1/stream";
    }
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${window.location.host}/_/backend/api/v1/stream`;
  }
  
  if (process.env.VERCEL_URL) {
    return `wss://${process.env.VERCEL_URL}/_/backend/api/v1/stream`;
  }
  
  return "ws://localhost:8000/api/v1/stream";
}

export const env = {
  apiBaseUrl: getApiBaseUrl(),
  wsBaseUrl: getWsBaseUrl(),
  devAuthEmail: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL ?? "demo@veltrix.ai",
  devAuthPassword: process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? "Demo123!",
}
