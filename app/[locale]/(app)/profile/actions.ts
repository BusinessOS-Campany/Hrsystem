"use server";

import { revalidatePath } from "next/cache";
import { revokeSessionAction, type ActionResult } from "@/lib/auth/actions";

export async function revokeSessionFormAction(
  locale: string,
  sessionId: string,
): Promise<ActionResult> {
  const result = await revokeSessionAction(sessionId);
  if (result.ok) revalidatePath(`/${locale}/profile`);
  return result;
}
