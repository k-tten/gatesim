export class StorageManager {
    static readonly prefix = "k-tten.gatesim:";

    static readonly storage =
        typeof window !== "undefined"
            ? window.localStorage
            : ({
                  clear() {},
                  getItem: () => null,
                  key: () => null,
                  length: 0,
                  removeItem() {},
                  setItem() {},
              } satisfies Storage);

    static set<T>(key: string, value: T): T {
        this.storage.setItem(this.prefix + key, JSON.stringify(value));

        return value;
    }

    static get<T>(key: string): T | undefined {
        return JSON.parse(this.storage.getItem(this.prefix + key)!) ?? undefined;
    }

    static has(key: string): boolean {
        return this.storage.getItem(this.prefix + key) !== null;
    }

    static delete(key: string) {
        if (this.storage.getItem(this.prefix + key) === null) return false;

        this.storage.removeItem(this.prefix + key);

        return true;
    }
}
