import { promises as fs } from 'node:fs';
import path from 'node:path';

const DATA_DIR = path.resolve(__dirname, '../../.data');
const STORE_PATH = path.join(DATA_DIR, 'store.json');

type StorePayload = Record<string, unknown>;

async function ensureDir(): Promise<void> {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readStore(): Promise<StorePayload> {
  try {
    const raw = await fs.readFile(STORE_PATH, 'utf8');
    return JSON.parse(raw) as StorePayload;
  } catch (error) {
    return {};
  }
}

async function writeStore(payload: StorePayload): Promise<void> {
  await ensureDir();
  await fs.writeFile(STORE_PATH, JSON.stringify(payload, null, 2), 'utf8');
}

export async function storeGet<T>(key: string): Promise<T | undefined> {
  const payload = await readStore();
  return payload[key] as T | undefined;
}

export async function storeSet<T>(key: string, value: T): Promise<void> {
  const payload = await readStore();
  payload[key] = value;
  await writeStore(payload);
}

export async function storeDelete(key: string): Promise<void> {
  const payload = await readStore();
  if (key in payload) {
    delete payload[key];
    await writeStore(payload);
  }
}
