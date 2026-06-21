import { create } from "zustand";
import { getDb } from "../services/db";
import type { PlatformImage } from "./types";
import { TagIntelligenceService } from "./services/TagIntelligenceService";
import { exists } from '@tauri-apps/plugin-fs';
import { join, pictureDir } from '@tauri-apps/api/path';
import { useSettingsStore } from "../stores/useSettingsStore";

interface FlowImageFolder {
  id: string;
  name: string;
  description: string | null;
  coverUrl: string | null;
  query: string | null;
  createdAt: string;
}

interface ImageCollectionState {
  folders: FlowImageFolder[];
  savedImages: PlatformImage[];
  isLoading: boolean;
  autoOrganizeMode: "disabled" | "series_only" | "character_only" | "series_character";
  
  setAutoOrganizeMode: (mode: "disabled" | "series_only" | "character_only" | "series_character") => void;
  loadFolders: () => Promise<void>;
  loadSavedImages: (folderId?: string | null) => Promise<void>;
  createFolder: (name: string, description?: string) => Promise<void>;
  updateFolder: (id: string, updates: Partial<FlowImageFolder>) => Promise<void>;
  deleteFolder: (id: string) => Promise<void>;
  saveImage: (image: PlatformImage, folderId?: string | null) => Promise<void>;
  updateLocalPath: (id: string, localPath: string) => Promise<void>;
  removeSavedImage: (id: string) => Promise<void>;
  refreshMetadata: (id: string) => Promise<boolean>;
  refreshAllMetadata: () => Promise<void>;
  recheckLocalFiles: () => Promise<{ found: number, totalChecked: number }>;
  retroOrganizeLibrary: () => Promise<{ scanned: number; assigned: number; created: number; skipped: number } | null>;
  batchSaveImages: (images: PlatformImage[], folderId: string) => Promise<number>;
  reorderImage: (draggedId: string, dropId: string) => Promise<void>;
}

export const useImageCollectionStore = create<ImageCollectionState>((set, get) => ({
  folders: [],
  savedImages: [],
  isLoading: false,
  autoOrganizeMode: (localStorage.getItem("flowmanga_auto_organize") as any) || "series_character",

  setAutoOrganizeMode: (mode) => {
    localStorage.setItem("flowmanga_auto_organize", mode);
    set({ autoOrganizeMode: mode });
  },

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
        rows = await db.select("SELECT * FROM FlowSavedImages WHERE folderId = ? ORDER BY sortOrder ASC, savedAt DESC", [folderId]);
      } else {
        rows = await db.select("SELECT * FROM FlowSavedImages ORDER BY sortOrder ASC, savedAt DESC");
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
        aspectRatio: (row.width && row.height) ? (row.width / row.height) : 1,
        tags: row.tags ? JSON.parse(row.tags) : [],
        rating: row.rating,
        score: row.score,
        sourceUrl: row.sourceUrl,
        createdAt: new Date(row.savedAt).getTime(),
        isLocal: row.isLocal === 1,
        localPath: row.localPath,
        mediaType: row.mediaType,
        folderId: row.folderId
      }));
      
      set({ savedImages: parsedImages, isLoading: false });
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
    }
  },

  createFolder: async (name, description = null) => {
    try {
      const db = getDb();
      const id = crypto.randomUUID();
      await db.execute(
        "INSERT INTO FlowSavedFolders (id, name, description, coverUrl, query) VALUES (?, ?, ?, null, null)",
        [id, name, description]
      );
      get().loadFolders();
    } catch (e) {
      console.error(e);
    }
  },

  updateFolder: async (id: string, updates: Partial<FlowImageFolder>) => {
    try {
      const db = getDb();
      const folder = get().folders.find(f => f.id === id);
      if (!folder) return;

      const merged = { ...folder, ...updates };
      await db.execute(
        "UPDATE FlowSavedFolders SET name = ?, description = ?, coverUrl = ?, query = ? WHERE id = ?",
        [merged.name, merged.description, merged.coverUrl, merged.query, id]
      );
      get().loadFolders();
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

  saveImage: async (image, providedFolderId = null) => {
    try {
      const db = getDb();
      const state = get();
      
      let folderId = providedFolderId;

      // Smart Auto Organization logic
      if (!folderId && state.autoOrganizeMode !== "disabled") {
        let targetFolderName: string | null = null;
        const tags = image.tags || [];

        const seriesTags = tags.filter(t => t.startsWith('series:') || t.startsWith('copyright:'));
        const charTags = tags.filter(t => t.startsWith('character:'));

        if ((state.autoOrganizeMode === "series_only" || state.autoOrganizeMode === "series_character") && seriesTags.length > 0) {
          targetFolderName = seriesTags[0].split(':')[1].replace(/_/g, ' ');
        } else if ((state.autoOrganizeMode === "character_only" || state.autoOrganizeMode === "series_character") && charTags.length > 0) {
          targetFolderName = charTags[0].split(':')[1].replace(/_/g, ' ');
        }

        if (targetFolderName) {
          targetFolderName = targetFolderName.replace(/\b\w/g, c => c.toUpperCase()); // Capitalize
          let folder = state.folders.find(f => f.name.toLowerCase() === targetFolderName!.toLowerCase());
          
          if (!folder) {
            const newId = crypto.randomUUID();
            await db.execute(
              "INSERT INTO FlowSavedFolders (id, name, description) VALUES (?, ?, ?)",
              [newId, targetFolderName, "Auto-created folder"]
            );
            folderId = newId;
            await state.loadFolders(); // Refresh folders so it's in state
          } else {
            folderId = folder.id;
          }
        }
      }

      await db.execute(
        `INSERT OR REPLACE INTO FlowSavedImages 
        (id, folderId, sourceId, providerId, fullUrl, sampleUrl, thumbnailUrl, width, height, tags, rating, score, sourceUrl, isLocal, localPath, mediaType) 
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
          image.isLocal ? 1 : 0,
          image.localPath || null,
          image.mediaType || null
        ]
      );
      // Update cover url of the folder if it's the first image
      if (folderId) {
        const folder = get().folders.find(f => f.id === folderId);
        if (folder && !folder.coverUrl) {
          await db.execute("UPDATE FlowSavedFolders SET coverUrl = ? WHERE id = ?", [image.sampleUrl || image.fullUrl, folderId]);
        }
      }
      
      // Update Interest Manager incrementally
      const tagsWithMedia = [...(image.tags || [])];
      if (image.mediaType) {
        tagsWithMedia.push(`media_type:${image.mediaType}`);
      }
      TagIntelligenceService.processImageTags(tagsWithMedia, 'add').catch(console.error);

      await get().loadSavedImages(folderId);
      await get().loadFolders(); // Refresh folders to show updated cover URL
    } catch (e) {
      console.error(e);
    }
  },

  updateLocalPath: async (id: string, localPath: string | null) => {
    try {
      const db = getDb();
      await db.execute("UPDATE FlowSavedImages SET localPath = ?, isLocal = ? WHERE id = ?", [localPath, localPath ? 1 : 0, id]);
      
      // Update state if needed
      set(state => ({
        savedImages: state.savedImages.map(img => 
          img.id === id ? { ...img, localPath: localPath || undefined, isLocal: !!localPath } : img
        )
      }));
    } catch (e) {
      console.error("[useImageCollectionStore] Failed to update local path", e);
    }
  },

  recheckLocalFiles: async () => {
    let found = 0;
    let totalChecked = 0;
    try {
      const db = getDb();
      // Only check images that don't have a local path yet
      const rows = await db.select<any[]>("SELECT * FROM FlowSavedImages WHERE localPath IS NULL");
      
      if (rows.length === 0) return { found, totalChecked };

      let saveDirectory = useSettingsStore.getState().imageDownloadPath;
      if (!saveDirectory) {
        const picsDir = await pictureDir();
        saveDirectory = await join(picsDir, "FlowManga", "Images");
      }

      const possibleExts = ["jpg", "png", "gif", "mp4", "webm", "zip", "webp", "jpeg"];

      for (const row of rows) {
        totalChecked++;
        for (const ext of possibleExts) {
          const checkPath = await join(saveDirectory, `${row.providerId}-${row.sourceId}.${ext}`);
          if (await exists(checkPath)) {
            // Found it! Update database
            await db.execute("UPDATE FlowSavedImages SET localPath = ?, isLocal = 1 WHERE id = ?", [checkPath, row.id]);
            found++;
            break; // Stop checking extensions for this file
          }
        }
      }

      if (found > 0) {
        await get().loadSavedImages(); // Refresh the state
      }

    } catch (e) {
      console.error("[useImageCollectionStore] Recheck failed", e);
    }
    return { found, totalChecked };
  },

  removeSavedImage: async (id) => {
    try {
      const db = getDb();
      
      // Get tags before deleting so we can decrement user interests
      const existing = await db.select<{tags: string, mediaType: string}>("SELECT tags, mediaType FROM FlowSavedImages WHERE id = ?", [id]);
      if (existing.length > 0) {
        const tags = JSON.parse(existing[0].tags || "[]");
        if (existing[0].mediaType) {
          tags.push(`media_type:${existing[0].mediaType}`);
        }
        TagIntelligenceService.processImageTags(tags, 'remove').catch(console.error);
      }

      await db.execute("DELETE FROM FlowSavedImages WHERE id = ?", [id]);
      await get().loadSavedImages();
    } catch (e) {
      console.error(e);
    }
  },

  refreshMetadata: async (id) => {
    try {
      const state = get();
      const image = state.savedImages.find(img => img.id === id);
      if (!image) return false;

      const { federator } = await import("./SearchFederator");
      const freshImage = await federator.getById(image.providerId, image.sourceId);
      
      if (freshImage && freshImage.tags.length > 0) {
        const db = getDb();
        await db.execute(
          "UPDATE FlowSavedImages SET tags = ?, rating = ?, score = ? WHERE id = ?",
          [JSON.stringify(freshImage.tags), freshImage.rating, freshImage.score, image.id]
        );
        
        // Update local state without full reload
        const updatedImages = state.savedImages.map(img => 
          img.id === id ? { ...img, tags: freshImage.tags, rating: freshImage.rating, score: freshImage.score } : img
        );
        set({ savedImages: updatedImages });
        return true;
      }
      return false;
    } catch (e) {
      console.error("Refresh metadata failed", e);
      return false;
    }
  },

  refreshAllMetadata: async () => {
    set({ isLoading: true });
    try {
      const state = get();
      const { federator } = await import("./SearchFederator");
      const db = getDb();
      
      const updatedImages = [...state.savedImages];
      let updatedCount = 0;

      // Process in batches or one by one to avoid overwhelming APIs
      for (let i = 0; i < state.savedImages.length; i++) {
        const image = state.savedImages[i];
        
        // Add artificial delay to respect rate limits (Danbooru restricts to ~2-3 requests/sec)
        await new Promise(r => setTimeout(r, 400));

        const freshImage = await federator.getById(image.providerId, image.sourceId);
        
        if (freshImage && freshImage.tags.length > 0) {
          await db.execute(
            "UPDATE FlowSavedImages SET tags = ?, rating = ?, score = ? WHERE id = ?",
            [JSON.stringify(freshImage.tags), freshImage.rating, freshImage.score, image.id]
          );
          updatedImages[i] = { ...image, tags: freshImage.tags, rating: freshImage.rating, score: freshImage.score };
          updatedCount++;
        }
        
        // Update UI periodically so user sees progress
        if (updatedCount > 0 && updatedCount % 10 === 0) {
          set({ savedImages: [...updatedImages] });
        }
      }
      
      set({ savedImages: updatedImages, isLoading: false });
    } catch (e) {
      console.error("Refresh all metadata failed", e);
      set({ isLoading: false });
    }
  },

  retroOrganizeLibrary: async () => {
    try {
      const state = get();
      if (state.autoOrganizeMode === "disabled") return null;
      
      set({ isLoading: true });
      const db = getDb();
      
      // Get images that aren't already grouped, or just all images. Let's do all images.
      const allImages = await db.select<any[]>("SELECT * FROM FlowSavedImages");
      
      let scanned = allImages.length;
      let assigned = 0;
      let created = 0;
      let skipped = 0;
      // Group images by target folder name first
      const candidateGroups: Record<string, any[]> = {};
      
      for (const row of allImages) {
        const tags: string[] = row.tags ? JSON.parse(row.tags) : [];
        const seriesTags = tags.filter(t => t.startsWith('series:') || t.startsWith('copyright:'));
        const charTags = tags.filter(t => t.startsWith('character:'));

        let targetFolderName: string | null = null;
        if ((state.autoOrganizeMode === "series_only" || state.autoOrganizeMode === "series_character") && seriesTags.length > 0) {
          targetFolderName = seriesTags[0].split(':')[1].replace(/_/g, ' ');
        } else if ((state.autoOrganizeMode === "character_only" || state.autoOrganizeMode === "series_character") && charTags.length > 0) {
          targetFolderName = charTags[0].split(':')[1].replace(/_/g, ' ');
        }

        if (targetFolderName) {
          targetFolderName = targetFolderName.replace(/\b\w/g, c => c.toUpperCase()); // Capitalize
          if (!candidateGroups[targetFolderName]) candidateGroups[targetFolderName] = [];
          candidateGroups[targetFolderName].push(row);
        } else {
          skipped++;
        }
      }

      // Process grouped images, enforcing a minimum threshold of 3 images
      for (const [folderName, rows] of Object.entries(candidateGroups)) {
        if (rows.length < 3) {
          skipped += rows.length;
          continue;
        }

        let folder = get().folders.find(f => f.name.toLowerCase() === folderName.toLowerCase());
        let folderId: string;
        
        if (!folder) {
          folderId = crypto.randomUUID();
          await db.execute(
            "INSERT INTO FlowSavedFolders (id, name, description) VALUES (?, ?, ?)",
            [folderId, folderName, "Auto-created folder"]
          );
          await get().loadFolders(); // Refresh local folder cache
          created++;
        } else {
          folderId = folder.id;
        }

        for (const row of rows) {
          if (row.folderId !== folderId) {
            await db.execute("UPDATE FlowSavedImages SET folderId = ? WHERE id = ?", [folderId, row.id]);
            assigned++;
          } else {
            skipped++;
          }
        }
      }
      
      await get().loadFolders();
      await get().loadSavedImages(null);
      set({ isLoading: false });
      
      return { scanned, assigned, created, skipped };
    } catch (e) {
      console.error(e);
      set({ isLoading: false });
      return null;
    }
  },

  batchSaveImages: async (images, folderId) => {
    try {
      const db = getDb();
      let savedCount = 0;
      for (const image of images) {
        try {
          await db.execute(
            `INSERT OR IGNORE INTO FlowSavedImages 
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
          savedCount++;
        } catch (e) {
          // Skip duplicates silently
        }
      }
      // Update cover if needed
      if (savedCount > 0) {
        const folder = get().folders.find(f => f.id === folderId);
        if (folder && !folder.coverUrl && images[0]) {
          await db.execute("UPDATE FlowSavedFolders SET coverUrl = ? WHERE id = ?", [images[0].sampleUrl || images[0].fullUrl, folderId]);
        }
        await get().loadSavedImages(folderId);
        await get().loadFolders();
      }
      return savedCount;
    } catch (e) {
      console.error("Batch save failed", e);
      return 0;
    }
  },

  reorderImage: async (draggedId: string, dropId: string) => {
    try {
      const db = getDb();
      const state = get();
      const currentList = [...state.savedImages];
      const draggedIdx = currentList.findIndex(i => i.id === draggedId);
      const dropIdx = currentList.findIndex(i => i.id === dropId);
      
      if (draggedIdx === -1 || dropIdx === -1) return;

      // Swap in UI immediately
      const item = currentList.splice(draggedIdx, 1)[0];
      currentList.splice(dropIdx, 0, item);
      set({ savedImages: currentList });

      // Build case statement to update sortOrder for all items in their new order
      let caseStmt = "CASE id ";
      const ids: string[] = [];
      currentList.forEach((img, idx) => {
        caseStmt += `WHEN ? THEN ? `;
        ids.push(img.id, idx.toString());
      });
      caseStmt += "END";

      const placeholders = currentList.map(() => '?').join(',');
      const idsForIn = currentList.map(img => img.id);

      await db.execute(
        `UPDATE FlowSavedImages SET sortOrder = ${caseStmt} WHERE id IN (${placeholders})`,
        [...ids, ...idsForIn]
      );
    } catch (e) {
      console.error("Failed to reorder", e);
    }
  }
}));
