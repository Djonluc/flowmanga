import type { ImageMedia } from "./types";

export interface SavedCollection {
  id: string;
  name: string;
  description: string;
  items: string[]; // ImageMedia IDs
}

export class CollectionEngine {
  private savedItems = new Map<string, ImageMedia>();
  private collections = new Map<string, SavedCollection>();

  /**
   * Saves an item to local storage.
   */
  async saveItem(item: ImageMedia): Promise<void> {
    this.savedItems.set(item.id, item);
    // In a real app, this would persist to Tauri SQLite or IndexedDB
  }

  /**
   * Removes an item from local storage.
   */
  async removeItem(id: string): Promise<void> {
    this.savedItems.delete(id);
    
    // Also remove from any collections
    for (const [colId, collection] of this.collections.entries()) {
      if (collection.items.includes(id)) {
        collection.items = collection.items.filter(i => i !== id);
        this.collections.set(colId, collection);
      }
    }
  }

  /**
   * Returns all saved items.
   */
  async getSavedItems(): Promise<ImageMedia[]> {
    return Array.from(this.savedItems.values());
  }

  /**
   * Checks if an item is saved.
   */
  isSaved(id: string): boolean {
    return this.savedItems.has(id);
  }

  // --- Collection Management ---

  async createCollection(name: string, description: string = ""): Promise<string> {
    const id = `col_${Date.now()}`;
    this.collections.set(id, { id, name, description, items: [] });
    return id;
  }

  async addToCollection(collectionId: string, itemId: string): Promise<void> {
    const collection = this.collections.get(collectionId);
    if (collection && !collection.items.includes(itemId)) {
      collection.items.push(itemId);
    }
  }

  async getCollectionItems(collectionId: string): Promise<ImageMedia[]> {
    const collection = this.collections.get(collectionId);
    if (!collection) return [];
    
    return collection.items
      .map(id => this.savedItems.get(id))
      .filter((item): item is ImageMedia => item !== undefined);
  }
}
