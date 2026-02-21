export class AppError extends Error {
  constructor(
    message: string,
    public statusCode: number = 400,
    public code?: string
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function apiResponse<T>(data: T, status = 200) {
  return Response.json({ success: true, data }, { status });
}

export function apiError(message: string, status = 400, code?: string) {
  return Response.json(
    { success: false, error: { message, code } },
    { status }
  );
}

// Simple in-memory rate limiter for edge runtime
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  limit = 30,
  windowMs = 60_000
): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (entry.count >= limit) return false;
  entry.count++;
  return true;
}
