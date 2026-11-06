"use server";

import { revalidatePath } from "next/cache";
import { revokeSessionAction } from "@/lib/auth/actions";

export async function revokeSessionFormAction(
  locale: string,
  sessionId: string,
): Promise<void> {
  await revokeSessionAction(sessionId);
  revalidatePath(`/${locale}/profile`);
}
