import { copyFile, mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function saveJson<T>(file: string, data: T): Promise<void> {
  await mkdir(dirname(file), { recursive: true });
  const temporaryFile = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  await writeFile(temporaryFile, `${JSON.stringify(data, null, 2)}\n`, "utf8");
  try { await copyFile(file, `${file}.bak`); } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  await rename(temporaryFile, file);
}

export async function loadJson<T>(
  file: string,
  fallback: T
): Promise<T> {
  try {
    const content = await readFile(file, "utf8");

    return JSON.parse(content) as T;
  } catch (error: unknown) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }

    await saveJson(file, fallback);

    return fallback;
  }
}

export type JsonStore<T> = {
  load(): Promise<T[]>;
  save(items: T[]): Promise<void>;
};

export function createJsonStore<T>(file: string, fallback: T[] = []): JsonStore<T> {
  let queue = Promise.resolve();
  return {
    load: () => loadJson(file, fallback),
    save(items) {
      queue = queue.then(() => saveJson(file, items));
      return queue;
    },
  };
}
