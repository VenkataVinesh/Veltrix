export const env = {
  apiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000/api/v1",
  wsBaseUrl: process.env.NEXT_PUBLIC_WS_BASE_URL ?? "ws://localhost:8000/api/v1/stream",
  devAuthEmail: process.env.NEXT_PUBLIC_DEV_LOGIN_EMAIL ?? "demo@veltrix.ai",
  devAuthPassword: process.env.NEXT_PUBLIC_DEV_LOGIN_PASSWORD ?? "Demo123!",
}
