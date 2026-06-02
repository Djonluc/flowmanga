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
import { MangaReadProvider } from "./manga/MangaReadProvider";
import { ManhuaPlusProvider } from "./manga/ManhuaPlusProvider";
import { WebtoonsProvider } from "./manga/WebtoonsProvider";

// Phase 4: Novel Sources
import { WebNovelProvider } from "./novel/WebNovelProvider";

// Phase 3: Gallery / Image Board Sources
import { ZerochanProvider } from "./gallery/ZerochanProvider";
import { DanbooruProvider } from "./gallery/DanbooruProvider";
import { KonachanProvider } from "./gallery/KonachanProvider";
import { YandereProvider } from "./gallery/YandereProvider";
import { GelbooruProvider } from "./gallery/GelbooruProvider";

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
sourceRegistry.register(new MangaReadProvider());
sourceRegistry.register(new ManhuaPlusProvider());

// Phase 3: Gallery Sources
sourceRegistry.register(new ZerochanProvider());
sourceRegistry.register(new DanbooruProvider());
sourceRegistry.register(new KonachanProvider());
sourceRegistry.register(new YandereProvider());
sourceRegistry.register(new GelbooruProvider());

// Phase 4: Novel Sources
sourceRegistry.register(new WebNovelProvider());

export { sourceRegistry };
export type {
  SourceProvider,
  ContentType,
  MediaType,
  MediaDomain,
} from "./types";
