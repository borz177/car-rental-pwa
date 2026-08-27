import webpush from 'web-push';
import { Pool } from 'pg';

const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY;
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY;
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@example.com';

const configured = !!(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);
if (configured) {
  webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY!, VAPID_PRIVATE_KEY!);
} else {
  console.warn('[push] VAPID-ключи не заданы — push-уведомления отправляться не будут');
}

export function getVapidPublicKey(): string | null {
  return VAPID_PUBLIC_KEY || null;
}

interface PushPayload {
  title: string;
  body: string;
  link?: string;
}

// Шлёт push всем подпискам пользователя (у него может быть несколько устройств/браузеров).
// Просроченные подписки (браузер отписался, профиль удалён и т.п.) тихо удаляются —
// это штатный ответ пуш-сервиса, не повод шуметь в логах при каждой отправке.
export async function sendPushToUser(pool: Pool, userId: string, payload: PushPayload): Promise<void> {
  if (!configured) return;
  try {
    const { rows } = await pool.query(
      'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
      [userId]
    );
    await Promise.all(rows.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          JSON.stringify(payload)
        );
      } catch (err: any) {
        if (err.statusCode === 404 || err.statusCode === 410) {
          await pool.query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
        } else {
          console.error('[push] Ошибка отправки:', err.message);
        }
      }
    }));
  } catch (err: any) {
    console.error('[push] Ошибка выборки подписок:', err.message);
  }
}
