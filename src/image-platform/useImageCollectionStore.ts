import { create } from "zustand";
import { getDb } from "../services/db";
import type { PlatformImage } from "./types";

interface FlowImageFolder {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  createdAt: string;
}

interface ImageCollectionState {
  folders: FlowImageFolder[];
  savedImages: PlatformImage[];
  isLoading: boolean;
  
  loadFolders: () => Promise<void>;
  loadSavedImages: (folderId?: string | null) => Promise<void>;
  createFolder: (name: string, description?: string) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  saveImage: (image: PlatformImage, folderId?: string | null) => Promise<void>;
  removeSavedImage: (id: string) => Promise<void>;
}

export const useImageCollectionStore = create<ImageCollectionState>((set, get) => ({
  folders: [],
  savedImages: [],
  isLoading: false,

  loadFolders: async () => {
    try {
      const db = getDb();
      const folders = await db.select<FlowImageFolder[]>("SELECT * FROM FlowSavedFolders ORDER BY createdAt DESC");
      set({ folders });
    } catch (e) {
      console.error(e);
    }
  },

  loadSavedImages: async (folderId = null) => {
    set({ isLoading: true });
    try {
      const db = getDb();
      let rows: any[];
      if (folderId) {
        rows = await db.select("SELECT * FROM FlowSavedImages WHERE folderId = ? ORDER BY savedAt DESC", [folderId]);
      } else {
        rows = await db.select("SELECT * FROM FlowSavedImages ORDER BY savedAt DESC");
      }
      
      const parsedImages: PlatformImage[] = rows.map(row => ({
        id: row.id,
        sourceId: row.sourceId,
        providerId: row.providerId,
        fullUrl: row.fullUrl,
        sampleUrl: row.sampleUrl,
        thumbnailUrl: row.thumbnailUrl,
        width: row.width,
        height: row.height,
        tags: row.tags ? JSON.parse(row.tags) : [],
        rating: row.rating,
        score: row.score,
        sourceUrl: row.sourceUrl,
        createdAt: new Date(row.savedAt).getTime(),
        isLocal: row.isLocal === 1
      }));
      
      set({ savedImages: parsedImages, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  createFolder: async (name, description = "") => {
    try {
      const db = getDb();
      const id = crypto.randomUUID();
      await db.execute(
        "INSERT INTO FlowSavedFolders (id, name, description) VALUES (?, ?, ?)",
        [id, name, description]
      );
      await get().loadFolders();
    } catch (e) {
      console.error(e);
    }
  },

  deleteFolder: async (id) => {
    try {
      const db = getDb();
      await db.execute("DELETE FROM FlowSavedFolders WHERE id = ?", [id]);
      await get().loadFolders();
    } catch (e) {
      console.error(e);
    }
  },

  saveImage: async (image, folderId = null) => {
    try {
      const db = getDb();
      await db.execute(
        `INSERT OR REPLACE INTO FlowSavedImages 
        (id, folderId, sourceId, providerId, fullUrl, sampleUrl, thumbnailUrl, width, height, tags, rating, score, sourceUrl, isLocal) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          image.id,
          folderId,
          image.sourceId,
          image.providerId,
          image.fullUrl,
          image.sampleUrl,
          image.thumbnailUrl,
          image.width,
          image.height,
          JSON.stringify(image.tags),
          image.rating,
          image.score,
          image.sourceUrl,
          image.isLocal ? 1 : 0
        ]
      );
      // Update cover url of the folder if it's the first image
      if (folderId) {
        const folder = get().folders.find(f => f.id === folderId);
        if (folder && !folder.coverUrl) {
          await db.execute("UPDATE FlowSavedFolders SET coverUrl = ? WHERE id = ?", [image.sampleUrl || image.fullUrl, folderId]);
        }
      }
      await get().loadSavedImages(folderId);
      await get().loadFolders(); // Refresh folders to show updated cover URL
    } catch (e) {
      console.error(e);
    }
  },

  removeSavedImage: async (id) => {
    try {
      const db = getDb();
      await db.execute("DELETE FROM FlowSavedImages WHERE id = ?", [id]);
      await get().loadSavedImages();
    } catch (e) {
      console.error(e);
    }
  }
}));
