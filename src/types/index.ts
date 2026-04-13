export interface DownloadJob {
    id: string; // e.g., "mangaId-timestamp"
    title: string;
    coverUrl?: string; // For UI
    status: "queued" | "downloading" | "completed" | "failed" | "paused";
    progress: number; // 0–100
    totalChapters: number;
    downloadedChapters: number;
    // Payload Data needed to execute the job
    metadata: any; 
    chapterList: any[]; // List of chapters to download
    path: string; // Destination path
    force?: boolean; // If true, ignore skip checks
}
