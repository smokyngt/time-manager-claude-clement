import { llmsOutput, textResponse } from '@/lib/llms';

export const revalidate = false;

export async function GET() {
  return textResponse(await llmsOutput.index('en'));
}
