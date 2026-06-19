/**
 * FlowManga Source Provider — Registration
 *
 * This file registers all available source providers with the global registry.
 * Import this file once at app startup to make all providers available.
 *
 * To add a new provider:
 * 1. Create the provider class implementing SourceProvider
 * 2. Import it here
 * 3. Register it with sourceRegistry.register(new YourProvider())
 */

import { sourceRegistry } from "./registry";

// Phase 1: MangaDex
import { MangaDexProvider } from "./manga/MangaDexProvider";

// Phase 2: Manga/Comic Sources
import { ManhwaReadProvider } from "./manga/ManhwaReadProvider";
import { LuaComicProvider } from "./manga/LuaComicProvider";
import { BlueLockProvider } from "./manga/BlueLockProvider";
import { DBMProvider } from "./manga/DBMProvider";
import { NhentaiProvider } from "./doujin/NhentaiProvider";
import { HentaiComicsFreeProvider } from "./doujin/HentaiComicsFreeProvider";
import { EHentaiProvider } from "./doujin/EHentaiProvider";
import { MangaReadProvider } from "./manga/MangaReadProvider";
import { ManhuaPlusProvider } from "./manga/ManhuaPlusProvider";
import { ManhuaUSProvider } from "./manga/ManhuaUSProvider";
import { WebtoonsProvider } from "./manga/WebtoonsProvider";
import { ComixToProvider } from "./manga/ComixToProvider";

// Phase 4: Novel Sources
import { WebNovelProvider } from "./novel/WebNovelProvider";

// Register Phase 1
sourceRegistry.register(new MangaDexProvider());
sourceRegistry.register(new WebtoonsProvider());

// Register Phase 2
sourceRegistry.register(new ManhwaReadProvider());
sourceRegistry.register(new LuaComicProvider());
sourceRegistry.register(new BlueLockProvider());
sourceRegistry.register(new DBMProvider());
sourceRegistry.register(new NhentaiProvider());
sourceRegistry.register(new HentaiComicsFreeProvider());
sourceRegistry.register(new EHentaiProvider());
sourceRegistry.register(new MangaReadProvider());
sourceRegistry.register(new ManhuaPlusProvider());
sourceRegistry.register(new ManhuaUSProvider());
sourceRegistry.register(new ComixToProvider());

// Phase 4: Novel Sources
sourceRegistry.register(new WebNovelProvider());

export { sourceRegistry };
export type {
  SourceProvider,
  ContentType,
  MediaType,
  MediaDomain,
} from "./types";
