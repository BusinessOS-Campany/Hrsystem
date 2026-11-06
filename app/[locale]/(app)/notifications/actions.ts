"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db/prisma";
import { getCurrentUser } from "@/lib/auth/session";

export async function markAllNotificationsReadAction(locale: string): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { userId: user.id, isRead: false },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/${locale}/notifications`);
  revalidatePath(`/${locale}`, "layout");
}

export async function markNotificationReadAction(
  locale: string,
  notificationId: string,
): Promise<void> {
  const user = await getCurrentUser();
  if (!user) return;
  await prisma.notification.updateMany({
    where: { id: notificationId, userId: user.id },
    data: { isRead: true, readAt: new Date() },
  });
  revalidatePath(`/${locale}/notifications`);
  revalidatePath(`/${locale}`, "layout");
}
