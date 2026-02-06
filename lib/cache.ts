import { LRUCache } from "lru-cache";

class CacheService {
  private cardsCache: LRUCache<string, any>;
  private hoursCache: LRUCache<string, any>;

  constructor() {
    this.cardsCache = new LRUCache({
      max: 500,
      ttl: 60 * 60 * 1000,
      updateAgeOnGet: true,
    });

    this.hoursCache = new LRUCache({
      max: 200,
      ttl: 60 * 60 * 2 * 1000, // 2 hours
      updateAgeOnGet: true,
    });
  }

  getCards(key: string) {
    return this.cardsCache.get(key);
  }

  setCards(key: string, value: any) {
    this.cardsCache.set(key, value);
  }

  getHours(key: string) {
    return this.hoursCache.get(key);
  }

  setHours(key: string, value: any) {
    this.hoursCache.set(key, value);
  }

  clearAll() {
    this.cardsCache.clear();
    this.hoursCache.clear();
  }

  getStats() {
    return {
      cards: {
        size: this.cardsCache.size,
        max: this.cardsCache.max,
      },
      hours: {
        size: this.hoursCache.size,
        max: this.hoursCache.max,
      },
    };
  }
}

export const cache = new CacheService();
