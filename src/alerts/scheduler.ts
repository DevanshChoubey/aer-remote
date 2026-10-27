/** 'undetermined' means the app may still ask; 'denied' means the phone will not show the prompt. */
export type AlertPermission = 'granted' | 'denied' | 'undetermined';

export interface ScheduledAlert {
  key: string;
  dispenserId: string;
  at: Date;
  title: string;
  body: string;
}

export interface AlertScheduler {
  permission(): Promise<AlertPermission>;
  requestPermission(): Promise<AlertPermission>;
  /** Only this app's alert keys. */
  pendingKeys(): Promise<string[]>;
  /** Replaces any pending alert with the same key. */
  schedule(a: ScheduledAlert): Promise<void>;
  cancel(key: string): Promise<void>;
  cancelAll(): Promise<void>;
  /** Calls back with the dispenser id when the user taps an alert; returns unsubscribe. */
  onOpen(cb: (dispenserId: string) => void): () => void;
}
