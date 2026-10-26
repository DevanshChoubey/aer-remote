export interface Channels {
  reply: string;
  command: string;
  schedule: string;
}

export const SERVICE_UUID = '6e400000-b5a3-f393-e0a9-e50e24dcca9e';

export const charUuid = (suffix: '0001' | '0002' | '0003' | '0004'): string =>
  `6e40${suffix}-b5a3-f393-e0a9-e50e24dcca9e`;

export const DEFAULT_CHANNELS: Channels = {
  reply: charUuid('0001'),
  command: charUuid('0003'),
  schedule: charUuid('0004'),
};
