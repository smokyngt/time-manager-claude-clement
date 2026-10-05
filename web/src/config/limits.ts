export const LIMITS = {
  bulkIds: 100,
  description: 500,
  email: 254,
  firstName: 100,
  lastName: 100,
  name: 100,
  note: 500,
  pageSize: { default: 25, max: 100 },
  password: { max: 128, min: 10 },
  patterns: {
    name: /^[\p{L}\p{M}][\p{L}\p{M}' .-]*$/u,
    phone: /^\+?[0-9 ().-]{6,20}$/,
    time: /^([01]\d|2[0-3]):[0-5]\d$/,
  },
  phone: { max: 20, min: 6 },
  weeklyHours: { max: 80, min: 1 },
} as const
