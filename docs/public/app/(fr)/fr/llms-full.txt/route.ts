import { llmsFull, textResponse } from '@/lib/llms';

export const revalidate = false;

export async function GET() {
  return textResponse(await llmsFull('fr'));
}
