/** Role of a user, from least to most privileged. */
export type Role = 'admin' | 'employee' | 'manager';

/** Permission scope carried by the access token. */
export type Scope =
  | 'auth:self'
  | 'clocks:manage'
  | 'clocks:read'
  | 'clocks:write'
  | 'reports:read'
  | 'teams:manage'
  | 'teams:read'
  | 'users:manage'
  | 'users:read'
  | 'users:write';

/** How a clock was recorded: by the user (`clock`) or entered by a manager (`manual`). */
export type ClockSource = 'clock' | 'manual';

/** Bucket size of a report series. */
export type Granularity = 'day' | 'month' | 'week';

/** Sort direction on `createdAt`. */
export type Order = 'asc' | 'desc';

/** A date bound: epoch milliseconds, an ISO 8601 string or a `Date`. */
export type DateInput = Date | number | string;

/** A user of the application. */
export interface User {
  /** Archival time in epoch milliseconds, null when active. */
  archivedAt: null | number;
  /** Creation time in epoch milliseconds. */
  createdAt: number;
  /** Email address, lowercased and unique. */
  email: string;
  /** First name. */
  firstName: string;
  /** Unique identifier (uuid). */
  id: string;
  /** Last name. */
  lastName: string;
  /** Object type discriminator. */
  object: 'user';
  /** Phone number, null when unknown. */
  phoneNumber: null | string;
  /** Role of the user. */
  role: Role;
  /** Last update time in epoch milliseconds, null when never updated. */
  updatedAt: null | number;
}

/** A member of a team: a plain user. */
export type TeamMember = User;

/** A team of employees run by a manager. */
export interface Team {
  /** Archival time in epoch milliseconds, null when active. */
  archivedAt: null | number;
  /** Creation time in epoch milliseconds. */
  createdAt: number;
  /** Description, null when absent (500 characters max). */
  description: null | string;
  /** Unique identifier (uuid). */
  id: string;
  /** Identifier of the managing user. */
  managerId: string;
  /** Number of active members. */
  memberCount: number;
  /** Name (1 to 100 characters). */
  name: string;
  /** Object type discriminator. */
  object: 'team';
  /** Last update time in epoch milliseconds, null when never updated. */
  updatedAt: null | number;
  /** Weekly hours target (1 to 80). */
  weeklyHoursTarget: number;
  /** End of the working day, `HH:MM` in the company timezone. */
  workEnd: string;
  /** Start of the working day, `HH:MM` in the company timezone. */
  workStart: string;
}

/** A time clock entry of a user. */
export interface Clock {
  /** Clock-in time in epoch milliseconds. */
  clockedInAt: number;
  /** Clock-out time in epoch milliseconds, null while the clock is open. */
  clockedOutAt: null | number;
  /** Creation time in epoch milliseconds. */
  createdAt: number;
  /** Duration in milliseconds, null while the clock is open. */
  durationMs: null | number;
  /** Unique identifier (uuid). */
  id: string;
  /** Free text note, null when absent (500 characters max). */
  note: null | string;
  /** Object type discriminator. */
  object: 'clock';
  /** How the clock was recorded. */
  source: ClockSource;
  /** Last update time in epoch milliseconds, null when never updated. */
  updatedAt: null | number;
  /** Identifier of the user the clock belongs to. */
  userId: string;
}

/** Key performance indicators of one user over a range. */
export interface UserReportKpis {
  /** Worked time divided by days worked, 0 when none. */
  averageDailyMs: number;
  /** Distinct days with at least one clock. */
  daysWorked: number;
  /** Days whose first clock-in is more than 5 minutes after the work start. */
  lateDays: number;
  /** Late days divided by days worked, between 0 and 1. */
  latenessRate: number;
  /** Worked time minus target time, negative when under. */
  overtimeMs: number;
  /** Weekly target prorated to the working days of the range. */
  targetMs: number;
  /** Total worked time in the range. */
  workedMs: number;
}

/** One bucket of a user report series. */
export interface UserReportPoint {
  /** Late days in the period. */
  late: number;
  /** Start of the period in epoch milliseconds. */
  periodStart: number;
  /** Worked time in the period. */
  workedMs: number;
}

/** Worked-time report of one user. */
export interface UserReport {
  /** Start of the range in epoch milliseconds. */
  from: number;
  /** Bucket size of the series. */
  granularity: Granularity;
  /** Key performance indicators over the whole range. */
  kpis: UserReportKpis;
  /** Object type discriminator. */
  object: 'user_report';
  /** One zero-filled bucket per period. */
  series: UserReportPoint[];
  /** End of the range in epoch milliseconds. */
  to: number;
  /** Identifier of the reported user. */
  userId: string;
}

/** Key performance indicators of one team over a range. */
export interface TeamReportKpis {
  /** Members with worked time in the range. */
  activeMembers: number;
  /** Worked time divided by member days worked, 0 when none. */
  averageDailyMs: number;
  /** Member days whose first clock-in is more than 5 minutes late. */
  lateDays: number;
  /** Late days divided by member days worked, between 0 and 1. */
  latenessRate: number;
  /** Active members of the team. */
  memberCount: number;
  /** Sum of member overtime, negative when under. */
  overtimeMs: number;
  /** Total worked time of the team in the range. */
  workedMs: number;
}

/** One bucket of a team report series. */
export interface TeamReportPoint {
  /** Start of the period in epoch milliseconds. */
  periodStart: number;
  /** Worked time in the period. */
  workedMs: number;
}

/** Per-member line of a team report. */
export interface TeamReportMember {
  /** Distinct days the member worked. */
  daysWorked: number;
  /** First name of the member. */
  firstName: string;
  /** Last name of the member. */
  lastName: string;
  /** Days the member was late. */
  lateDays: number;
  /** Member overtime, negative when under. */
  overtimeMs: number;
  /** Identifier of the member. */
  userId: string;
  /** Worked time of the member in the range. */
  workedMs: number;
}

/** Worked-time report of one team. */
export interface TeamReport {
  /** Start of the range in epoch milliseconds. */
  from: number;
  /** Bucket size of the series. */
  granularity: Granularity;
  /** Key performance indicators over the whole range. */
  kpis: TeamReportKpis;
  /** Per-member breakdown. */
  members: TeamReportMember[];
  /** Object type discriminator. */
  object: 'team_report';
  /** One zero-filled bucket per period. */
  series: TeamReportPoint[];
  /** Identifier of the reported team. */
  teamId: string;
  /** End of the range in epoch milliseconds. */
  to: number;
}

/** Session returned by login and refresh. */
export interface AuthSession {
  /** Short-lived JWT to send as a Bearer token; keep it in memory. */
  accessToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
  /** Scopes granted to the token. */
  scopes: Scope[];
  /** Token type, always `Bearer`. */
  tokenType: 'Bearer';
  /** The signed-in user. */
  user: User;
}

/** The signed-in user with the scopes of the current token. */
export interface Me {
  /** Scopes granted to the current token. */
  scopes: Scope[];
  /** The signed-in user. */
  user: User;
}

/** Cursor pagination shared by every list call. */
export interface PaginationParams {
  /** Opaque cursor returned as `next` by a previous call. */
  cursor?: string;
  /** Page size (1 to 100, default 25). */
  limit?: number;
  /** Sort direction on `createdAt`, default `desc`. */
  order?: Order;
  /** Number of items to skip. */
  skip?: number;
}

/** A page of items. */
export interface ListResponse<T> {
  /** Items of the page. */
  items: T[];
  /** Whether another page exists. */
  more: boolean;
  /** Cursor of the next page, null on the last page. */
  next: null | string;
  /** Total items matching the filters. */
  total: number;
}

/** One id a bulk operation could not process. */
export interface BulkFailure {
  /** Error code explaining the failure. */
  code: string;
  /** Identifier that failed. */
  id: string;
}

/** Result of a bulk update. */
export interface BulkUpdateResponse {
  /** Ids that could not be updated. */
  failed: BulkFailure[];
  /** True when every id was updated. */
  success: boolean;
  /** Ids that were updated. */
  updated: string[];
}

/** Result of a bulk delete. */
export interface BulkDeleteResponse {
  /** Ids that were deleted. */
  deleted: string[];
  /** Ids that could not be deleted. */
  failed: BulkFailure[];
  /** True when every id was deleted. */
  success: boolean;
}

/** Result of adding members to a team. */
export interface TeamMembersAddResponse {
  /** Ids of the users that became members. */
  added: string[];
  /** Ids that could not be added. */
  failed: BulkFailure[];
  /** True when every id was added. */
  success: boolean;
}

/** Result of removing members from a team. */
export interface TeamMembersRemoveResponse {
  /** Ids that could not be removed. */
  failed: BulkFailure[];
  /** Ids of the users that were removed. */
  removed: string[];
  /** True when every id was removed. */
  success: boolean;
}

/** Credentials for `auth.login`. */
export interface LoginParams {
  /** Account email address. */
  email: string;
  /** Account password. */
  password: string;
}

/** Parameters of `users.create`. */
export interface UserCreateParams {
  /** Email address, unique. */
  email: string;
  /** First name. */
  firstName: string;
  /** Last name. */
  lastName: string;
  /** Initial password (10 to 128 characters). */
  password?: string;
  /** Phone number. */
  phoneNumber?: string;
  /** Role, default `employee`. */
  role?: Role;
}

/** Parameters of `users.list`. */
export interface UserListParams extends PaginationParams {
  /** Only archived (true) or only active (false) users. */
  archived?: boolean;
  /** Only users created after this date. */
  createdAfter?: DateInput;
  /** Only users created before this date. */
  createdBefore?: DateInput;
  /** Only these ids. */
  ids?: string[];
  /** Only this role. */
  role?: Role;
  /** Only members of this team. */
  teamId?: string;
}

/** Fields `users.update` can change. */
export interface UserUpdateData {
  /** New email address. */
  email?: string;
  /** New first name. */
  firstName?: string;
  /** New last name. */
  lastName?: string;
  /** New password (10 to 128 characters). */
  password?: string;
  /** New phone number, null to clear it. */
  phoneNumber?: null | string;
  /** New role. */
  role?: Role;
}

/** Parameters of `teams.create`. */
export interface TeamCreateParams {
  /** Description (500 characters max). */
  description?: string;
  /** Managing user; forced to the caller for managers. */
  managerId?: string;
  /** Name (1 to 100 characters). */
  name: string;
  /** Weekly hours target (1 to 80, default 35). */
  weeklyHoursTarget?: number;
  /** End of the working day, `HH:MM`, default `17:00`. */
  workEnd?: string;
  /** Start of the working day, `HH:MM`, default `09:00`. */
  workStart?: string;
}

/** Parameters of `teams.list`. */
export interface TeamListParams extends PaginationParams {
  /** Only archived (true) or only active (false) teams. */
  archived?: boolean;
  /** Only teams created after this date. */
  createdAfter?: DateInput;
  /** Only teams created before this date. */
  createdBefore?: DateInput;
  /** Only these ids. */
  ids?: string[];
  /** Only teams managed by this user. */
  managerId?: string;
  /** Only teams this user belongs to. */
  memberId?: string;
}

/** Fields `teams.update` can change. */
export interface TeamUpdateData {
  /** New description, null to clear it. */
  description?: null | string;
  /** New manager (admin only). */
  managerId?: string;
  /** New name. */
  name?: string;
  /** New weekly hours target. */
  weeklyHoursTarget?: number;
  /** New end of the working day, `HH:MM`. */
  workEnd?: string;
  /** New start of the working day, `HH:MM`. */
  workStart?: string;
}

/** Parameters of `clocks.in` and `clocks.out`. */
export interface ClockNoteParams {
  /** Free text note (500 characters max). */
  note?: string;
}

/** Parameters of `clocks.create` (manual entry). */
export interface ClockCreateParams {
  /** Clock-in time. */
  clockedInAt: number;
  /** Clock-out time, after clock-in and at most 24 hours later. */
  clockedOutAt: number;
  /** Free text note (500 characters max). */
  note?: string;
  /** User the clock belongs to. */
  userId: string;
}

/** Parameters of `clocks.list`. */
export interface ClockListParams extends PaginationParams {
  /** Lower bound on `clockedInAt`, inclusive. */
  from?: DateInput;
  /** Only open (true) or only closed (false) clocks. */
  open?: boolean;
  /** Upper bound on `clockedInAt`, inclusive. */
  to?: DateInput;
  /** Only clocks of these users. */
  userIds?: string[];
}

/** Fields `clocks.update` can change. */
export interface ClockUpdateData {
  /** New clock-in time. */
  clockedInAt?: number;
  /** New clock-out time. */
  clockedOutAt?: number;
  /** New note. */
  note?: string;
}

/** Parameters of `teamMembers.list`. */
export type TeamMemberListParams = PaginationParams;

/** Parameters of `reports.user`. */
export interface UserReportParams {
  /** Start of the range in epoch milliseconds. */
  from: number;
  /** Bucket size. */
  granularity: Granularity;
  /** End of the range in epoch milliseconds (366 days max). */
  to: number;
  /** User to report on. */
  userId: string;
}

/** Parameters of `reports.team`. */
export interface TeamReportParams {
  /** Start of the range in epoch milliseconds. */
  from: number;
  /** Bucket size. */
  granularity: Granularity;
  /** Team to report on. */
  teamId: string;
  /** End of the range in epoch milliseconds (366 days max). */
  to: number;
}
