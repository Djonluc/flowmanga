import Database from "@tauri-apps/plugin-sql";

let db: Database | null = null;

export const initDatabase = async () => {
  if (db) return db;

  // console.log('[DB] Loading SQLite database: flowmanga.db');
  try {
    // flowmanga.db will be created in the app's local data directory
    db = await Database.load("sqlite:flowmanga.db");
    // console.log('[DB] SQL Plugin loaded successfully');

    // Enable foreign key enforcement (OFF by default in SQLite)
    await db.execute("PRAGMA foreign_keys = ON");
  } catch (err) {
    console.error("[DB] CRITICAL ERROR loading database:", err);
    throw err;
  }

  // Create Tables
  await db.execute(`
    CREATE TABLE IF NOT EXISTS Series (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      path TEXT UNIQUE,
      author TEXT,
      type TEXT NOT NULL, -- 'manga' | 'video'
      coverPath TEXT,
      source TEXT, -- 'local' | 'scraped'
      tags TEXT DEFAULT '',
      description TEXT,
      seriesUrl TEXT,
      mangaId TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Chapters (
      id TEXT PRIMARY KEY,
      seriesId TEXT NOT NULL,
      title TEXT NOT NULL,
      chapterNumber REAL NOT NULL,
      filePath TEXT NOT NULL,
      totalPages INTEGER,
      coverPath TEXT,
      sourceId TEXT, -- Original source UUID or URL for repairs
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seriesId) REFERENCES Series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS ReadingProgress (
      id TEXT PRIMARY KEY,
      seriesId TEXT NOT NULL,
      chapterId TEXT,
      currentPage INTEGER DEFAULT 0,
      totalPages INTEGER DEFAULT 0,
      lastReadAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (seriesId) REFERENCES Series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS VideoFolders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      path TEXT NOT NULL UNIQUE,
      shuffleEnabled BOOLEAN DEFAULT 0,
      repeatMode TEXT DEFAULT 'off', -- 'off' | 'one' | 'all'
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Videos (
      id TEXT PRIMARY KEY,
      folderId TEXT NOT NULL,
      filePath TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      duration REAL,
      resolution TEXT,
      thumbnailPath TEXT,
      lastPosition REAL DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folderId) REFERENCES VideoFolders(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS Collections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      coverPath TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS CollectionItems (
      collectionId TEXT NOT NULL,
      seriesId TEXT NOT NULL,
      addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collectionId, seriesId),
      FOREIGN KEY (collectionId) REFERENCES Collections(id) ON DELETE CASCADE,
      FOREIGN KEY (seriesId) REFERENCES Series(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS DiscoveryCache (
      id TEXT PRIMARY KEY, -- identifier like 'trending' or 'search:{query}'
      type TEXT NOT NULL, -- 'trending' | 'latest' | 'search'
      results TEXT NOT NULL, -- JSON stringified SourceSearchResult[]
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS TagIndex (
      tagName TEXT NOT NULL,
      sourceId TEXT NOT NULL,
      sourceTagName TEXT NOT NULL,
      PRIMARY KEY (tagName, sourceId)
    );

    CREATE TABLE IF NOT EXISTS TagDefinitions (
      tag TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      parsedBody TEXT NOT NULL,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FavoriteTags (
      tag TEXT PRIMARY KEY,
      usageCount INTEGER DEFAULT 1,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Flow Image Engine Collections
    CREATE TABLE IF NOT EXISTS FlowSavedFolders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      coverUrl TEXT,
      query TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FlowSavedImages (
      id TEXT PRIMARY KEY,
      folderId TEXT,
      sourceId TEXT NOT NULL,
      providerId TEXT NOT NULL,
      fullUrl TEXT NOT NULL,
      sampleUrl TEXT,
      thumbnailUrl TEXT,
      width INTEGER,
      height INTEGER,
      tags TEXT,
      rating TEXT,
      score INTEGER,
      sourceUrl TEXT,
      artistTags TEXT,
      characterTags TEXT,
      copyrightTags TEXT,
      generalTags TEXT,
      metaTags TEXT,
      isLocal BOOLEAN DEFAULT 0,
      localPath TEXT,
      mediaType TEXT,
      sourceMetadata TEXT,
      savedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (folderId) REFERENCES FlowSavedFolders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS FlowPlaylists (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      query TEXT NOT NULL,
      coverUrl TEXT,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    -- Gallery Ecosystem Tables
    CREATE TABLE IF NOT EXISTS GalleryImages (
      id TEXT PRIMARY KEY,
      imageUrl TEXT NOT NULL,
      previewUrl TEXT,
      tags TEXT DEFAULT '',
      source TEXT DEFAULT 'zerochan',
      rating TEXT DEFAULT 'safe',
      width INTEGER,
      height INTEGER,
      dominantColor TEXT,
      aesthetic TEXT,
      artist TEXT,
      savedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      liked BOOLEAN DEFAULT 0,
      folderId TEXT,
      zerochanId INTEGER,
      generalTags TEXT,
      characterTags TEXT,
      copyrightTags TEXT,
      artistTags TEXT,
      metaTags TEXT,
      FOREIGN KEY (folderId) REFERENCES GalleryFolders(id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS GalleryFolders (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      coverUrl TEXT,
      pinned BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS FavoriteTags (
      tag TEXT PRIMARY KEY,
      addedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      usageCount INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS GalleryHistory (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      imageId TEXT,
      tag TEXT,
      action TEXT NOT NULL,
      timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS Slideshows (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT DEFAULT '',
      folderId TEXT,
      transition TEXT DEFAULT 'fade',
      interval INTEGER DEFAULT 5000,
      shuffle BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS LocalFolders (
      id TEXT PRIMARY KEY,
      path TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS UserSmartCollections (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      tags TEXT NOT NULL,
      pinned BOOLEAN DEFAULT 0,
      createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
      updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration: Ensure lastPosition exists for existing databases

  try {
    await db.execute(
      "ALTER TABLE Videos ADD COLUMN lastPosition REAL DEFAULT 0",
    );
  } catch (e) {}

  try {
    await db.execute('ALTER TABLE Series ADD COLUMN tags TEXT DEFAULT ""');
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN description TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN seriesUrl TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN mangaId TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Chapters ADD COLUMN coverPath TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Chapters ADD COLUMN sourceId TEXT");
  } catch (e) {}
  try {
    await db.execute("ALTER TABLE Series ADD COLUMN anilistId TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN malId TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN kitsuId TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN alternativeTitles TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN japaneseTitle TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN englishTitle TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN genres TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN themes TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN publisher TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN status TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN releaseDate TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN artist TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN confidenceScore REAL");
  } catch (e) {}

  // Phase 1: Source Provider Architecture — content type classification
  try {
    await db.execute(
      "ALTER TABLE Series ADD COLUMN contentType TEXT DEFAULT 'manga'",
    );
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN providerId TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE Series ADD COLUMN displayTitle TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE GalleryImages ADD COLUMN generalTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE GalleryImages ADD COLUMN characterTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE GalleryImages ADD COLUMN copyrightTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE GalleryImages ADD COLUMN artistTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE GalleryImages ADD COLUMN metaTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN artistTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN characterTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN copyrightTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN generalTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN metaTags TEXT");
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN sourceMetadata TEXT");
  } catch (e) {}

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS GallerySettings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      )
    `);
  } catch (e) {}

  // ─── Flow Image Engine (New Rebuild) ───────────────────────────
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS FlowImages (
        id TEXT PRIMARY KEY,
        sourceId TEXT NOT NULL,
        providerId TEXT NOT NULL,
        thumbnailUrl TEXT NOT NULL,
        sampleUrl TEXT NOT NULL,
        fullUrl TEXT NOT NULL,
        width INTEGER NOT NULL,
        height INTEGER NOT NULL,
        aspectRatio REAL NOT NULL,
        tags TEXT DEFAULT '',
        rating TEXT DEFAULT 'safe',
        score INTEGER DEFAULT 0,
        sourceUrl TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        isLocal BOOLEAN DEFAULT 0,
        localPath TEXT
      );

      CREATE TABLE IF NOT EXISTS FlowPlaylists (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        query TEXT NOT NULL,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        lastPlayedAt DATETIME
      );

      CREATE TABLE IF NOT EXISTS FlowHistory (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        query TEXT NOT NULL,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS TagAliases (
        alias TEXT PRIMARY KEY,
        canonicalTag TEXT NOT NULL,
        confidence INTEGER DEFAULT 100,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS UserInterests (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'dominant_tag', 'supporting_tag', 'artist', 'character', 'series'
        name TEXT NOT NULL,
        score REAL DEFAULT 0,
        isPinned BOOLEAN DEFAULT 0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        updatedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, name)
      );

      CREATE TABLE IF NOT EXISTS FollowedEntities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'tag', 'artist', 'character', 'series'
        name TEXT NOT NULL,
        followedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, name)
      );
    `);
  } catch (e) {
    console.error("[DB] Failed to create Flow Image Engine tables", e);
  }

  // ─── Manga Intelligence Engine (Phase 1) ────────────────────────
  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS MangaTagCategories (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS MangaTagRelationships (
        id TEXT PRIMARY KEY,
        parentTag TEXT NOT NULL,
        childTag TEXT NOT NULL,
        type TEXT DEFAULT 'belongs_to',
        UNIQUE(parentTag, childTag)
      );

      CREATE TABLE IF NOT EXISTS MangaTagSynonyms (
        canonicalTag TEXT NOT NULL,
        synonym TEXT NOT NULL,
        PRIMARY KEY (canonicalTag, synonym)
      );

      CREATE TABLE IF NOT EXISTS MangaTagAliases (
        alias TEXT PRIMARY KEY,
        canonicalTag TEXT NOT NULL,
        confidence INTEGER DEFAULT 100
      );

      CREATE TABLE IF NOT EXISTS MangaInterestProfiles (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'dominant', 'supporting'
        name TEXT NOT NULL,
        weight REAL DEFAULT 1.0,
        createdAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, name)
      );

      CREATE TABLE IF NOT EXISTS MangaFollowedEntities (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL, -- 'manga', 'character', 'author', 'publisher', 'studio', 'franchise', 'genre', 'tag', 'series'
        name TEXT NOT NULL,
        entityId TEXT,
        followedAt DATETIME DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(type, name)
      );
    `);
  } catch (e) {
    console.error("[DB] Failed to create Manga Intelligence tables", e);
  }

  // Invalidate old discovery caches on startup to prevent type mismatch crashes with new mapped schemas
  try {
    await db.execute("DELETE FROM DiscoveryCache");
  } catch (e) {}

  try {
    const flowTableInfo = await db.select<any[]>("PRAGMA table_info(FlowSavedFolders)");
    const hasQueryColumn = flowTableInfo.some(col => col.name === 'query');
    if (!hasQueryColumn) {
      await db.execute("ALTER TABLE FlowSavedFolders ADD COLUMN query TEXT");
    }
  } catch (e) {
    console.error("Migration failed:", e);
  }

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN localPath TEXT;");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN mediaType TEXT;");
  } catch (e) {
    // Column already exists, ignore
  }

  try {
    await db.execute("ALTER TABLE FlowSavedImages ADD COLUMN sortOrder INTEGER DEFAULT 0;");
    // Initialize sortOrder based on rowid/createdAt for existing images
    await db.execute(`
      WITH Ordered AS (
        SELECT id, row_number() OVER (ORDER BY savedAt ASC) as new_order
        FROM FlowSavedImages
      )
      UPDATE FlowSavedImages 
      SET sortOrder = (SELECT new_order FROM Ordered WHERE Ordered.id = FlowSavedImages.id)
      WHERE sortOrder = 0;
    `);
  } catch (e) {}

  try {
    await db.execute(`
      CREATE TABLE IF NOT EXISTS FlowSeenImages (
        id TEXT PRIMARY KEY,
        sourceId TEXT,
        providerId TEXT,
        seenAt DATETIME DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {}

  try {
    await db.execute("ALTER TABLE FlowPlaylists ADD COLUMN coverUrl TEXT;");
  } catch (e) {}

  // console.log('[DB] Database initialized successfully');
  return db;
};

export const getDb = () => {
  if (!db)
    throw new Error("Database not initialized. Call initDatabase() first.");
  return db;
};
