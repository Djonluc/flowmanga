import React from "react";
import { ChevronLeft, ChevronRight, Download, ExternalLink, Heart, Loader2, Play, Pause, RefreshCw, Tag, Tags, X } from "lucide-react";
import type { PlatformImage } from "../types";
import { federator } from "../SearchFederator";
import { EHentaiProvider } from "../providers/EHentaiProvider";
import { useMediaLoader } from "../../hooks/useMediaLoader";
import { useSettingsStore } from "../../stores/useSettingsStore";
import { mkdir, writeFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { join, pictureDir } from "@tauri-apps/api/path";
import { toast } from "../../components/Toast";
import { invoke } from "@tauri-apps/api/core";
import { useImageCollectionStore } from "../useImageCollectionStore";
import { useLibraryStore } from "../../stores/useLibraryStore";

interface EHentaiGalleryReaderProps {
  gallery: PlatformImage;
  galleries: PlatformImage[];
  galleryIndex: number;
  onClose: () => void;
  onNavigateGallery: (index: number) => void;
  onSearchTag: (tag: string) => void;
}

export const EHentaiGalleryReader: React.FC<EHentaiGalleryReaderProps> = ({ gallery, galleries, galleryIndex, onClose, onNavigateGallery, onSearchTag }) => {
  const provider = React.useMemo(
    () => federator.getProviders().find(item => item.id === "e-hentai") as EHentaiProvider | undefined,
    [],
  );
  const { proxyViaTauri } = useMediaLoader();
  const [pageLinks, setPageLinks] = React.useState<string[]>([]);
  const [galleryTitle, setGalleryTitle] = React.useState(gallery.title || "E-Hentai Gallery");
  const [galleryTags, setGalleryTags] = React.useState(gallery.tags.filter(tag => !tag.startsWith("category:")));
  const [pageIndex, setPageIndex] = React.useState(0);
  const [resolvedPages, setResolvedPages] = React.useState<Record<number, string>>({});
  const [loadingGallery, setLoadingGallery] = React.useState(true);
  const [loadingPage, setLoadingPage] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const resolvingPages = React.useRef(new Set<number>());
  const [showDetails, setShowDetails] = React.useState(true);
  const [downloadProgress, setDownloadProgress] = React.useState<{ current: number; total: number } | null>(null);
  const imageDownloadPath = useSettingsStore(state => state.imageDownloadPath);
  const { savedImages, saveImage, removeSavedImage } = useImageCollectionStore();
  const isFavorited = savedImages.some(image => image.id === gallery.id);
  const [isSlideshowPlaying, setIsSlideshowPlaying] = React.useState(false);
  const [metadataRevision, setMetadataRevision] = React.useState(0);

  React.useEffect(() => {
    let cancelled = false;
    setLoadingGallery(true);
    setError(null);
    setPageIndex(0);
    setPageLinks([]);
    setResolvedPages({});
    resolvingPages.current.clear();
    provider?.getGalleryDetails(gallery.sourceId)
      .then(details => {
        if (cancelled) return;
        setPageLinks(details.pageLinks);
        setGalleryTitle(details.title);
        setGalleryTags(details.tags);
        if (details.pageLinks.length === 0) setError("This gallery did not expose any readable pages.");
      })
      .catch(reason => {
        if (!cancelled) setError(reason instanceof Error ? reason.message : String(reason));
      })
      .finally(() => {
        if (!cancelled) setLoadingGallery(false);
      });
    return () => { cancelled = true; };
  }, [gallery.sourceId, provider, metadataRevision]);

  const resolvePage = React.useCallback(async (index: number, foreground = false) => {
    if (!provider || !pageLinks[index] || resolvedPages[index] || resolvingPages.current.has(index)) return;
    resolvingPages.current.add(index);
    if (foreground) setLoadingPage(true);
    try {
      const page = await provider.resolveGalleryPage(pageLinks[index]);
      const proxied = await proxyViaTauri(page.url);
      setResolvedPages(current => ({ ...current, [index]: proxied || page.url }));
    } catch (reason) {
      if (foreground) setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      resolvingPages.current.delete(index);
      if (foreground) setLoadingPage(false);
    }
  }, [pageLinks, provider, proxyViaTauri, resolvedPages]);

  React.useEffect(() => {
    void resolvePage(pageIndex, true);
    if (pageIndex + 1 < pageLinks.length) void resolvePage(pageIndex + 1);
    if (pageIndex > 0) void resolvePage(pageIndex - 1);
  }, [pageIndex, pageLinks.length, resolvePage]);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft") setPageIndex(value => Math.max(0, value - 1));
      if (event.key === "ArrowRight") setPageIndex(value => Math.min(pageLinks.length - 1, value + 1));
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onClose, pageLinks.length]);

  React.useEffect(() => {
    if (!isSlideshowPlaying || pageLinks.length < 2) return;
    const timer = window.setInterval(() => {
      setPageIndex(current => {
        if (current < pageLinks.length - 1) return current + 1;
        const nextGallery = galleries[galleryIndex + 1];
        if (nextGallery?.providerId === "e-hentai") {
          onNavigateGallery(galleryIndex + 1);
          return 0;
        }
        setIsSlideshowPlaying(false);
        return current;
      });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [galleries, galleryIndex, isSlideshowPlaying, onNavigateGallery, pageLinks.length]);

  const currentSrc = resolvedPages[pageIndex];
  const groupedTags = galleryTags.reduce<Record<string, string[]>>((groups, tag) => {
    const separator = tag.indexOf(":");
    const namespace = separator > 0 ? tag.slice(0, separator) : "general";
    const value = separator > 0 ? tag.slice(separator + 1) : tag;
    (groups[namespace] ||= []).push(value);
    return groups;
  }, {});

  const downloadGallery = async () => {
    if (!provider || pageLinks.length === 0 || downloadProgress) return;
    const safeTitle = Array.from(galleryTitle || `e-hentai-${gallery.sourceId}`)
      .map(character => character.charCodeAt(0) < 32 ? "_" : character)
      .join("")
      .replace(/[<>:"/\\|?*]/g, "_")
      .replace(/[. ]+$/g, "")
      .slice(0, 120) || `e-hentai-${gallery.sourceId}`;
    try {
      const baseDirectory = imageDownloadPath || await join(await pictureDir(), "FlowManga", "E-Hentai");
      const galleryDirectory = await join(baseDirectory, safeTitle);
      const chapterDirectory = await join(galleryDirectory, "chapters", "001");
      await mkdir(chapterDirectory, { recursive: true });
      setDownloadProgress({ current: 0, total: pageLinks.length });
      const cookies = useSettingsStore.getState().booruAuth?.["e-hentai"]?.sessionCookies?.trim();
      let coverPath = "";

      for (let index = 0; index < pageLinks.length; index += 1) {
        const page = await provider.resolveGalleryPage(pageLinks[index]);
        const bytes = await invoke<number[]>("fetch_binary", {
          url: page.url,
          headers: {
            "User-Agent": "FlowManga/3.0",
            Referer: pageLinks[index],
            ...(cookies ? { Cookie: cookies } : {}),
          },
          proxyUrl: useSettingsStore.getState().networkProxy || null,
        });
        const extension = page.extension;
        const filename = `${String(index + 1).padStart(String(pageLinks.length).length, "0")}.${extension}`;
        const pagePath = await join(chapterDirectory, filename);
        await writeFile(pagePath, new Uint8Array(bytes));
        if (index === 0) coverPath = pagePath;
        setDownloadProgress({ current: index + 1, total: pageLinks.length });
      }

      const seriesId = `e-hentai-${gallery.sourceId.replace(/[^a-z0-9_-]/gi, "-")}`;
      const metadata = {
        version: 3,
        mangaId: seriesId,
        title: galleryTitle,
        displayTitle: galleryTitle,
        rootPath: galleryDirectory,
        coverPath,
        source: "e-hentai",
        sourceUrl: gallery.sourceUrl,
        description: `Downloaded E-Hentai gallery with ${pageLinks.length} pages.`,
        tags: galleryTags,
        totalChapters: 1,
        chapters: [{
          id: `${seriesId}-001`,
          number: 1,
          title: galleryTitle,
          path: chapterDirectory,
          pageCount: pageLinks.length,
        }],
      };
      await writeTextFile(await join(galleryDirectory, "metadata.json"), JSON.stringify(metadata, null, 2));
      await useLibraryStore.getState().registerDownloadedSeries(metadata, [{
        id: `${seriesId}-001`,
        title: galleryTitle,
        chapterNumber: 1,
        filePath: chapterDirectory,
        coverPath,
        sourceId: gallery.sourceId,
        totalPages: pageLinks.length,
      }]);
      if (!isFavorited) {
        await saveImage({ ...gallery, title: galleryTitle, tags: galleryTags, localPath: coverPath, isLocal: true }, null);
      }
      toast.success(`Downloaded all ${pageLinks.length} pages to ${safeTitle}.`);
    } catch (reason) {
      console.error("[EHentaiGalleryReader] Gallery download failed", reason);
      toast.error(`Gallery download failed: ${reason instanceof Error ? reason.message : String(reason)}`);
    } finally {
      setDownloadProgress(null);
    }
  };

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/80 p-2 backdrop-blur-sm md:p-6" role="dialog" aria-modal="true" aria-label={galleryTitle} onClick={onClose}>
      <div className="flex h-[98vh] w-full max-w-[98vw] flex-col overflow-hidden rounded-2xl border border-border-subtle bg-surface shadow-2xl" onClick={event => event.stopPropagation()}>
      <header className="hidden">
        <button onClick={onClose} className="rounded-full p-2 hover:bg-white/10" aria-label="Close gallery"><X /></button>
        <div className="min-w-0 flex-1">
          <div className="truncate font-bold">{galleryTitle}</div>
          <div className="text-xs text-white/60">{pageLinks.length ? `Page ${pageIndex + 1} of ${pageLinks.length}` : "Loading gallery pages…"}</div>
        </div>
        <button onClick={() => setShowDetails(value => !value)} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"><Tags size={15} /> Details</button>
        <button disabled={Boolean(downloadProgress) || pageLinks.length === 0} onClick={() => void downloadGallery()} className="flex items-center gap-2 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold hover:bg-indigo-500 disabled:opacity-50">
          {downloadProgress ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
          {downloadProgress ? `${downloadProgress.current}/${downloadProgress.total}` : "Download All"}
        </button>
        {gallery.sourceUrl && <button onClick={async () => { const { open } = await import("@tauri-apps/plugin-shell"); await open(gallery.sourceUrl!); }} className="flex items-center gap-2 rounded-xl bg-white/10 px-3 py-2 text-xs font-bold hover:bg-white/20"><ExternalLink size={15} /> Source</button>}
      </header>

      <div className="relative flex min-h-0 flex-1">
        <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-black/50 p-3 md:p-6">
          <button onClick={onClose} className="absolute left-4 top-4 z-20 rounded-full bg-black/50 p-2 text-white hover:bg-black/80" aria-label="Close gallery"><X size={24} /></button>
          {(loadingGallery || loadingPage) && !currentSrc && <div className="flex flex-col items-center gap-3 text-white/70"><Loader2 className="animate-spin" size={42} /><span className="text-xs font-bold uppercase tracking-widest">Loading readable page</span></div>}
          {error && !currentSrc && <div className="max-w-lg rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-center text-red-200">{error}</div>}
          {currentSrc && <img src={currentSrc} alt={`${galleryTitle} page ${pageIndex + 1}`} className="max-h-full max-w-full object-contain shadow-2xl" referrerPolicy="no-referrer" />}
          <button disabled={pageIndex <= 0} onClick={() => setPageIndex(value => Math.max(0, value - 1))} className="absolute left-3 rounded-full bg-black/60 p-3 text-white disabled:opacity-20 hover:bg-black/90" aria-label="Previous page"><ChevronLeft size={30} /></button>
          <button disabled={pageIndex >= pageLinks.length - 1} onClick={() => setPageIndex(value => Math.min(pageLinks.length - 1, value + 1))} className="absolute right-3 rounded-full bg-black/60 p-3 text-white disabled:opacity-20 hover:bg-black/90" aria-label="Next page"><ChevronRight size={30} /></button>
        </main>
        {showDetails && <aside className="absolute inset-y-0 right-0 z-20 w-[350px] max-w-[90vw] shrink-0 overflow-y-auto border-l border-border-subtle bg-surface-elevated text-foreground shadow-2xl md:static">
          <div className="border-b border-border-subtle p-6">
            <div className="mb-3 flex items-center justify-between"><span className="rounded-full bg-accent/20 px-3 py-1 text-xs font-black uppercase tracking-widest text-accent">E-Hentai</span><span className="text-xs font-bold text-foreground-muted">{pageLinks.length} pages</span></div>
            <h2 className="text-lg font-bold text-foreground">{galleryTitle}</h2>
            <p className="mt-2 text-xs text-foreground-muted">Page {pageLinks.length ? pageIndex + 1 : 0} of {pageLinks.length}</p>
          </div>
          <div className="grid grid-cols-2 gap-3 border-b border-border-subtle p-6">
            <button onClick={() => setIsSlideshowPlaying(value => !value)} disabled={pageLinks.length < 2} className="col-span-2 flex h-10 items-center justify-center gap-2 rounded-xl bg-accent font-bold text-white hover:bg-accent-hover disabled:opacity-50">{isSlideshowPlaying ? <Pause size={18} /> : <Play size={18} fill="currentColor" />}{isSlideshowPlaying ? "Pause Slideshow" : "Start Slideshow"}</button>
            <button disabled={Boolean(downloadProgress) || pageLinks.length === 0} onClick={() => void downloadGallery()} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface text-sm font-bold hover:bg-surface-raised disabled:opacity-50">{downloadProgress ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}{downloadProgress ? `${downloadProgress.current}/${downloadProgress.total}` : "Download All"}</button>
            <button onClick={() => void (isFavorited ? removeSavedImage(gallery.id) : saveImage(gallery, null))} className={`flex h-10 items-center justify-center gap-2 rounded-xl border border-border-subtle text-sm font-bold ${isFavorited ? "bg-red-500/10 text-red-500" : "bg-surface hover:bg-surface-raised"}`}><Heart size={16} fill={isFavorited ? "currentColor" : "none"} />{isFavorited ? "Favorited" : "Favorite"}</button>
            <button onClick={async () => { const { open } = await import("@tauri-apps/plugin-shell"); await open(pageLinks[pageIndex] || gallery.sourceUrl || "https://e-hentai.org/"); }} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface text-sm font-bold hover:bg-surface-raised"><ExternalLink size={16} /> Original</button>
            <button onClick={() => setMetadataRevision(value => value + 1)} disabled={loadingGallery} className="flex h-10 items-center justify-center gap-2 rounded-xl border border-border-subtle bg-surface text-sm font-bold hover:bg-surface-raised disabled:opacity-50"><RefreshCw size={16} className={loadingGallery ? "animate-spin" : ""} /> Refresh Meta</button>
          </div>
          <div className="flex items-center justify-between border-b border-border-subtle p-4">
            <button disabled={galleryIndex <= 0} onClick={() => onNavigateGallery(galleryIndex - 1)} className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold hover:bg-surface disabled:opacity-30"><ChevronLeft size={16} /> Previous Result</button>
            <button disabled={galleryIndex >= galleries.length - 1} onClick={() => onNavigateGallery(galleryIndex + 1)} className="flex items-center gap-1 rounded-lg px-2 py-2 text-xs font-bold hover:bg-surface disabled:opacity-30">Next Result <ChevronRight size={16} /></button>
          </div>
          <div className="p-6">
          <h2 className="mb-1 text-sm font-black uppercase tracking-widest">Gallery details</h2>
          <p className="mb-5 text-xs text-white/50">{pageLinks.length} pages · E-Hentai</p>
          {Object.entries(groupedTags).map(([namespace, tags]) => <section key={namespace} className="mb-5">
            <h3 className="mb-3 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-accent"><Tag size={12} /> {namespace}</h3>
            <div className="flex flex-wrap gap-2">{tags.map(tag => <button key={`${namespace}:${tag}`} onClick={() => onSearchTag(namespace === "general" ? tag : `${namespace}:${tag}`)} className="rounded-lg border border-border-subtle bg-surface px-3 py-1.5 text-xs text-foreground-muted hover:border-accent hover:text-foreground">{tag}</button>)}</div>
          </section>)}
          </div>
        </aside>}
      </div>

      {pageLinks.length > 1 && <footer className="border-t border-white/10 bg-black/70 px-4 py-3"><input type="range" min={0} max={pageLinks.length - 1} value={pageIndex} onChange={event => setPageIndex(Number(event.target.value))} className="w-full accent-indigo-500" aria-label="Gallery page" /></footer>}
      </div>
    </div>
  );
};
