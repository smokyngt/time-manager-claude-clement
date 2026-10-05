import { ApiError } from '@/lib/api/errors'

export const GENERIC_AUTH_ERROR = 'Something went wrong. Please try again.'

export function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 401) return 'Invalid email or password'
    if (error.status === 429) return 'Too many attempts, try again in a minute'
  }
  return GENERIC_AUTH_ERROR
}

const CALLBACK_MESSAGES: Record<string, string> = {
  AUTH_MICROSOFT_ERROR: 'Microsoft sign-in failed. Please try again.',
  AUTH_MICROSOFT_FAILED: 'Microsoft sign-in failed. Please try again.',
  AUTH_MICROSOFT_REJECTED: 'Microsoft sign-in was cancelled or rejected. Please try again.',
  AUTH_MICROSOFT_UNAVAILABLE: 'Microsoft sign-in is not available right now.',
  AUTH_MICROSOFT_UNKNOWN_USER:
    'Your Microsoft account is not registered. Ask your manager to create your account.',
}

export function getCallbackErrorMessage(code: string) {
  return CALLBACK_MESSAGES[code] ?? 'Microsoft sign-in failed. Please try again.'
}
