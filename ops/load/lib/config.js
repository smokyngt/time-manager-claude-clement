// Shared configuration for every k6 scenario. All values can be overridden with `-e NAME=value`.

export const BASE_URL = (__ENV.BASE_URL || 'http://localhost:8000').replace(/\/+$/, '');
export const PASSWORD = __ENV.DEMO_PASSWORD || 'Demo1234!';

// Same rule as api/src/db/demo.ts: `${name.toLowerCase().replace(' ', '.')}@timemanager.dev`.
const email = (name) => `${name.toLowerCase().replace(' ', '.')}@timemanager.dev`;

export const EMPLOYEES = [
  'Alice Martin',
  'Bruno Lefevre',
  'Camille Dubois',
  'David Moreau',
  'Emma Laurent',
  'Fabien Simon',
  'Gaelle Michel',
  'Hugo Garcia',
  'Ines Roux',
  'Julien Fournier',
  'Karine Girard',
  'Louis Andre',
].map(email);

export const MANAGERS = ['Manager Alpha', 'Manager Beta'].map(email);

export const ALL_ACCOUNTS = [...MANAGERS, ...EMPLOYEES];

export const DAY_MS = 24 * 60 * 60 * 1000;

// Think time between iterations, in seconds. Set THINK=0 to remove it.
export const THINK = Number(__ENV.THINK === undefined ? 1 : __ENV.THINK);

// Output directory of the summary files written by handleSummary.
export const SUMMARY_DIR = (__ENV.SUMMARY_DIR || 'ops/load/results').replace(/\/+$/, '');
