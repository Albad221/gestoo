/**
 * Holehe Integration - Check email registration on 120+ sites
 * Uses Python holehe library via subprocess
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export interface HoleheResult {
  name: string;
  exists: boolean;
  emailRecovery?: string | null;
  phoneNumber?: string | null;
  url: string;
}

export interface HoleheResponse {
  email: string;
  found: HoleheResult[];
  count: number;
  error?: string;
}

/**
 * Check email against 120+ websites using Holehe
 */
export async function checkEmailWithHolehe(email: string): Promise<HoleheResult[]> {
  try {
    const scriptPath = path.join(process.cwd(), 'scripts', 'holehe-check.py');

    const { stdout, stderr } = await execAsync(
      `python3 "${scriptPath}" "${email}"`,
      { timeout: 120000 } // 2 minute timeout
    );

    // Parse JSON output
    const result: HoleheResponse = JSON.parse(stdout.trim());

    if (result.error) {
      console.error('Holehe error:', result.error);
      return [];
    }

    return result.found || [];
  } catch (error) {
    console.error('Holehe execution error:', error);
    return [];
  }
}

/**
 * Quick check - only run fast modules
 */
export async function quickHoleheCheck(email: string): Promise<HoleheResult[]> {
  // For quick check, we'll just run the full check with timeout
  // In future, could optimize to only run specific fast modules
  return checkEmailWithHolehe(email);
}
