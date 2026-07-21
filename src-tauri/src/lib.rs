use serde::Serialize;
use std::fs;
use std::io;
use std::path::Path;
use tauri::{command, AppHandle, Emitter, Manager};
use uuid::Uuid;
use walkdir::WalkDir;

#[derive(Serialize)]
pub struct VideoMetadata {
    id: String,
    file_path: String,
    title: String,
}

fn normalize_path(path: &Path) -> String {
    path.to_string_lossy().replace("\\", "/")
}

#[command]
async fn scan_video_folder(path: String) -> Result<Vec<VideoMetadata>, String> {
    let mut videos = Vec::new();
    let supported_extensions = ["mp4", "mkv", "webm", "avi"];

    for entry in WalkDir::new(&path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                    let file_path = normalize_path(entry.path());
                    let title = entry
                        .path()
                        .file_stem()
                        .and_then(|s| s.to_str())
                        .unwrap_or("Unknown")
                        .to_string();

                    videos.push(VideoMetadata {
                        id: Uuid::new_v4().to_string(),
                        file_path,
                        title,
                    });
                }
            }
        }
    }

    Ok(videos)
}

#[derive(Serialize, serde::Deserialize, Clone)]
pub struct MangaMetadata {
    id: String,
    file_path: String,
    title: String,
    cover_path: Option<String>,
    author: Option<String>,
    description: Option<String>,
    tags: Option<Vec<String>>,
    // New fields for Standard V3
    total_chapters: Option<i32>,
    version: Option<f32>,
    source_url: Option<String>,
    manga_id: Option<String>,
}

fn sanitize_filename(name: &str) -> String {
    name.replace(
        &['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>'][..],
        "_",
    )
}

// Helper: Auto-migrate messy folders to Standard Structure
fn migrate_to_standard(path: &Path) -> io::Result<()> {
    let chapters_dir = path.join("chapters");
    if !chapters_dir.exists() {
        fs::create_dir(&chapters_dir)?;
    }

    let img_extensions = ["jpg", "jpeg", "png", "webp", "mp4", "mkv", "webm", "avi", "gif"];
    let mut moved_images = false;
    let mut moved_folders = false;

    // 1. Check for loose images in root (Single Chapter mode -> chapters/001)
    let mut root_images = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();

        if entry_path.is_file() {
            if let Some(name) = entry_path.file_name().and_then(|s| s.to_str()) {
                // Ignore cover.jpg and metadata.json
                if name.eq_ignore_ascii_case("cover.jpg")
                    || name.eq_ignore_ascii_case("metadata.json")
                {
                    continue;
                }

                if let Some(ext) = entry_path.extension().and_then(|s| s.to_str()) {
                    if img_extensions.contains(&ext.to_lowercase().as_str()) {
                        root_images.push(entry_path);
                    }
                }
            }
        }
    }

    if !root_images.is_empty() {
        let ch001 = chapters_dir.join("001");
        if !ch001.exists() {
            fs::create_dir(&ch001)?;
        }

        for img_path in root_images {
            if let Some(name) = img_path.file_name() {
                let dest = ch001.join(name);
                fs::rename(img_path, dest)?;
                moved_images = true;
            }
        }
    }

    // 2. Check for "Chapter X" folders in root (Messy -> chapters/00X)
    let mut subfolders = Vec::new();
    for entry in fs::read_dir(path)? {
        let entry = entry?;
        let entry_path = entry.path();
        if entry_path.is_dir() && entry_path.file_name() != Some(std::ffi::OsStr::new("chapters")) {
            subfolders.push(entry_path);
        }
    }

    // Sort subfolders to try and map them to 001, 002... if they contain numbers
    subfolders.sort_by_key(|p| p.to_string_lossy().to_string());

    let mut chapter_counter = 1;
    for folder in subfolders {
        // Simple heuristic: does it contain images?
        let mut has_images = false;
        if let Ok(entries) = fs::read_dir(&folder) {
            for sub in entries.flatten() {
                if let Some(ext) = sub.path().extension().and_then(|s| s.to_str()) {
                    if img_extensions.contains(&ext.to_lowercase().as_str()) {
                        has_images = true;
                        break;
                    }
                }
            }
        }

        if has_images {
            // Try to extract number from folder name, else increment
            let folder_name = folder.file_name().unwrap().to_string_lossy().to_string();
            let num: i32 = folder_name
                .chars()
                .filter(|c| c.is_numeric())
                .collect::<String>()
                .parse()
                .unwrap_or(chapter_counter);

            // If parse failed/was 0, use counter
            let final_num = if num == 0 { chapter_counter } else { num };

            let dest_name = format!("{:03}", final_num);
            let dest_path = chapters_dir.join(&dest_name);

            // If collision (e.g. multiple "Chapter 1"), fallback to increment
            let final_dest = if dest_path.exists() {
                chapters_dir.join(format!("{:03}", chapter_counter))
            } else {
                dest_path
            };

            // Move the folder content or rename the folder?
            // Rename is faster/easier
            if let Err(e) = fs::rename(&folder, &final_dest) {
                // If rename fails (e.g. cross-device), might need recursive move.
                // For now assuming same filesystem.
                println!("Failed to move {:?} to {:?}: {}", folder, final_dest, e);
            } else {
                moved_folders = true;
            }
            chapter_counter += 1;
        }
    }

    if moved_images || moved_folders {
        // Migration logging for transparency
        let log_path = path.join("migration.log");
        use std::io::Write;
        if let Ok(mut log_file) = std::fs::OpenOptions::new().create(true).append(true).open(&log_path) {
            let _ = writeln!(log_file, "Migrated {:?} to Standard Structure. Moved images: {}, Moved folders: {}", path, moved_images, moved_folders);
        }
    }

    // 3. Generate Metadata if missing
    let meta_path = path.join("metadata.json");
    if !meta_path.exists() && (moved_images || moved_folders) {
        let title = path
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();
        let start_meta = serde_json::json!({
            "title": title,
            "displayTitle": title,
            "description": "Auto-migrated by FlowManga",
            "author": "",
            "tags": ["migrated"],
            "totalChapters": 0, // Should calculate?
            "source": "local",
            "version": 2
        });
        let f = fs::File::create(meta_path)?;
        serde_json::to_writer_pretty(f, &start_meta)?;
    }

    Ok(())
}

#[command]
async fn scan_manga_folder(path: String) -> Result<Vec<MangaMetadata>, String> {
    let mut manga = Vec::new();
    let root_path = Path::new(&path);

    // Auto-migrate the ROOT if it looks like a manga itself?
    // Usually 'path' is the Library root. We scan subfolders.

    let process_folder = |folder_path: &Path, is_root: bool| -> Option<MangaMetadata> {
        let meta_path = folder_path.join("metadata.json");
        let chapters_dir = folder_path.join("chapters");

        let mut meta_json: Option<serde_json::Value> = None;
        let mut is_standard_flat = false;

        // Check for Standard Flat structure (metadata.json exists)
        if meta_path.exists() {
            if let Ok(content) = std::fs::read_to_string(&meta_path) {
                meta_json = serde_json::from_str(&content).ok();
                if let Some(ref j) = meta_json {
                    // Check for V3 flat structure indicator or common fields
                    if j["chapters"].is_array() {
                        is_standard_flat = true;
                    }
                }
            }
        }

        let mut needs_migration = false;

        // If not standard flat and not nested, check if it needs migration
        if !is_standard_flat && !chapters_dir.exists() {
            // Check if it has images (Single) or subfolders (Messy)
            let mut has_content = false;
            let mut has_loose_images = false;
            let img_extensions = ["jpg", "jpeg", "png", "webp", "mp4", "mkv", "webm", "avi", "gif"];
            if let Ok(entries) = fs::read_dir(folder_path) {
                for e in entries.flatten() {
                    let p = e.path();
                    if p.is_file() {
                        if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                            if img_extensions.contains(&ext.to_lowercase().as_str()) {
                                // Don't count cover.jpg as content requiring migration if it's the *only* thing
                                if !p
                                    .file_name()
                                    .unwrap()
                                    .to_string_lossy()
                                    .eq_ignore_ascii_case("cover.jpg")
                                {
                                    has_content = true;
                                    has_loose_images = true;
                                }
                            }
                        }
                    } else if p.is_dir() {
                        // Shallow check for images in subfolder
                        if let Ok(sub) = fs::read_dir(&p) {
                            for s in sub.flatten() {
                                if let Some(ext) = s.path().extension().and_then(|str| str.to_str())
                                {
                                    if img_extensions.contains(&ext.to_lowercase().as_str()) {
                                        has_content = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }
            }
            if has_content {
                if is_root && !has_loose_images {
                    needs_migration = false; // Don't mistakenly migrate library root
                } else {
                    needs_migration = true;
                }
            }
        }

        if needs_migration {
            println!("Migrating: {:?}", folder_path);
            let _ = migrate_to_standard(folder_path);
        }

        // Re-check existence after migration
        if folder_path.join("chapters").exists() || meta_path.exists() {
            // It's a manga!

            if let Ok(content) = std::fs::read_to_string(&meta_path) {
                meta_json = serde_json::from_str(&content).ok();
            }

            let folder_name = folder_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            let title = meta_json
                .as_ref()
                .and_then(|j| j["title"].as_str().or(j["displayTitle"].as_str()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| folder_name.clone());

            let author = meta_json
                .as_ref()
                .and_then(|j| j["author"].as_str())
                .map(|s| s.to_string());
            let description = meta_json
                .as_ref()
                .and_then(|j| j["description"].as_str())
                .map(|s| s.to_string());
            let tags = meta_json
                .as_ref()
                .and_then(|j| j["tags"].as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(|s| s.to_string()))
                        .collect()
                });
            let total_chapters = meta_json
                .as_ref()
                .and_then(|j| j["totalChapters"].as_i64().or(j["total_chapters"].as_i64()))
                .map(|i| i as i32);
            let version = meta_json
                .as_ref()
                .and_then(|j| j["version"].as_f64())
                .map(|f| f as f32);
            let source_url = meta_json
                .as_ref()
                .and_then(|j| j["sourceUrl"].as_str())
                .map(|s| s.to_string());
            let manga_id = meta_json
                .as_ref()
                .and_then(|j| j["mangaId"].as_str())
                .map(|s| s.to_string());

            let mut cover_path = None;
            // 1. explicit coverFile in metadata
            if let Some(cf) = meta_json.as_ref().and_then(|j| j["coverFile"].as_str()) {
                let p = folder_path.join(cf);
                if p.exists() {
                    cover_path = Some(p.to_string_lossy().to_string());
                }
            }
            // 2. cover.jpg at root
            if cover_path.is_none() {
                let p = folder_path.join("cover.jpg");
                if p.exists() {
                    cover_path = Some(p.to_string_lossy().to_string());
                }
            }
            // 3. Robust fallback: check first few chapters for a cover
            if cover_path.is_none() {
                let ch_dir = folder_path.join("chapters");
                if let Ok(entries) = fs::read_dir(ch_dir) {
                    let mut subdirs: Vec<_> =
                        entries.flatten().filter(|e| e.path().is_dir()).collect();
                    subdirs.sort_by_key(|e| e.file_name()); // Try to find 001 first
                    for entry in subdirs {
                        let p = entry.path().join("cover.jpg");
                        if p.exists() {
                            cover_path = Some(p.to_string_lossy().to_string());
                            break;
                        }
                    }
                }
            }

            return Some(MangaMetadata {
                id: manga_id
                    .clone()
                    .unwrap_or_else(|| Uuid::new_v4().to_string()),
                file_path: folder_path.to_string_lossy().to_string(),
                title,
                cover_path,
                author,
                description,
                tags,
                total_chapters,
                version,
                source_url,
                manga_id,
            });
        }
        None
    };

    // 1. Check Root (if it is a manga itself)
    if let Some(m) = process_folder(root_path, true) {
        manga.push(m);
    }

    // 2. Check Subdirectories (Library Mode)
    for entry in WalkDir::new(root_path)
        .max_depth(1)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        if entry.file_type().is_dir() && entry.path() != root_path {
            if let Some(m) = process_folder(entry.path(), false) {
                manga.push(m);
            }
        }
    }

    manga.sort_by(|a, b| a.file_path.cmp(&b.file_path));
    manga.dedup_by(|a, b| a.file_path == b.file_path);

    Ok(manga)
}

#[derive(Serialize)]
pub struct ChapterMetadata {
    id: String,
    title: String,
    chapter_number: f32,
    file_path: String,
    cover_path: Option<String>,
    pages: i32,
    start_index: Option<i32>,
    end_index: Option<i32>,
}

#[command]
async fn scan_chapters(path: String, series_id: String) -> Result<Vec<ChapterMetadata>, String> {
    let mut chapters = Vec::new();
    let root = Path::new(&path);
    let chapters_dir = root.join("chapters");
    let img_extensions = ["jpg", "jpeg", "png", "webp", "mp4", "mkv", "webm", "avi", "gif"];

    if chapters_dir.exists() {
        // Nested Mode: Each subfolder in chapters/ is a chapter (e.g., chapters/001/, chapters/002/)
        let mut subdirs: Vec<_> = fs::read_dir(&chapters_dir)
            .map_err(|e| e.to_string())?
            .filter_map(|e| e.ok())
            .filter(|e| e.path().is_dir())
            .collect();
        subdirs.sort_by_key(|e| e.file_name());

        for entry in subdirs {
            let folder_path = entry.path();
            let folder_name = folder_path
                .file_name()
                .unwrap_or_default()
                .to_string_lossy()
                .to_string();

            // Extract chapter number from folder name (e.g., "001" -> 1.0, "Chapter 5" -> 5.0)
            let chapter_num: f32 = folder_name
                .chars()
                .filter(|c| c.is_numeric() || *c == '.')
                .collect::<String>()
                .parse()
                .unwrap_or(0.0);

            // Find first image as chapter cover
            let mut cover_path: Option<String> = None;
            let mut page_files: Vec<_> = fs::read_dir(&folder_path)
                .ok()
                .map(|entries| {
                    entries
                        .filter_map(|e| e.ok())
                        .filter(|e| {
                            e.path().is_file()
                                && e.path()
                                    .extension()
                                    .and_then(|ext| ext.to_str())
                                    .map(|ext| {
                                        img_extensions.contains(&ext.to_lowercase().as_str())
                                    })
                                    .unwrap_or(false)
                        })
                        .collect()
                })
                .unwrap_or_default();
            page_files.sort_by_key(|e| e.file_name());

            // Pick a random image as chapter cover (hash-based for determinism)
            if !page_files.is_empty() {
                let hash: usize = folder_name.bytes().fold(0usize, |acc, b| {
                    acc.wrapping_mul(31).wrapping_add(b as usize)
                });
                let idx = hash % page_files.len();
                cover_path = Some(page_files[idx].path().to_string_lossy().to_string());
            }

            if chapter_num > 0.0 || !folder_name.is_empty() {
                chapters.push(ChapterMetadata {
                    id: format!("{}-{}", series_id, folder_name),
                    title: format!(
                        "Chapter {}",
                        if chapter_num > 0.0 {
                            chapter_num.to_string()
                        } else {
                            folder_name.clone()
                        }
                    ),
                    chapter_number: if chapter_num > 0.0 {
                        chapter_num
                    } else {
                        chapters.len() as f32 + 1.0
                    },
                    file_path: folder_path.to_string_lossy().to_string(),
                    cover_path,
                    pages: page_files.len() as i32,
                    start_index: None,
                    end_index: None,
                });
            }
        }
    } else {
        // Flat Mode: Read chapters from metadata.json
        let meta_path = root.join("metadata.json");
        if meta_path.exists() {
            if let Ok(content) = std::fs::read_to_string(meta_path) {
                if let Ok(meta) = serde_json::from_str::<serde_json::Value>(&content) {
                    if let Some(chaps) = meta["chapters"].as_array() {
                        for c in chaps {
                            let num_str = c["number"].as_str().unwrap_or("0");
                            let num: f32 = num_str.parse().unwrap_or(0.0);
                            let start_idx = c["startIndex"].as_i64().map(|i| i as i32);
                            let end_idx = c["endIndex"].as_i64().map(|i| i as i32);

                            // Build cover from a random page within this chapter (hash-based)
                            let ch_padded = format!("{:03}", num as i32);
                            let cover_path = if let (Some(si), Some(ei)) = (start_idx, end_idx) {
                                let page_count = (ei - si + 1).max(1) as usize;
                                let hash: usize = num_str.bytes().fold(0usize, |acc, b| {
                                    acc.wrapping_mul(31).wrapping_add(b as usize)
                                });
                                let page_idx = (hash % page_count) as i32 + si + 1; // +1 for 1-indexed filenames
                                let cover_file = format!("ch{}_p{:03}.jpg", ch_padded, page_idx);
                                let cover_full = root.join(&cover_file);
                                if cover_full.exists() {
                                    Some(cover_full.to_string_lossy().to_string())
                                } else {
                                    // Fallback to first page
                                    let f = root.join(format!("ch{}_p001.jpg", ch_padded));
                                    if f.exists() {
                                        Some(f.to_string_lossy().to_string())
                                    } else {
                                        None
                                    }
                                }
                            } else {
                                let f = root.join(format!("ch{}_p001.jpg", ch_padded));
                                if f.exists() {
                                    Some(f.to_string_lossy().to_string())
                                } else {
                                    None
                                }
                            };

                            let pages = if let (Some(si), Some(ei)) = (start_idx, end_idx) {
                                (ei - si + 1).max(0)
                            } else {
                                0
                            };

                            chapters.push(ChapterMetadata {
                                id: format!("{}-{}", series_id, num_str),
                                title: format!("Chapter {}", num_str),
                                chapter_number: num,
                                file_path: path.clone(),
                                cover_path,
                                pages,
                                start_index: start_idx,
                                end_index: end_idx,
                            });
                        }
                    }
                }
            }
        }
    }

    // Sort numerically
    chapters.sort_by(|a, b| {
        a.chapter_number
            .partial_cmp(&b.chapter_number)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(chapters)
}

#[command]
async fn read_folder(app: AppHandle, path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let supported_extensions = ["jpg", "jpeg", "png", "webp", "gif", "mp4", "mkv", "webm", "avi"];
    let archive_extensions = ["zip", "cbz"];

    let input_path = Path::new(&path);

    if input_path.is_file() {
        let ext = input_path
            .extension()
            .and_then(|s| s.to_str())
            .unwrap_or("")
            .to_lowercase();
        if archive_extensions.contains(&ext.as_str()) {
            let cache_dir = app.path().app_cache_dir().map_err(|e| e.to_string())?;
            let extract_id = Uuid::new_v4().to_string();
            let extract_path = cache_dir.join("reader_cache").join(extract_id);

            fs::create_dir_all(&extract_path).map_err(|e| e.to_string())?;

            let file = fs::File::open(input_path).map_err(|e| e.to_string())?;
            let mut archive = zip::ZipArchive::new(file).map_err(|e| e.to_string())?;

            for i in 0..archive.len() {
                let mut file = archive.by_index(i).map_err(|e| e.to_string())?;
                let outpath = match file.enclosed_name() {
                    Some(path) => extract_path.join(path),
                    None => continue,
                };

                if (*file.name()).ends_with('/') {
                    fs::create_dir_all(&outpath).ok();
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() {
                            fs::create_dir_all(p).ok();
                        }
                    }
                    let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                    io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }

            for entry in WalkDir::new(&extract_path)
                .into_iter()
                .filter_map(|e| e.ok())
            {
                if entry.file_type().is_file() {
                    if let Some(e) = entry.path().extension().and_then(|s| s.to_str()) {
                        if supported_extensions.contains(&e.to_lowercase().as_str()) {
                            files.push(entry.path().to_string_lossy().to_string());
                        }
                    }
                }
            }
        }
    } else {
        for entry in WalkDir::new(&path)
            .max_depth(1)
            .into_iter()
            .filter_map(|e| e.ok())
        {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                    if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                        files.push(entry.path().to_string_lossy().to_string());
                    }
                }
            }
        }
    }

    files.sort();
    Ok(files)
}

use std::collections::HashMap;
use base64::Engine;

fn decode_image_data_url(url: &str) -> Result<Vec<u8>, String> {
    let data_url = url
        .strip_prefix("data:")
        .ok_or_else(|| "Invalid data URL: missing data prefix".to_string())?;
    let comma_index = data_url
        .find(',')
        .ok_or_else(|| "Invalid data URL: missing payload separator".to_string())?;
    let (metadata, payload_with_comma) = data_url.split_at(comma_index);

    if !metadata.contains(";base64") {
        return Err("Only base64 data URLs are supported for image downloads".to_string());
    }

    let payload = &payload_with_comma[1..];
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(payload)
        .map_err(|e| format!("Failed to decode image data URL: {}", e))?;

    if metadata.contains("image/jpeg") && !bytes.ends_with(&[0xff, 0xd9]) {
        return Err("Decoded JPEG data URL appears incomplete".to_string());
    }

    Ok(bytes)
}

async fn render_comix_scrambled_page(
    chapter_url: String,
    page_index: u64,
) -> Result<Vec<u8>, String> {
    let data_url = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser
            .new_tab()
            .map_err(|e| format!("Failed to create tab: {}", e))?;

        tab.navigate_to(&chapter_url)
            .map_err(|e| format!("Nav failed: {}", e))?;
        let _ = tab.wait_until_navigated();
        std::thread::sleep(std::time::Duration::from_millis(5000));

        let script = format!(
            r#"
            (async () => {{
                const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                const pageIndex = {page_index};
                const initialText = document.getElementById('initial-data')?.textContent || '{{}}';
                const initial = JSON.parse(initialText);
                const pathMatch = location.pathname.match(/\/(\d+)-chapter-/);
                const chapterId = initial?.read?.chapterId || pathMatch?.[1];

                if (!chapterId) {{
                    throw new Error('Comix.to chapter id was not found on the page.');
                }}

                let envUrl = '';
                let secureUrl = '';
                let readPageUrl = '';
                for (let i = 0; i < 30; i++) {{
                    const resources = performance
                        .getEntriesByType('resource')
                        .map((entry) => entry.name);
                    envUrl = resources.find((name) => name.includes('/env-') && name.endsWith('.js')) || '';
                    secureUrl = resources.find((name) => name.includes('/secure-') && name.endsWith('.js')) || '';
                    readPageUrl = resources.find((name) => name.includes('/ReadPage-') && name.endsWith('.js')) || '';
                    if (envUrl && secureUrl) break;
                    await sleep(500);
                }}

                if (!envUrl) {{
                    throw new Error('Comix.to env module was not loaded.');
                }}

                if (!secureUrl && readPageUrl) {{
                    const readPageSource = await fetch(readPageUrl).then((response) => response.text());
                    const secureMatch = readPageSource.match(/from"\.\/(secure-[^"]+\.js)"/);
                    if (secureMatch?.[1]) {{
                        secureUrl = new URL(secureMatch[1], readPageUrl).href;
                    }}
                }}

                if (!secureUrl) {{
                    throw new Error('Comix.to secure module was not loaded.');
                }}

                const env = await import(envUrl);
                const secure = await import(secureUrl);
                if (!env?.b?.get) {{
                    throw new Error('Comix.to API client export was not found.');
                }}
                if (!secure?.t) {{
                    throw new Error('Comix.to canvas unscrambler export was not found.');
                }}

                const chapter = await env.b.get('/chapters/' + chapterId);
                let pages = chapter?.pages;
                if (pages && !Array.isArray(pages) && Array.isArray(pages.items)) {{
                    const baseUrl = pages.baseUrl || '';
                    pages = pages.items.map((page) => ({{
                        url: baseUrl + page.url,
                        width: page.width,
                        height: page.height,
                        scramble: page.s === 1 || undefined,
                    }}));
                }}

                const page = Array.isArray(pages) ? pages[pageIndex] : null;
                if (!page?.url || !page.scramble) {{
                    throw new Error('Comix.to page is not marked as scrambled.');
                }}

                const canvas = document.createElement('canvas');
                canvas.width = Number(page.width) || 1;
                canvas.height = Number(page.height) || 1;
                const controller = new AbortController();
                await secure.t(page.url, canvas, controller.signal);
                return canvas.toDataURL('image/jpeg', 0.92);
            }})()
            "#,
            page_index = page_index
        );

        let remote_obj = tab
            .evaluate(&script, true)
            .map_err(|e| format!("Comix.to page render eval failed: {}", e))?;
        remote_obj
            .value
            .and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string()))
            .ok_or_else(|| "No data URL returned from Comix.to page render".to_string())
    })
    .await
    .map_err(|e| format!("Comix.to page render task failed: {}", e))??;

    decode_image_data_url(&data_url)
}

#[command]
async fn download_image(
    url: String,
    file_path: String,
    headers: Option<HashMap<String, String>>,
    encryption_key: Option<String>,
) -> Result<(), String> {
    if let Some(marker) = url.strip_prefix("comix-scrambled:") {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(marker)
            .map_err(|e| format!("Failed to decode Comix.to page marker: {}", e))?;
        let payload: serde_json::Value = serde_json::from_slice(&decoded)
            .map_err(|e| format!("Failed to parse Comix.to page marker: {}", e))?;
        let chapter_url = payload
            .get("url")
            .and_then(|value| value.as_str())
            .ok_or_else(|| "Comix.to page marker is missing chapter URL".to_string())?
            .to_string();
        let page_index = payload
            .get("page")
            .and_then(|value| value.as_u64())
            .ok_or_else(|| "Comix.to page marker is missing page index".to_string())?;
        let bytes = render_comix_scrambled_page(chapter_url, page_index).await?;

        if let Some(parent) = std::path::Path::new(&file_path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
        return Ok(());
    }

    if let Some(marker) = url.strip_prefix("comix-moves:") {
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(marker)
            .map_err(|e| format!("Failed to decode comix-moves payload: {}", e))?;
        let payload: serde_json::Value = serde_json::from_slice(&decoded)
            .map_err(|e| format!("Failed to parse comix-moves JSON: {}", e))?;
        
        let actual_url = payload.get("url").and_then(|v| v.as_str()).ok_or("No url")?;
        let width = payload.get("w").and_then(|v| v.as_u64()).unwrap_or(800) as u32;
        let height = payload.get("h").and_then(|v| v.as_u64()).unwrap_or(1200) as u32;
        let moves = payload.get("moves").and_then(|v| v.as_array()).ok_or("No moves")?;

        let client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(30))
            .danger_accept_invalid_certs(true)
            .build()
            .map_err(|e| e.to_string())?;
        
        let res = client.get(actual_url)
            .header("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
            .header("Referer", "https://comix.to/")
            .send()
            .await
            .map_err(|e| e.to_string())?;
            
        let bytes = res.bytes().await.map_err(|e| e.to_string())?;
        let img = image::load_from_memory(&bytes).map_err(|e| e.to_string())?;
        let mut canvas = image::RgbaImage::new(width, height);
        
        for m in moves {
            if let Some(arr) = m.as_array() {
                if arr.len() >= 8 {
                    let sx = arr[0].as_u64().unwrap_or(0) as u32;
                    let sy = arr[1].as_u64().unwrap_or(0) as u32;
                    let sw = arr[2].as_u64().unwrap_or(0) as u32;
                    let sh = arr[3].as_u64().unwrap_or(0) as u32;
                    let dx = arr[4].as_u64().unwrap_or(0) as i64;
                    let dy = arr[5].as_u64().unwrap_or(0) as i64;
                    
                    let tile = image::imageops::crop_imm(&img, sx, sy, sw, sh).to_image();
                    image::imageops::replace(&mut canvas, &tile, dx, dy);
                }
            }
        }
        
        if let Some(parent) = std::path::Path::new(&file_path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }
        
        canvas.save_with_format(&file_path, image::ImageFormat::Jpeg).map_err(|e| e.to_string())?;
        return Ok(());
    }

    if url.starts_with("data:") {
        let bytes = decode_image_data_url(&url)?;

        if let Some(parent) = std::path::Path::new(&file_path).parent() {
            std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
        return Ok(());
    }

    let client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");

    let client = client_builder.build().map_err(|e| e.to_string())?;

    let mut request = client.get(&url);

    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to download image: status {}",
            response.status()
        ));
    }

    let mut bytes = response.bytes().await.map_err(|e| e.to_string())?.to_vec();

    // XOR decryption for MangaPlus encrypted images
    if let Some(ref key_hex) = encryption_key {
        let key_bytes: Vec<u8> = (0..key_hex.len())
            .step_by(2)
            .filter_map(|i| u8::from_str_radix(&key_hex[i..i + 2], 16).ok())
            .collect();
        if !key_bytes.is_empty() {
            for i in 0..bytes.len() {
                bytes[i] ^= key_bytes[i % key_bytes.len()];
            }
        }
    }

    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }

    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
async fn fetch_binary(
    url: String,
    headers: Option<HashMap<String, String>>,
    proxy_url: Option<String>,
) -> Result<Vec<u8>, String> {
    let mut client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36")
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(45))
        .redirect(reqwest::redirect::Policy::limited(5));

    if let Some(proxy) = proxy_url {
        if !proxy.is_empty() {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy) {
                client_builder = client_builder.proxy(reqwest_proxy);
            }
        }
    }

    let client = client_builder.build().map_err(|e| e.to_string())?;

    let mut request = client.get(&url);

    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch binary: status {}",
            response.status()
        ));
    }

    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    Ok(bytes.to_vec())
}

#[command]
async fn compute_image_dhash(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/122 Safari/537.36")
        .connect_timeout(std::time::Duration::from_secs(6))
        .timeout(std::time::Duration::from_secs(15))
        .redirect(reqwest::redirect::Policy::limited(5))
        .build()
        .map_err(|error| error.to_string())?;
    let response = client.get(url).send().await.map_err(|error| error.to_string())?;
    if !response.status().is_success() {
        return Err(format!("Fingerprint request failed: {}", response.status()));
    }
    let bytes = response.bytes().await.map_err(|error| error.to_string())?;
    let image = image::load_from_memory(&bytes).map_err(|error| error.to_string())?;
    let grayscale = image
        .resize_exact(9, 8, image::imageops::FilterType::Triangle)
        .to_luma8();
    let mut hash = 0_u64;
    for y in 0..8 {
        for x in 0..8 {
            hash <<= 1;
            if grayscale.get_pixel(x, y)[0] > grayscale.get_pixel(x + 1, y)[0] {
                hash |= 1;
            }
        }
    }
    Ok(format!("{hash:016x}"))
}

#[command]
async fn fetch_json(
    url: String,
    method: String,
    body: Option<serde_json::Value>,
    headers: Option<HashMap<String, String>>,
    proxy_url: Option<String>,
) -> Result<serde_json::Value, String> {
    let mut client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .connect_timeout(std::time::Duration::from_secs(8))
        .timeout(std::time::Duration::from_secs(20))
        .gzip(true)
        .deflate(true)
        .redirect(reqwest::redirect::Policy::limited(5));

    if let Some(proxy) = proxy_url {
        if !proxy.is_empty() {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy) {
                client_builder = client_builder.proxy(reqwest_proxy);
            }
        }
    }

    let client = client_builder.build().map_err(|e| e.to_string())?;

    let mut request = match method.to_uppercase().as_str() {
        "POST" => client.post(&url),
        "PUT" => client.put(&url),
        _ => client.get(&url),
    };

    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }

    if let Some(b) = body {
        request = request.json(&b);
    }

    let response = request
        .send()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?;

    if !response.status().is_success() {
        let status = response.status();
        let retry_after = response
            .headers()
            .get("retry-after")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        let rate_limit_reset = response
            .headers()
            .get("x-ratelimit-reset")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("");
        let response_url = response.url().clone();
        let mut detail = format!(
            "Failed to fetch JSON: status {} from {}",
            status, response_url
        );
        if !retry_after.is_empty() {
            detail.push_str(&format!("; retry-after={}", retry_after));
        }
        if !rate_limit_reset.is_empty() {
            detail.push_str(&format!("; x-ratelimit-reset={}", rate_limit_reset));
        }
        let content_type = response
            .headers()
            .get("content-type")
            .and_then(|value| value.to_str().ok())
            .unwrap_or("")
            .to_string();
        let response_body = response.text().await.unwrap_or_default();
        let body_preview: String = response_body
            .split_whitespace()
            .collect::<Vec<_>>()
            .join(" ")
            .chars()
            .take(240)
            .collect();
        if !content_type.is_empty() {
            detail.push_str(&format!("; content-type={}", content_type));
        }
        if !body_preview.is_empty() {
            detail.push_str(&format!("; body={}", body_preview));
        }
        return Err(detail);
    }

    let json = response
        .json::<serde_json::Value>()
        .await
        .map_err(|e: reqwest::Error| e.to_string())?;
    Ok(json)
}

#[command]
async fn fetch_html(
    url: String,
    headers: Option<HashMap<String, String>>,
    proxy_url: Option<String>,
) -> Result<String, String> {
    let mut client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        .gzip(true)
        .deflate(true)
        .redirect(reqwest::redirect::Policy::limited(10));

    if let Some(proxy) = proxy_url {
        if !proxy.is_empty() {
            if let Ok(reqwest_proxy) = reqwest::Proxy::all(&proxy) {
                client_builder = client_builder.proxy(reqwest_proxy);
            }
        }
    }

    let client = client_builder.build().map_err(|e| e.to_string())?;

    let mut request = client.get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8")
        .header("Accept-Language", "en-US,en;q=0.5")
        .header("Accept-Encoding", "gzip, deflate")
        .header("Connection", "keep-alive")
        .header("Upgrade-Insecure-Requests", "1")
        .header("Sec-Fetch-Dest", "document")
        .header("Sec-Fetch-Mode", "navigate")
        .header("Sec-Fetch-Site", "none")
        .header("Sec-Fetch-User", "?1");

    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }

    let response = request.send().await.map_err(|e| e.to_string())?;

    if !response.status().is_success() {
        return Err(format!(
            "Failed to fetch content: status {}",
            response.status()
        ));
    }

    let text = response.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

use headless_chrome::{Browser, LaunchOptions};

#[derive(serde::Deserialize, Clone)]
pub struct ScrapeOptions {
    pub scroll_iterations: Option<u64>,
    pub wait_after_scroll: Option<u64>,
    pub selectors: Option<Vec<String>>,
}

#[command]
async fn scrape_images_headless(
    url: String,
    options: Option<ScrapeOptions>,
) -> Result<Vec<String>, String> {
    println!("[Rust] Starting enhanced headless scrape for: {}", url);

    let images = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;
        
        // Config from options
        let max_scrolls = options.as_ref().and_then(|o| o.scroll_iterations).unwrap_or(15);
        let wait_ms = options.as_ref().and_then(|o| o.wait_after_scroll).unwrap_or(1500);
        let custom_selectors = options.as_ref().and_then(|o| o.selectors.clone()).unwrap_or_default();

        // 1. Navigate & Settle
        println!("[Rust] Navigating to {}...", url);
        tab.navigate_to(&url).map_err(|e| format!("Failed to navigate: {}", e))?;
        let _ = tab.wait_until_navigated(); // Non-critical wait
        std::thread::sleep(std::time::Duration::from_millis(2000));

        // 1.1 Debug Proof of Load
        if let Ok(title_obj) = tab.evaluate("document.title", true) {
            let t = title_obj.value.and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string())).unwrap_or_default();
            println!("[Rust Scraper] Debug - Page Title: {}", t);
        }

        // 1.2 Wait for reader container
        let wait_script = r#"
            document.querySelector('#viewer, .reader, .nc-viewer, [data-role="reader"], .page-list, div[class*="viewer"]') !== null ||
            document.querySelector('.reading-content, #readerarea, .container-chapter-reader') !== null
        "#;
        let mut retries = 0;
        while retries < 15 {
            if let Ok(remote_object) = tab.evaluate(wait_script, true) {
                if remote_object.value.and_then(|v: serde_json::Value| v.as_bool()).unwrap_or(false) { break; }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
            retries += 1;
        }

        // 1.3 Click through potential overlays
        let click_script = r#"
            (() => {
                const buttons = Array.from(document.querySelectorAll('button, a, div'))
                    .filter(el => {
                        const t = el.textContent.toLowerCase();
                        return t.includes('confirm') || t.includes('agree') || t.includes('adult') || t.includes('proceed') || t.includes('continue');
                    });
                buttons.forEach(b => b.click());
                return buttons.length;
            })()
        "#;
        let _ = tab.evaluate(click_script, true);

        // 1.4 Wait for initial images
        let wait_img = "document.querySelectorAll('img').length > 3";
        let mut img_retries = 0;
        while img_retries < 10 {
            if let Ok(obj) = tab.evaluate(wait_img, true) {
                if obj.value.and_then(|v: serde_json::Value| v.as_bool()).unwrap_or(false) { break; }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
            img_retries += 1;
        }

        // 2. Incremental Collection loop
        let mut collected_images: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut last_height = 0;
        let mut scroll_retries = 0;
        let mut total_scrolls = 0;

        while scroll_retries < 5 && total_scrolls < max_scrolls {
            // Check if tab is still alive by a simple evaluate
            if tab.evaluate("1", true).is_err() {
                println!("[Rust] Warning: Tab seems closed or disconnected. Aborting loop.");
                break;
            }

            let mut extract_script = String::from(r#"
                (() => {
                    const results = [];
                    const seen = new Set();
                    const addUrl = src => {
                        if (!src || src.length < 20) return;
                        if (src.startsWith('//')) src = 'https:' + src;
                        if (src.startsWith('/')) src = window.location.origin + src;
                        if (!src.startsWith('http')) return;
                        
                        const s = src.toLowerCase();
                        if (s.includes('avatar') || s.includes('logo') || s.includes('banner') || s.includes('icon')) return;
                        
                        if (!seen.has(src)) { seen.add(src); results.push(src); }
                    };
            "#);

            // Add custom selectors if provided
            if !custom_selectors.is_empty() {
                for sel in &custom_selectors {
                    extract_script.push_str(&format!("document.querySelectorAll('{}').forEach(el => addUrl(el.src || el.dataset?.src || el.dataset?.lazySrc || el.getAttribute('data-src')));\n", sel));
                }
            }

            // Standard robust extraction logic
            extract_script.push_str(r#"
                    const attrs = ['src', 'data-src', 'data-lazy-src', 'data-original', 'data-image', 'srcset', 'data-srcset'];
                    document.querySelectorAll('*').forEach(el => {
                        attrs.forEach(attr => {
                            const val = el.getAttribute(attr);
                            if (val && typeof val === 'string' && val.length > 20) {
                                if (val.includes(' ')) { 
                                    val.split(',').forEach(part => addUrl(part.trim().split(' ')[0]));
                                } else { addUrl(val); }
                            }
                        });
                        
                        const style = window.getComputedStyle(el).backgroundImage;
                        if (style && style !== 'none') {
                            const match = style.match(/url\(["']?(.*?)["']?\)/);
                            if (match && match[1]) addUrl(match[1]);
                        }
                    });
                    return results;
                })()
            "#);

            if let Ok(remote_obj) = tab.evaluate(&extract_script, true) {
                if let Some(val) = remote_obj.value {
                    if let Ok(urls) = serde_json::from_value::<Vec<String>>(val) {
                        for url in urls { collected_images.insert(url); }
                    }
                }
            }

            // Scroll
            if let Ok(height_obj) = tab.evaluate("document.body.scrollHeight", true) {
                let current_height = height_obj.value.and_then(|v: serde_json::Value| v.as_u64()).unwrap_or(0);
                let _ = tab.evaluate("window.scrollBy(0, window.innerHeight * 1.5)", true);
                std::thread::sleep(std::time::Duration::from_millis(wait_ms));
                
                if current_height == last_height { scroll_retries += 1; }
                else { scroll_retries = 0; last_height = current_height; }
            } else {
                break;
            }
            total_scrolls += 1;
        }
        
        // Final Filter
        let mut final_urls: Vec<String> = collected_images.into_iter()
            .filter(|src| {
                let s = src.to_lowercase();
                let path = s.split('?').next().unwrap_or("");
                
                // Allow known image extensions
                if path.ends_with(".jpg") || path.ends_with(".jpeg") || path.ends_with(".png") || 
                   path.ends_with(".webp") || path.ends_with(".gif") || path.ends_with(".avif") {
                    return true;
                }

                // Domain-specific allowance (LuaComic media server)
                if s.contains("media.luacomic.org") {
                    return true;
                }

                // Broad filter for large data URLs or other image-like patterns
                if s.len() > 40 && !s.contains("logo") && !s.contains("avatar") && !s.contains("icon")
                    && (s.contains("/uploads/") || s.contains("/manga/") || s.contains("/chapters/")) {
                    return true;
                }
                false
            })
            .collect();
            
        // Final broad fallback if empty
        if final_urls.is_empty() {
             println!("[Rust Scraper] Incremental loop failed. Trying final broad extraction...");
             let broad_script = r#"
                (async () => {
                    const urls = new Set(Array.from(document.querySelectorAll('img'))
                        .map(i => i.currentSrc || i.src || i.dataset?.src || i.dataset?.lazySrc || '')
                        .filter(s => s.length > 50));
                    return Array.from(urls);
                })()
             "#;
             if let Ok(remote_obj) = tab.evaluate(broad_script, true) {
                 if let Some(val) = remote_obj.value {
                     if let Ok(urls) = serde_json::from_value::<Vec<String>>(val) {
                         final_urls = urls;
                     }
                 }
             }
        }

        println!("[Rust Scraper] Scrape complete. Found {} unique image candidate(s).", final_urls.len());
        Ok::<Vec<String>, String>(final_urls)
    }).await.map_err(|e| format!("Headless task failed: {}", e))??;

    if images.is_empty() {
        return Err("No value returned from extraction".to_string());
    }

    Ok(images)
}

#[derive(Serialize)]
pub struct SeriesScrapeResult {
    title: String,
    description: String,
    cover_url: String,
    tags: Vec<String>,
    chapter_links: Vec<String>,
}

#[command]
async fn fetch_html_headless(url: String) -> Result<String, String> {
    println!("[Rust] Fetching HTML headless for: {}", url);
    tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;
        tab.navigate_to(&url).map_err(|e| format!("Nav failed: {}", e))?;
        let _ = tab.wait_until_navigated();
        
        // Wait for potential Cloudflare challenge to pass
        std::thread::sleep(std::time::Duration::from_millis(8000));
        
        let html_obj = tab.evaluate("document.documentElement.outerHTML", true)
            .map_err(|e| format!("Eval failed: {}", e))?;
            
        let html = html_obj.value
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_default();
            
        Ok(html)
    }).await.map_err(|e| e.to_string())?
}

#[command]
async fn fetch_json_headless(url: String, headers: Option<HashMap<String, String>>) -> Result<String, String> {
    println!("[Rust] Fetching JSON headless for: {}", url);
    tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;
        if let Some(header_map) = headers.as_ref() {
            let header_refs: HashMap<&str, &str> = header_map
                .iter()
                .map(|(key, value)| (key.as_str(), value.as_str()))
                .collect();
            tab.set_extra_http_headers(header_refs)
                .map_err(|e| format!("Failed to set request headers: {}", e))?;
        }
        tab.navigate_to(&url).map_err(|e| format!("Nav failed: {}", e))?;
        let _ = tab.wait_until_navigated();
        
        // Wait for potential Cloudflare challenge to pass
        std::thread::sleep(std::time::Duration::from_millis(5000));
        
        // Booru JSON APIs typically just output raw JSON in the body or wrapped in a <pre> tag.
        let script = r#"
            (function() {
                let pre = document.querySelector('pre');
                if (pre) {
                    return pre.innerText;
                }
                return document.body.innerText;
            })()
        "#;

        let json_obj = tab.evaluate(script, true)
            .map_err(|e| format!("Eval failed: {}", e))?;
            
        let json = json_obj.value
            .and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_default();
            
        Ok(json)
    }).await.map_err(|e| e.to_string())?
}

#[command]
async fn scrape_comix_chapter_headless(url: String) -> Result<Vec<String>, String> {
    println!("[Rust] Starting Comix.to page-context scrape for: {}", url);

    let images = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser
            .new_tab()
            .map_err(|e| format!("Failed to create tab: {}", e))?;

        tab.navigate_to(&url)
            .map_err(|e| format!("Nav failed: {}", e))?;
        let _ = tab.wait_until_navigated();
        std::thread::sleep(std::time::Duration::from_millis(5000));

        let script = r#"
            (async () => {
                const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
                const initialText = document.getElementById('initial-data')?.textContent || '{}';
                const initial = JSON.parse(initialText);
                const pathMatch = location.pathname.match(/\/(\d+)-chapter-/);
                const chapterId = initial?.read?.chapterId || pathMatch?.[1];

                const logs = [];
                logs.push('Detected chapterId: ' + chapterId);

                if (!chapterId) {
                    throw new Error('Comix.to chapter id was not found on the page.');
                }

                let envUrl = '';
                let secureUrl = '';
                let readPageUrl = '';
                for (let i = 0; i < 30; i++) {
                    const resources = performance
                        .getEntriesByType('resource')
                        .map((entry) => entry.name);
                    envUrl = resources.find((name) => name.includes('/env-') && name.endsWith('.js')) || '';
                    secureUrl = resources.find((name) => name.includes('/secure-') && name.endsWith('.js')) || '';
                    readPageUrl = resources.find((name) => name.includes('/ReadPage-') && name.endsWith('.js')) || '';
                    if (envUrl && secureUrl) break;
                    await sleep(500);
                }

                logs.push('Resource scanning result - envUrl: ' + (envUrl ? 'found' : 'not found') + ', secureUrl: ' + (secureUrl ? 'found' : 'not found'));

                if (!envUrl) {
                    throw new Error('Comix.to env module was not loaded.');
                }

                if (!secureUrl && readPageUrl) {
                    logs.push('Trying to resolve secureUrl from ReadPage source: ' + readPageUrl);
                    const readPageSource = await fetch(readPageUrl).then((response) => response.text());
                    const secureMatch = readPageSource.match(/from"\.\/(secure-[^"]+\.js)"/);
                    if (secureMatch?.[1]) {
                        secureUrl = new URL(secureMatch[1], readPageUrl).href;
                        logs.push('Resolved secureUrl: ' + secureUrl);
                    }
                }

                const mod = await import(envUrl);
                if (!mod?.b?.get) {
                    throw new Error('Comix.to API client export was not found.');
                }

                logs.push('Fetching chapter details...');
                const chapter = await mod.b.get('/chapters/' + chapterId);
                let pages = chapter?.pages;

                if (pages && !Array.isArray(pages) && Array.isArray(pages.items)) {
                    const baseUrl = pages.baseUrl || '';
                    pages = pages.items.map((page) => ({
                        url: baseUrl + page.url,
                        width: page.width,
                        height: page.height,
                        scramble: page.s === 1 || undefined,
                    }));
                }

                pages = (Array.isArray(pages) ? pages : [])
                    .filter((page) => typeof page?.url === 'string' && page.url.length > 0);

                logs.push('Total pages found: ' + pages.length);

                let secure = null;
                const hasScrambled = pages.some(p => p.scramble);
                logs.push('Has scrambled pages: ' + hasScrambled);
                if (hasScrambled) {
                    if (!secureUrl) {
                        throw new Error('Comix.to secure module was not loaded.');
                    }
                    logs.push('Importing secure module: ' + secureUrl);
                    secure = await import(secureUrl);
                    if (!secure?.t) {
                        throw new Error('Comix.to canvas unscrambler export was not found.');
                    }
                }

                const images = [];
                let scrambledCount = 0;
                for (let index = 0; index < pages.length; index++) {
                    const page = pages[index];
                    if (!page.scramble) {
                        images.push(page.url);
                        continue;
                    }

                    scrambledCount++;
                    try {
                        const canvas = document.createElement('canvas');
                        canvas.width = Number(page.width) || 1;
                        canvas.height = Number(page.height) || 1;
                        
                        const drawCalls = [];
                        const origDrawImage = CanvasRenderingContext2D.prototype.drawImage;
                        CanvasRenderingContext2D.prototype.drawImage = function(...args) {
                            if (this.canvas === canvas) drawCalls.push(args.slice(1));
                            return origDrawImage.apply(this, args);
                        };
                        
                        const controller = new AbortController();
                        await secure.t(page.url, canvas, controller.signal).catch(e => {
                            // ignore rendering errors, we just want the coordinates
                        });
                        
                        CanvasRenderingContext2D.prototype.drawImage = origDrawImage;
                        
                        // Extract only the tile copying commands (length >= 8)
                        const moves = drawCalls.filter(args => args.length >= 8);
                        
                        const payload = JSON.stringify({
                            url: page.url,
                            w: canvas.width,
                            h: canvas.height,
                            moves: moves
                        });
                        
                        images.push('comix-moves:' + btoa(payload));
                        logs.push('Extracted scramble moves for page ' + index + ' successfully (' + page.width + 'x' + page.height + ')');
                    } catch (err) {
                        logs.push('Failed to extract moves for page ' + index + ': ' + err.toString());
                        images.push('comix-scrambled:' + btoa(JSON.stringify({
                            url: location.href,
                            page: index,
                        })));
                    }
                }

                if (images.length === 0) {
                    throw new Error('Comix.to API returned no chapter pages.');
                }

                return JSON.stringify({
                    chapterId,
                    images,
                    scrambled: scrambledCount,
                    logs
                });
            })()
        "#;

        let remote_obj = tab
            .evaluate(script, true)
            .map_err(|e| format!("Comix.to eval failed: {}", e))?;
        let json_str = remote_obj
            .value
            .and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string()))
            .ok_or("No string returned from Comix.to page context")?;
        let value: serde_json::Value = serde_json::from_str(&json_str)
            .map_err(|e| format!("Comix.to JSON parse failed: {}", e))?;

        if let Some(logs) = value.get("logs").and_then(|v| v.as_array()) {
            for log in logs {
                if let Some(log_str) = log.as_str() {
                    println!("[Rust Comix.to Headless Log] {}", log_str);
                }
            }
        }

        let images: Vec<String> = value
            .get("images")
            .and_then(|v| v.as_array())
            .map(|items| {
                items
                    .iter()
                    .filter_map(|item| item.as_str().map(|s| s.to_string()))
                    .collect()
            })
            .unwrap_or_default();

        if images.is_empty() {
            return Err("Comix.to returned 0 chapter pages".to_string());
        }

        println!(
            "[Rust Comix.to] Extracted {} page URL(s) from page context.",
            images.len()
        );
        Ok::<Vec<String>, String>(images)
    })
    .await
    .map_err(|e| format!("Comix.to headless task failed: {}", e))??;

    Ok(images)
}

#[command]
async fn scrape_series_headless(url: String) -> Result<SeriesScrapeResult, String> {
    println!("[Rust] Starting headless series scrape for: {}", url);

    let result = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
                std::ffi::OsStr::new("--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;

        println!("[Rust] Navigating to {}...", url);
        tab.navigate_to(&url).map_err(|e| format!("Nav failed: {}", e))?;
        let _ = tab.wait_until_navigated(); // Non-critical wait
        
        // 1.5 Settlement Delay
        std::thread::sleep(std::time::Duration::from_millis(2000));
        
        // 2. Wait for Title or Proof of Content
        println!("[Rust] Waiting for content load (60s max)...");
        let wait_content = r#"document.querySelector('h1, .title, .w-title, [class*="title"], [data-testid="title"]') !== null"#;
        let mut retries = 0;
        while retries < 60 { 
            if let Ok(obj) = tab.evaluate(wait_content, true) {
                if obj.value.and_then(|v: serde_json::Value| v.as_bool()).unwrap_or(false) { break; }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
            retries += 1;
        }

        // 3. Extra Delay for Hydration/Lazy Loads (10s)
        println!("[Rust] Waiting 10s for hydration and animations...");
        std::thread::sleep(std::time::Duration::from_millis(10000));

        // 4. Scroll to Bottom (Trigger Lazy Load)
        println!("[Rust] Scrolling to bottom...");
        let _ = tab.evaluate("window.scrollTo(0, document.body.scrollHeight)", true);
        std::thread::sleep(std::time::Duration::from_millis(5000));

        // 5. Extraction Script
        let extract_script = r#"
            (async () => {
                try {
                    const url = window.location.href;
                    let title = '', description = '', cover = '';
                    let links = [];

                    // 1. Extract Title
                    const titleEl = document.querySelector('h1, .story-info-right h1, .w-title, .title, .manga-title, [class*="title"], [data-testid="series-title"], .text-foreground.text-2xl.font-bold');
                    title = titleEl?.textContent?.trim() || document.title.split(' - ')[0].trim() || 'Untitled';

                    // 2. Extract Description
                    const descEl = document.querySelector('.summary, .description, .synopsis, .blurb, .w-description, .manga-description, .panel-story-info-description, #noidungm, [class*="description"], .text-muted-foreground.text-sm.font-medium, p');
                    description = descEl?.textContent?.trim() || '';

                    // 3. Extract Cover
                    const coverMeta = document.querySelector('meta[property="og:image"]')?.content;
                    const coverImg = document.querySelector('.story-info-left img, .img-thumb img, .cover img, .manga-cover img, img.rounded-lg, img[alt*="cover"], img[src*="cover"]');
                    cover = coverMeta || (coverImg ? (coverImg.src || coverImg.dataset.src) : '');

                    // 4. Extract Links (Unified & Aggressive)
                    const linkSet = new Set();
                    
                    // 4.1 Try to click "Chapters" tab, "Load More", or specific chapter containers
                    const expanders = Array.from(document.querySelectorAll('button, a, div, li, span'))
                        .filter(el => {
                            const t = el.textContent.toLowerCase();
                            const id = el.id?.toLowerCase() || '';
                            const cls = el.className?.toLowerCase() || '';
                            return t.includes('chapters') || t.includes('show all') || t.includes('load more') || 
                                   t.includes('expand') || id.includes('chapter') || cls.includes('chapter') ||
                                   cls.includes('more-button') || id.includes('more-button');
                        });
                    expanders.forEach(b => { try { b.click(); } catch(e) {} });
                    if (expanders.length > 0) await new Promise(r => setTimeout(r, 4000));

                    const scan = (doc) => {
                        // Check common Madara/MangaStream chapter list containers first
                        doc.querySelectorAll('.wp-manga-chapter, .chapter-link, li[class*="chapter"], #chapterlist li').forEach(el => {
                            const a = el.querySelector('a') || (el.tagName === 'A' ? el : null);
                            if (a) {
                                const href = a.getAttribute('href') || '';
                                if (href.length > 5) linkSet.add(href);
                            }
                        });

                        doc.querySelectorAll('a[href]').forEach(a => {
                            let href = a.getAttribute('href') || '';
                            if (!href || href.startsWith('#') || href.startsWith('javascript:')) return;
                            
                            // Resolve relative
                            if (href.startsWith('//')) href = window.location.protocol + href;
                            else if (href.startsWith('/')) href = window.location.origin + href;
                            else if (!href.startsWith('http')) href = window.location.origin + '/' + href;

                            const text = a.textContent?.trim() || '';
                            const id = a.id || '';
                            const cls = a.className || '';
                            
                            if (
                                 href.includes('/chapter-') ||
                                 href.includes('/read/') ||
                                 href.includes('/viewer/') ||
                                 href.includes('/ch-') ||
                                 /chapter\s*\d+/i.test(text) ||
                                 /ch\.\s*\d+/i.test(text) ||
                                 /cap[íi]tulo\s*\d+/i.test(text) ||
                                 /vol\.\s*\d+/i.test(text) ||
                                 cls.includes('chapter') ||
                                 id.includes('chapter') ||
                                 id.includes('cl-') ||
                                 (href.includes('webnovel.com/book/') && !href.endsWith('/catalog') && href.split('/').filter(Boolean).length > 4)
                             ) {
                                if (href.length > 5) linkSet.add(href);
                            }
                        });
                    };

                    scan(document);
                    // Scan iframes
                    document.querySelectorAll('iframe').forEach(f => {
                        try { if (f.contentDocument) scan(f.contentDocument); } catch(e) {}
                    });

                    links = Array.from(linkSet);
                    
                    // 5. Extract Tags (Enhanced)
                    const tagSelectors = ['.genres a', '.tags a', '.series-genres a', 'a[href*="/genre/"]', 'a[href*="/tags/"]', '.tag-item', '.genre-item', '.manga-tags a'];
                    const tagSet = new Set();
                    tagSelectors.forEach(sel => {
                        document.querySelectorAll(sel).forEach(el => {
                            const t = el.textContent?.trim();
                            if (t && t.length > 2 && t.length < 30 && !t.includes('Chapter') && !t.includes('Next')) {
                                tagSet.add(t);
                            }
                        });
                    });
                    const tags = Array.from(tagSet);

                    // Normalize URLs
                    if (cover && cover.startsWith('//')) cover = 'https:' + cover;
                    if (cover && cover.startsWith('/')) cover = window.location.origin + cover;

                    const finalLinks = links
                        .filter(h => h && h.length > 5 && !h.startsWith('javascript:'))
                        .map(href => {
                            try { return new URL(href, window.location.origin).href; } catch(e) { return href; }
                        });

                    return JSON.stringify({ 
                        title, 
                        description, 
                        coverUrl: cover, 
                        tags,
                        chapterLinks: finalLinks
                    });
                } catch (e) {
                    return JSON.stringify({ error: e.toString() });
                }
            })()
        "#;

        println!("[Rust] Executing extraction script...");
        let remote_obj = tab.evaluate(extract_script, true).map_err(|e| format!("Eval failed: {}", e))?;
        let json_str = remote_obj.value.and_then(|v: serde_json::Value| v.as_str().map(|s| s.to_string()))
            .ok_or("No string returned from evaluation context")?;
        
        let val: serde_json::Value = serde_json::from_str(&json_str).map_err(|e| format!("JSON Parse failed: {}", e))?;
        
        if let Some(err) = val.get("error").and_then(|v| v.as_str()) {
            return Err(format!("Headless JS Error: {}", err));
        }

        let title = val.get("title").and_then(|v| v.as_str()).unwrap_or("Untitled").to_string();
        let description = val.get("description").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let cover_url = val.get("coverUrl").and_then(|v| v.as_str()).unwrap_or("").to_string();
        let tags: Vec<String> = val.get("tags").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();
        let chapter_links: Vec<String> = val.get("chapterLinks").and_then(|v| v.as_array())
            .map(|arr| arr.iter().filter_map(|x| x.as_str().map(|s| s.to_string())).collect())
            .unwrap_or_default();

        println!("[Rust] Extracted: Title='{}', Chapters={}, Tags={:?}", title, chapter_links.len(), tags);

        if chapter_links.is_empty() {
             println!("[Rust] WARNING: 0 chapters found. Capturing debug screenshot...");
             let _ = tab.capture_screenshot(headless_chrome::protocol::cdp::Page::CaptureScreenshotFormatOption::Png, None, None, true)
                 .map(|png| std::fs::write(std::env::temp_dir().join("headless_extraction_failed.png"), png));
             return Err("Found 0 chapters. Page might be blocked (Cloudflare) or layout changed. Check headless_extraction_failed.png in temp dir".to_string());
        }

        Ok::<SeriesScrapeResult, String>(SeriesScrapeResult {
            title, description, cover_url, tags, chapter_links
        })
    }).await.map_err(|e| format!("Task failed: {}", e))??;

    Ok(result)
}

#[command]
async fn read_file_string(path: String) -> Result<String, String> {
    std::fs::read_to_string(path).map_err(|e| e.to_string())
}

#[command]
async fn set_manga_cover(series_path: String, source_path: String) -> Result<String, String> {
    let s_path = Path::new(&series_path);
    let src_path = Path::new(&source_path);

    if !s_path.exists() {
        return Err("Series path does not exist".to_string());
    }
    if !src_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    // 1. Determine new filename (unique to avoid locking)
    let ext = src_path
        .extension()
        .and_then(|s| s.to_str())
        .unwrap_or("jpg");
    let timestamp = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_millis();
    let new_filename = format!("cover_{}.{}", timestamp, ext);
    let dest_path = s_path.join(&new_filename);

    // 2. Copy file
    fs::copy(src_path, &dest_path).map_err(|e| format!("Failed to copy cover: {}", e))?;

    // 3. Update metadata.json and find old cover
    let meta_path = s_path.join("metadata.json");
    let mut meta_json = if meta_path.exists() {
        let content = fs::read_to_string(&meta_path).unwrap_or_else(|_| "{}".to_string());
        serde_json::from_str(&content).unwrap_or_else(|_| serde_json::json!({}))
    } else {
        serde_json::json!({})
    };

    let old_cover = meta_json["coverFile"].as_str().map(|s| s.to_string());

    meta_json["coverFile"] = serde_json::Value::String(new_filename.clone());

    let f = fs::File::create(&meta_path).map_err(|e| e.to_string())?;
    serde_json::to_writer_pretty(f, &meta_json).map_err(|e| e.to_string())?;

    // 4. Cleanup old cover (Best effort)
    if let Some(old) = old_cover {
        if old != new_filename {
            let old_path = s_path.join(old);
            if old_path.exists() {
                // Ignore errors (file might be locked/in use)
                let _ = fs::remove_file(old_path);
            }
        }
    } else {
        // Also try to remove default "cover.jpg" if we just switched to unique
        let default = s_path.join("cover.jpg");
        if default.exists() && default != dest_path {
            let _ = fs::remove_file(default);
        }
    }

    Ok(normalize_path(&dest_path))
}

#[command]
async fn remove_manga_cover(series_path: String) -> Result<(), String> {
    let s_path = Path::new(&series_path);
    let meta_path = s_path.join("metadata.json");

    let mut cover_to_remove = None;

    // 1. Update metadata.json to remove coverFile AND get the file to remove
    if meta_path.exists() {
        if let Ok(content) = fs::read_to_string(&meta_path) {
            if let Ok(mut json) = serde_json::from_str::<serde_json::Value>(&content) {
                if let Some(obj) = json.as_object_mut() {
                    if let Some(val) = obj.get("coverFile") {
                        cover_to_remove = val.as_str().map(|s| s.to_string());
                    }
                    obj.remove("coverFile");
                }
                let f = fs::File::create(&meta_path).map_err(|e| e.to_string())?;
                serde_json::to_writer_pretty(f, &json).map_err(|e| e.to_string())?;
            }
        }
    }

    // 2. Remove the actual cover file
    if let Some(filename) = cover_to_remove {
        let p = s_path.join(filename);
        if p.exists() {
            fs::remove_file(p).map_err(|e| e.to_string())?;
        }
    } else {
        // Fallback: try removing default cover.jpg if metadata didn't have it
        let cover_path = s_path.join("cover.jpg");
        if cover_path.exists() {
            fs::remove_file(cover_path).map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[command]
async fn generate_chapter_thumbnail(
    chapter_path: String,
    series_path: String,
) -> Result<String, String> {
    let ch_path = Path::new(&chapter_path);
    let s_path = Path::new(&series_path);
    let img_extensions = ["jpg", "jpeg", "png", "webp"];

    if !ch_path.exists() {
        return Err("Chapter path does not exist".to_string());
    }

    // 1. Collect and sort images
    let mut images: Vec<_> = fs::read_dir(ch_path)
        .map_err(|e| e.to_string())?
        .filter_map(|e| e.ok())
        .filter(|e| {
            e.path().is_file()
                && e.path()
                    .extension()
                    .and_then(|ext| ext.to_str())
                    .map(|ext| img_extensions.contains(&ext.to_lowercase().as_str()))
                    .unwrap_or(false)
        })
        .collect();

    images.sort_by_key(|e| e.file_name());

    if images.is_empty() {
        return Err("No images found in chapter path".to_string());
    }

    // 2. Determine chapter name for thumbnail filename
    let ch_name = ch_path
        .file_name()
        .and_then(|s| s.to_str())
        .unwrap_or("unknown");
    let thumb_filename = format!("thumb_{}.jpg", sanitize_filename(ch_name));
    let dest_path = s_path.join(&thumb_filename);

    // 3. Pick a random-ish image from the middle (25% - 75%)
    let len = images.len();
    let mid_start = len / 4;
    let mid_end = (len * 3) / 4;

    // Deterministic selection based on path hash
    let hash: usize = chapter_path.bytes().fold(0usize, |acc, b| {
        acc.wrapping_mul(31).wrapping_add(b as usize)
    });
    let range = if mid_end > mid_start {
        mid_end - mid_start
    } else {
        1
    };
    let idx = mid_start + (hash % range);
    let chosen_idx = idx.min(len - 1);

    let src_path = images[chosen_idx].path();

    // 4. Copy to series path
    fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy thumbnail: {}", e))?;

    Ok(normalize_path(&dest_path))
}

#[command]
fn get_cwd() -> Result<String, String> {
    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let mut current = Some(cwd.as_path());
    while let Some(path) = current {
        if path.join("package.json").exists() {
            return Ok(path.to_string_lossy().to_string());
        }
        current = path.parent();
    }
    Ok(cwd.to_string_lossy().to_string())
}

#[derive(Serialize)]
pub struct AmbientSound {
    name: String,
    path: String,
    playlist: String,
}

fn get_local_audio_root(cwd: &Path) -> std::path::PathBuf {
    let mut current = Some(cwd);
    while let Some(path) = current {
        if path.join("package.json").exists() {
            return path.join("assets").join("audio");
        }
        current = path.parent();
    }
    cwd.join("assets").join("audio")
}

/// Scan `assets/audio/` (relative to cwd) for offline music tracks.
/// Each sub-folder becomes a named playlist (e.g. lofi, rain, fantasy).
/// Supported formats: mp3, ogg, wav
#[command]
async fn list_ambient_sounds(app: AppHandle, custom_folders: Vec<String>) -> Result<Vec<AmbientSound>, String> {
    let mut audio_roots = Vec::new();

    // 1. Check Tauri resource directory (for bundled/packaged assets)
    if let Ok(resource_dir) = app.path().resource_dir() {
        // A resource declared as ../assets/audio is stored below `_up_` by
        // Tauri's bundler. Keep the direct path too for alternative targets
        // and older development bundles.
        let packaged_candidates = [
            resource_dir.join("assets").join("audio"),
            resource_dir.join("_up_").join("assets").join("audio"),
        ];
        for resource_audio in packaged_candidates {
            if resource_audio.exists() && !audio_roots.contains(&resource_audio) {
                audio_roots.push(resource_audio);
            }
        }
    }

    // 2. Check current working directory (for development or custom local folders)
    if let Ok(cwd) = std::env::current_dir() {
        let local_audio = get_local_audio_root(&cwd);
        if local_audio.exists() && !audio_roots.contains(&local_audio) {
            audio_roots.push(local_audio);
        }
    }

    // If no directories exist, create the local lofi directory as a fallback
    if audio_roots.is_empty() {
        if let Ok(cwd) = std::env::current_dir() {
            let audio_root = get_local_audio_root(&cwd);
            fs::create_dir_all(&audio_root).map_err(|e| e.to_string())?;
            fs::create_dir_all(audio_root.join("lofi")).map_err(|e| e.to_string())?;
            audio_roots.push(audio_root);
        }
    }

    // 3. Add custom folders requested by frontend
    for folder in custom_folders {
        let path = Path::new(&folder).to_path_buf();
        if path.exists() && path.is_dir() && !audio_roots.contains(&path) {
            audio_roots.push(path);
        }
    }

    let supported = ["mp3", "ogg", "wav", "dat"];
    let mut sounds = Vec::new();

    for audio_root in audio_roots {
        // We'll use the root directory name as the default playlist name for files directly inside it
        let root_playlist_name = audio_root
            .file_name()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string();

        let mut root_manifest: serde_json::Value = serde_json::json!({});
        if let Ok(manifest_content) = fs::read_to_string(audio_root.join("audio_manifest.json")) {
            if let Ok(json) = serde_json::from_str(&manifest_content) {
                root_manifest = json;
            }
        }

        if let Ok(entries) = fs::read_dir(&audio_root) {
            for entry in entries.flatten() {
                let path = entry.path();
                
                if path.is_dir() {
                    // It's a sub-folder (playlist)
                    let playlist_name = path
                        .file_name()
                        .unwrap_or_default()
                        .to_string_lossy()
                        .to_string();

                    let mut manifest: serde_json::Value = serde_json::json!({});
                    if let Ok(manifest_content) = fs::read_to_string(path.join("audio_manifest.json")) {
                        if let Ok(json) = serde_json::from_str(&manifest_content) {
                            manifest = json;
                        }
                    }

                    if let Ok(file_entries) = fs::read_dir(&path) {
                        for file_entry in file_entries.flatten() {
                            let file_path = file_entry.path();
                            if file_path.is_file() {
                                if let Some(ext) = file_path.extension().and_then(|s| s.to_str()) {
                                    if supported.contains(&ext.to_lowercase().as_str()) {
                                        let path_str = normalize_path(&file_path);
                                        if !sounds.iter().any(|s: &AmbientSound| s.path == path_str) {
                                            let file_name = file_path.file_name().unwrap_or_default().to_string_lossy().to_string();
                                            let mut track_name = file_path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                                            if let Some(mapped) = manifest.get(&file_name).and_then(|m| m.get("name")).and_then(|n| n.as_str()) {
                                                track_name = mapped.to_string();
                                            }
                                            sounds.push(AmbientSound {
                                                name: track_name,
                                                path: path_str,
                                                playlist: playlist_name.clone(),
                                            });
                                        }
                                    }
                                }
                            }
                        }
                    }
                } else if path.is_file() {
                    // It's a file directly inside the root folder
                    if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                        if supported.contains(&ext.to_lowercase().as_str()) {
                            let path_str = normalize_path(&path);
                            if !sounds.iter().any(|s: &AmbientSound| s.path == path_str) {
                                let file_name = path.file_name().unwrap_or_default().to_string_lossy().to_string();
                                let mut track_name = path.file_stem().unwrap_or_default().to_string_lossy().to_string();
                                if let Some(mapped) = root_manifest.get(&file_name).and_then(|m| m.get("name")).and_then(|n| n.as_str()) {
                                    track_name = mapped.to_string();
                                }
                                sounds.push(AmbientSound {
                                    name: track_name,
                                    path: path_str,
                                    playlist: root_playlist_name.clone(),
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    log::info!("Discovered {} ambient audio tracks", sounds.len());
    Ok(sounds)
}

/// Copy an audio file into the lofi playlist folder so it is auto-discovered.
#[command]
async fn import_ambient_sound(_app: AppHandle, path: String) -> Result<AmbientSound, String> {
    let src_path = Path::new(&path);
    if !src_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    let cwd = std::env::current_dir().map_err(|e| e.to_string())?;
    let audio_root = get_local_audio_root(&cwd);
    let lofi_dir = audio_root.join("lofi");

    if !lofi_dir.exists() {
        fs::create_dir_all(&lofi_dir).map_err(|e| e.to_string())?;
    }

    let dest_filename = src_path.file_name().ok_or("Invalid filename")?;
    let dest_path = lofi_dir.join(dest_filename);

    fs::copy(src_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(AmbientSound {
        name: dest_path
            .file_stem()
            .unwrap_or_default()
            .to_string_lossy()
            .to_string(),
        path: normalize_path(&dest_path),
        playlist: "lofi".to_string(),
    })
}

#[derive(Serialize)]
pub struct ValidationResult {
    id: String,
    is_valid: bool,
}

#[command]
async fn validate_chapter_contents(series_path: String) -> Result<Vec<ValidationResult>, String> {
    let root = Path::new(&series_path);
    if !root.exists() {
        return Err("Series path does not exist".to_string());
    }

    let mut results = Vec::new();
    let img_extensions = ["jpg", "jpeg", "png", "webp"];

    // 1. Check chapters dir
    let chapters_dir = root.join("chapters");
    if !chapters_dir.exists() {
        return Ok(results);
    }

    if let Ok(entries) = fs::read_dir(&chapters_dir) {
        for entry in entries.filter_map(|e| e.ok()) {
            if entry.path().is_dir() {
                let folder_id = entry.file_name().to_string_lossy().to_string();
                let mut has_valid_images = false;
                let mut is_corrupt = false;
                let mut page_count = 0;

                if let Ok(images) = fs::read_dir(entry.path()) {
                    for img in images.filter_map(|e| e.ok()) {
                        if let Some(ext) = img.path().extension().and_then(|s| s.to_str()) {
                            if img_extensions.contains(&ext.to_lowercase().as_str()) {
                                page_count += 1;
                                if let Ok(meta) = fs::metadata(img.path()) {
                                    if meta.len() > 0 {
                                        has_valid_images = true;
                                    } else {
                                        is_corrupt = true;
                                        break;
                                    }
                                }
                            }
                        }
                    }
                }

                results.push(ValidationResult {
                    id: format!("{}-{}", series_path, folder_id),
                    is_valid: has_valid_images && !is_corrupt && page_count > 0,
                });
            }
        }
    }

    Ok(results)
}

#[command]
async fn wipe_manga_contents(path: String) -> Result<(), String> {
    let p = Path::new(&path);
    if !p.exists() || !p.is_dir() {
        return Err("Invalid path".to_string());
    }

    for entry in fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();

        if let Some(name) = entry_path.file_name().and_then(|s| s.to_str()) {
            let n = name.to_lowercase();
            if n.starts_with("cover") || n == "metadata.json" {
                continue;
            }
        }

        if entry_path.is_dir() {
            fs::remove_dir_all(entry_path).map_err(|e| e.to_string())?;
        } else {
            fs::remove_file(entry_path).map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

#[command]
async fn open_auth_window(app: tauri::AppHandle, url: String, provider_id: String) -> Result<(), String> {
    use tauri::webview::WebviewWindowBuilder;
    use tauri::Emitter;

    let init_script = r#"
        setInterval(() => {
            let cookies = "";
            try {
                cookies = document.cookie;
            } catch (e) {}
            let ls = "";
            try {
                ls = JSON.stringify(window.localStorage);
            } catch (e) {}
            
            if ((cookies && (cookies.includes('ipb_member_id') || cookies.includes('pass_hash') || cookies.includes('_sankakuchannel_session') || cookies.includes('accessToken=') || cookies.includes('access_token=') || cookies.includes('sessionid='))) ||
                (ls && (ls.includes('access_token') || ls.includes('token') || ls.includes('user_id')))) {
                const targetUrl = 'https://flowmanga.local/auth-callback?provider=PROVIDER_ID&cookie=' + encodeURIComponent(cookies || "") + '&ls=' + encodeURIComponent(ls);
                window.location.replace(targetUrl);
            }
        }, 2000);
    "#.replace("PROVIDER_ID", &provider_id);

    let parsed_url = url.parse().map_err(|_| "Invalid URL".to_string())?;
    let app_clone = app.clone();
    let label = format!("auth_window_{}", provider_id);

    let _window = WebviewWindowBuilder::new(
        &app,
        label,
        tauri::WebviewUrl::External(parsed_url),
    )
    .title(format!("Login to {}", provider_id))
    .inner_size(800.0, 600.0)
    .initialization_script(&init_script)
    .on_navigation(move |url| {
        if url.as_str().starts_with("https://flowmanga.local/auth-callback") {
            let _ = app_clone.emit("auth-cookies-extracted", url.as_str());
            return false;
        }
        true
    })
    .build()
    .map_err(|e| e.to_string())?;

    Ok(())
}

#[command]
async fn auto_extract_cookies(domains: Vec<String>) -> Result<String, String> {
    let domain_refs: Option<Vec<String>> = if domains.is_empty() {
        None
    } else {
        Some(domains)
    };

    match rookie::load(domain_refs) {
        Ok(cookies) => {
            let mut cookie_str = String::new();
            for cookie in cookies {
                cookie_str.push_str(&format!("{}={}; ", cookie.name, cookie.value));
            }
            Ok(cookie_str)
        },
        Err(e) => Err(format!("Failed to extract cookies from system browsers: {}", e))
    }
}

#[command]
async fn show_path_in_file_manager(path: String) -> Result<(), String> {
    use std::process::Command;
    
    #[cfg(target_os = "windows")]
    {
        Command::new("explorer")
            .args(["/select,", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "macos")]
    {
        Command::new("open")
            .args(["-R", &path])
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    #[cfg(target_os = "linux")]
    {
        Command::new("xdg-open")
            .arg(&path)
            .spawn()
            .map_err(|e| e.to_string())?;
    }
    
    Ok(())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_http::init())
        .register_asynchronous_uri_scheme_protocol("flowmanga", |_ctx, request, responder| {
            tauri::async_runtime::spawn(async move {
                let uri = request.uri().to_string();
                if let Ok(parsed_url) = url::Url::parse(&uri) {
                    if parsed_url.path() == "/image-proxy" {
                        let query_params: std::collections::HashMap<_, _> = parsed_url.query_pairs().into_owned().collect();
                        if let Some(target_url) = query_params.get("url") {
                            let mut user_agent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";
                            if target_url.contains("donmai.us") {
                                user_agent = "FlowManga/1.0";
                            }
                            let client = reqwest::Client::builder()
                                .user_agent(user_agent)
                                .build();
                            
                            if let Ok(c) = client {
                                let mut req = c.get(target_url);
                                let stream_media = query_params.get("stream").map(|value| value == "1").unwrap_or(false);
                                let requested_range = request.headers()
                                    .get("range")
                                    .and_then(|value| value.to_str().ok())
                                    .map(|value| value.to_string());
                                if stream_media {
                                    // Bound each response so playback begins without
                                    // buffering the complete remote video first.
                                    let bounded_range = requested_range.as_deref()
                                        .and_then(|value| value.strip_prefix("bytes="))
                                        .and_then(|value| value.split('-').next())
                                        .and_then(|value| value.parse::<u64>().ok())
                                        .map(|start| format!("bytes={}-{}", start, start.saturating_add(1024 * 1024 - 1)))
                                        .unwrap_or_else(|| "bytes=0-1048575".to_string());
                                    req = req.header("Range", bounded_range);
                                } else if let Some(range) = requested_range {
                                    req = req.header("Range", range);
                                }
                                let mut referer_str = None;
                                if let Some(referer) = query_params.get("referer") {
                                    referer_str = Some(referer.to_string());
                                } else if let Ok(target_parsed) = url::Url::parse(target_url) {
                                    if let Some(host) = target_parsed.host_str() {
                                        let host_lower = host.to_lowercase();
                                        if host_lower.contains("donmai.us") {
                                            referer_str = Some("https://danbooru.donmai.us/".to_string());
                                        } else if host_lower.contains("pximg.net") || host_lower.contains("pixiv.net") {
                                            referer_str = Some("https://www.pixiv.net/".to_string());
                                        } else if host_lower.contains("sankaku") {
                                            referer_str = Some("https://chan.sankakucomplex.com/".to_string());
                                        } else if host_lower.contains("rule34") {
                                            referer_str = Some("https://rule34.xxx/".to_string());
                                        } else if host_lower.contains("gelbooru") {
                                            referer_str = Some("https://gelbooru.com/".to_string());
                                        } else if host_lower.contains("ehgt.org") {
                                            referer_str = Some("https://e-hentai.org/".to_string());
                                        } else {
                                            referer_str = Some(format!("https://{}/", host));
                                        }
                                    }
                                }
                                if let Some(ref r) = referer_str {
                                    req = req.header("Referer", r);
                                }

                                
                                if let Ok(res) = req.send().await {
                                    let status = res.status().as_u16();
                                    let content_type = res.headers()
                                        .get("content-type")
                                        .and_then(|v| v.to_str().ok())
                                        .unwrap_or("application/octet-stream")
                                        .to_string();
                                    let content_range = res.headers().get("content-range").and_then(|value| value.to_str().ok()).map(str::to_string);
                                    let accept_ranges = res.headers().get("accept-ranges").and_then(|value| value.to_str().ok()).map(str::to_string);
                                    let content_length = res.headers().get("content-length").and_then(|value| value.to_str().ok()).map(str::to_string);
                                    if let Ok(bytes) = res.bytes().await {
                                        let mut builder = tauri::http::Response::builder()
                                            .status(status)
                                            .header("Content-Type", content_type)
                                            .header("Access-Control-Allow-Origin", "*");
                                        if let Some(value) = content_range { builder = builder.header("Content-Range", value); }
                                        if let Some(value) = accept_ranges { builder = builder.header("Accept-Ranges", value); }
                                        if let Some(value) = content_length { builder = builder.header("Content-Length", value); }
                                        let response = builder.body(bytes.to_vec()).unwrap();
                                        responder.respond(response);
                                        return;
                                    }
                                }
                            }
                        }
                    }
                }
                
                let error_response = tauri::http::Response::builder()
                    .status(404)
                    .header("Content-Type", "text/plain")
                    .header("Access-Control-Allow-Origin", "*")
                    .body(vec![])
                    .unwrap();
                responder.respond(error_response);
            });
        })

        .plugin(tauri_plugin_log::Builder::default().level(log::LevelFilter::Info).build())
        .plugin(tauri_plugin_sql::Builder::default().build())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_cli::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            scan_video_folder,
            scan_manga_folder,
            read_folder,
            scan_chapters,
            download_image,
            fetch_html,
            fetch_html_headless,
            fetch_json,
            fetch_json_headless,
            scrape_images_headless,
            scrape_comix_chapter_headless,
            scrape_series_headless,
            read_file_string,
            set_manga_cover,
            remove_manga_cover,
            generate_chapter_thumbnail,
            list_ambient_sounds,
            import_ambient_sound,
            validate_chapter_contents,
            wipe_manga_contents,
            open_auth_window,
            auto_extract_cookies,
            show_path_in_file_manager,
            fetch_binary,
            compute_image_dhash,
            get_cwd
        ])
        .setup(|app| {
            use tauri_plugin_cli::CliExt;
            match app.cli().matches() {
                Ok(matches) => {
                    if let Some(arg) = matches.args.get("path") {
                        if let Some(path) = arg.value.as_str() {
                            let path_str = path.to_string();
                            let app_handle = app.handle().clone();
                            tauri::async_runtime::spawn(async move {
                                std::thread::sleep(std::time::Duration::from_millis(1500));
                                let _ = app_handle.emit("open-path", path_str);
                            });
                        }
                    }
                }
                Err(e) => {
                    eprintln!("Failed to get CLI matches: {}", e);
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
