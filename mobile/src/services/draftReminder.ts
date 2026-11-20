import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';

const CHANNEL_ID = 'draft-reminders';
const REMINDER_DELAY_SECONDS = 60 * 60;

export type ReminderPermission = 'granted' | 'denied' | 'blocked';

export function reminderIdentifier(farmId: string, fieldId: string): string {
  return `agriops.draft.${farmId.replace(/[^a-zA-Z0-9-]/g, '')}.${fieldId.replace(/[^a-zA-Z0-9-]/g, '')}`;
}

export async function requestReminderPermission(): Promise<ReminderPermission> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Przypomnienia o szkicach próbek',
      importance: Notifications.AndroidImportance.DEFAULT,
      lockscreenVisibility: Notifications.AndroidNotificationVisibility.SECRET,
    });
  }
  const current = await Notifications.getPermissionsAsync();
  if (current.granted) return 'granted';
  if (!current.canAskAgain) return 'blocked';
  const asked = await Notifications.requestPermissionsAsync();
  if (asked.granted) return 'granted';
  return asked.canAskAgain ? 'denied' : 'blocked';
}

// Treść jest celowo ogólna: bez nazwy pola, współrzędnych ani wyników badań.
export async function scheduleDraftReminder(farmId: string, fieldId: string): Promise<void> {
  const identifier = reminderIdentifier(farmId, fieldId);
  await Notifications.cancelScheduledNotificationAsync(identifier).catch(() => {});
  await Notifications.scheduleNotificationAsync({
    identifier,
    content: {
      title: 'AgriOps Mobile',
      body: 'Masz niedokończony szkic próbki gleby. Otwórz aplikację, aby go wysłać.',
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: REMINDER_DELAY_SECONDS,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelDraftReminder(farmId: string, fieldId: string): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(reminderIdentifier(farmId, fieldId)).catch(() => {});
}
