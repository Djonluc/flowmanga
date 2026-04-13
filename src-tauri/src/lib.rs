use tauri::{command, Emitter, AppHandle, Manager};
use walkdir::WalkDir;
use serde::Serialize;
use uuid::Uuid;
use std::fs;
use std::io;
use std::path::Path;

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

    for entry in WalkDir::new(&path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_file() {
            if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                    let file_path = normalize_path(entry.path());
                    let title = entry.path().file_stem()
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
    name.replace(&['/', '\\', '?', '%', '*', ':', '|', '"', '<', '>'][..], "_")
}

// Helper: Auto-migrate messy folders to Standard Structure
fn migrate_to_standard(path: &Path) -> io::Result<()> {
    let chapters_dir = path.join("chapters");
    if !chapters_dir.exists() {
        fs::create_dir(&chapters_dir)?;
    }

    let img_extensions = ["jpg", "jpeg", "png", "webp"];
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
                if name.eq_ignore_ascii_case("cover.jpg") || name.eq_ignore_ascii_case("metadata.json") {
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
        if !ch001.exists() { fs::create_dir(&ch001)?; }
        
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
            let num: i32 = folder_name.chars()
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

    // 3. Generate Metadata if missing
    let meta_path = path.join("metadata.json");
    if !meta_path.exists() && (moved_images || moved_folders) {
         let title = path.file_name().unwrap_or_default().to_string_lossy().to_string();
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
    
    let process_folder = |folder_path: &Path| -> Option<MangaMetadata> {
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
             let img_extensions = ["jpg", "jpeg", "png", "webp"];
             if let Ok(entries) = fs::read_dir(folder_path) {
                 for e in entries.flatten() {
                     let p = e.path();
                     if p.is_file() {
                         if let Some(ext) = p.extension().and_then(|s| s.to_str()) {
                             if img_extensions.contains(&ext.to_lowercase().as_str()) {
                                 // Don't count cover.jpg as content requiring migration if it's the *only* thing
                                 if !p.file_name().unwrap().to_string_lossy().eq_ignore_ascii_case("cover.jpg") {
                                      has_content = true; 
                                 }
                             }
                         }
                     } else if p.is_dir() {
                         // Shallow check for images in subfolder
                          if let Ok(sub) = fs::read_dir(&p) {
                              for s in sub.flatten() {
                                   if let Some(ext) = s.path().extension().and_then(|str| str.to_str()) {
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
                 needs_migration = true;
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

             let folder_name = folder_path.file_name().unwrap_or_default().to_string_lossy().to_string();
             
             let title = meta_json.as_ref()
                .and_then(|j| j["title"].as_str().or(j["displayTitle"].as_str()))
                .map(|s| s.to_string())
                .unwrap_or_else(|| folder_name.clone());

             let author = meta_json.as_ref().and_then(|j| j["author"].as_str()).map(|s| s.to_string());
             let description = meta_json.as_ref().and_then(|j| j["description"].as_str()).map(|s| s.to_string());
             let tags = meta_json.as_ref().and_then(|j| j["tags"].as_array())
                .map(|arr| arr.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect());
             let total_chapters = meta_json.as_ref().and_then(|j| j["totalChapters"].as_i64().or(j["total_chapters"].as_i64())).map(|i| i as i32);
             let version = meta_json.as_ref().and_then(|j| j["version"].as_f64()).map(|f| f as f32);
             let source_url = meta_json.as_ref().and_then(|j| j["sourceUrl"].as_str()).map(|s| s.to_string());
             let manga_id = meta_json.as_ref().and_then(|j| j["mangaId"].as_str()).map(|s| s.to_string());

             let mut cover_path = None;
             // 1. explicit coverFile in metadata
             if let Some(cf) = meta_json.as_ref().and_then(|j| j["coverFile"].as_str()) {
                 let p = folder_path.join(cf);
                 if p.exists() { cover_path = Some(normalize_path(&p)); }
             }
             // 2. cover.jpg at root
             if cover_path.is_none() {
                 let p = folder_path.join("cover.jpg");
                 if p.exists() { cover_path = Some(normalize_path(&p)); }
             }
             // 3. Robust fallback: check first few chapters for a cover
             if cover_path.is_none() {
                 let ch_dir = folder_path.join("chapters");
                 if let Ok(entries) = fs::read_dir(ch_dir) {
                     let mut subdirs: Vec<_> = entries.flatten().filter(|e| e.path().is_dir()).collect();
                     subdirs.sort_by_key(|e| e.file_name()); // Try to find 001 first
                     for entry in subdirs {
                         let p = entry.path().join("cover.jpg");
                         if p.exists() { 
                             cover_path = Some(normalize_path(&p));
                             break;
                         }
                     }
                 }
             }

             return Some(MangaMetadata {
                 id: manga_id.clone().unwrap_or_else(|| Uuid::new_v4().to_string()),
                 file_path: normalize_path(folder_path),
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
    if let Some(m) = process_folder(root_path) {
        manga.push(m);
    }

    // 2. Check Subdirectories (Library Mode)
    for entry in WalkDir::new(root_path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
        if entry.file_type().is_dir() && entry.path() != root_path {
            if let Some(m) = process_folder(entry.path()) {
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
    let img_extensions = ["jpg", "jpeg", "png", "webp"];

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
            let folder_name = folder_path.file_name().unwrap_or_default().to_string_lossy().to_string();

            // Extract chapter number from folder name (e.g., "001" -> 1.0, "Chapter 5" -> 5.0)
            let chapter_num: f32 = folder_name.chars()
                .filter(|c| c.is_numeric() || *c == '.')
                .collect::<String>()
                .parse()
                .unwrap_or(0.0);

            // Find first image as chapter cover
            let mut cover_path: Option<String> = None;
            let mut page_files: Vec<_> = fs::read_dir(&folder_path)
                .ok()
                .map(|entries| entries.filter_map(|e| e.ok())
                    .filter(|e| {
                        e.path().is_file() && e.path().extension()
                            .and_then(|ext| ext.to_str())
                            .map(|ext| img_extensions.contains(&ext.to_lowercase().as_str()))
                            .unwrap_or(false)
                    })
                    .collect())
                .unwrap_or_default();
            page_files.sort_by_key(|e| e.file_name());

            // Pick a random image as chapter cover (hash-based for determinism)
            if !page_files.is_empty() {
                let hash: usize = folder_name.bytes().fold(0usize, |acc, b| acc.wrapping_mul(31).wrapping_add(b as usize));
                let idx = hash % page_files.len();
                cover_path = Some(normalize_path(&page_files[idx].path()));
            }

            if chapter_num > 0.0 || !folder_name.is_empty() {
                chapters.push(ChapterMetadata {
                    id: format!("{}-{}", series_id, folder_name),
                    title: format!("Chapter {}", if chapter_num > 0.0 { chapter_num.to_string() } else { folder_name.clone() }),
                    chapter_number: if chapter_num > 0.0 { chapter_num } else { chapters.len() as f32 + 1.0 },
                    file_path: normalize_path(&folder_path),
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
                                let hash: usize = num_str.bytes().fold(0usize, |acc, b| acc.wrapping_mul(31).wrapping_add(b as usize));
                                let page_idx = (hash % page_count) as i32 + si + 1; // +1 for 1-indexed filenames
                                let cover_file = format!("ch{}_p{:03}.jpg", ch_padded, page_idx);
                                let cover_full = root.join(&cover_file);
                                if cover_full.exists() {
                                    Some(normalize_path(&cover_full))
                                } else {
                                    // Fallback to first page
                                    let f = root.join(format!("ch{}_p001.jpg", ch_padded));
                                    if f.exists() { Some(normalize_path(&f)) } else { None }
                                }
                            } else {
                                let f = root.join(format!("ch{}_p001.jpg", ch_padded));
                                if f.exists() { Some(normalize_path(&f)) } else { None }
                            };

                            let pages = if let (Some(si), Some(ei)) = (start_idx, end_idx) {
                                (ei - si + 1).max(0) as i32
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
    chapters.sort_by(|a, b| a.chapter_number.partial_cmp(&b.chapter_number).unwrap_or(std::cmp::Ordering::Equal));
    
    Ok(chapters)
}

#[command]
async fn read_folder(app: AppHandle, path: String) -> Result<Vec<String>, String> {
    let mut files = Vec::new();
    let supported_extensions = ["jpg", "jpeg", "png", "webp", "gif"];
    let archive_extensions = ["zip", "cbz"];

    let input_path = Path::new(&path);
    
    if input_path.is_file() {
        let ext = input_path.extension().and_then(|s| s.to_str()).unwrap_or("").to_lowercase();
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
                    Some(path) => extract_path.join(path.to_owned()),
                    None => continue,
                };

                if (*file.name()).ends_with('/') {
                    fs::create_dir_all(&outpath).ok();
                } else {
                    if let Some(p) = outpath.parent() {
                        if !p.exists() { fs::create_dir_all(&p).ok(); }
                    }
                    let mut outfile = fs::File::create(&outpath).map_err(|e| e.to_string())?;
                    io::copy(&mut file, &mut outfile).map_err(|e| e.to_string())?;
                }
            }

            for entry in WalkDir::new(&extract_path).into_iter().filter_map(|e| e.ok()) {
                if entry.file_type().is_file() {
                    if let Some(e) = entry.path().extension().and_then(|s| s.to_str()) {
                        if supported_extensions.contains(&e.to_lowercase().as_str()) {
                            files.push(normalize_path(entry.path()));
                        }
                    }
                }
            }
        }
    } else {
        for entry in WalkDir::new(&path).max_depth(1).into_iter().filter_map(|e| e.ok()) {
            if entry.file_type().is_file() {
                if let Some(ext) = entry.path().extension().and_then(|s| s.to_str()) {
                    if supported_extensions.contains(&ext.to_lowercase().as_str()) {
                        files.push(normalize_path(entry.path()));
                    }
                }
            }
        }
    }
    
    files.sort();
    Ok(files)
}

use std::collections::HashMap;

#[command]
async fn download_image(url: String, file_path: String, headers: Option<HashMap<String, String>>) -> Result<(), String> {
    let client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        
    let client = client_builder.build().map_err(|e| e.to_string())?;
        
    let mut request = client.get(&url);
    
    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }
        
    let response = request.send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !response.status().is_success() {
        return Err(format!("Failed to download image: status {}", response.status()));
    }
    
    let bytes = response.bytes().await.map_err(|e| e.to_string())?;
    
    // Ensure parent directory exists
    if let Some(parent) = std::path::Path::new(&file_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    
    std::fs::write(&file_path, bytes).map_err(|e| e.to_string())?;
    
    Ok(())
}

#[command]
async fn fetch_html(url: String, headers: Option<HashMap<String, String>>) -> Result<String, String> {
    let client_builder = reqwest::Client::builder()
        .user_agent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
        
    let client = client_builder.build().map_err(|e| e.to_string())?;
        
    let mut request = client.get(&url)
        .header("Accept", "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8");
    
    if let Some(h_map) = headers {
        for (key, value) in h_map {
            request = request.header(key, value);
        }
    }
        
    let response = request.send()
        .await
        .map_err(|e| e.to_string())?;
        
    if !response.status().is_success() {
        return Err(format!("Failed to fetch content: status {}", response.status()));
    }
        
    let text = response.text().await.map_err(|e| e.to_string())?;
    Ok(text)
}

use headless_chrome::{Browser, LaunchOptions};

#[command]
async fn scrape_images_headless(url: String) -> Result<Vec<String>, String> {
    println!("[Rust] Starting enhanced headless scrape for: {}", url);
    
    let images = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;

        // Navigate
        tab.navigate_to(&url).map_err(|e| format!("Failed to navigate: {}", e))?;
        tab.wait_until_navigated().map_err(|e| format!("Nav failed: {}", e))?;

        // DEBUG: Proof of Load
        let title = tab.evaluate("document.title", true)
            .ok().and_then(|o| o.value).and_then(|v| v.as_str().map(|s| s.to_string()))
            .unwrap_or_else(|| "Unknown Title".to_string());
        println!("[Rust Scraper] Debug - Page Title: {}", title);

        // 1. Wait for reader container
        let wait_script = r#"
            document.querySelector('#viewer, .reader, .nc-viewer, [data-role="reader"], .page-list, div[class*="viewer"]') !== null ||
            document.querySelector('.reading-content, #readerarea, .container-chapter-reader') !== null
        "#;
        let mut retries = 0;
        let mut found_container = false;
        while retries < 15 {
            if let Ok(remote_object) = tab.evaluate(wait_script, true) {
                if remote_object.value.and_then(|v| v.as_bool()).unwrap_or(false) {
                    found_container = true;
                    break;
                }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
            retries += 1;
        }
        
        if !found_container {
            println!("[Rust Warning] Main viewer container not found after 15s - proceeding anyway...");
        }

        // 2. Incremental Collection (Crucial for Virtualized Lists)
        let mut collected_images: std::collections::HashSet<String> = std::collections::HashSet::new();
        let mut last_height = 0;
        let mut scroll_retries = 0;
        
        println!("[Rust Scraper] Starting incremental scroll-collection loop...");

        while scroll_retries < 12 {
            // Extract currently visible images + background images
            let extract_current_script = r#"
                (() => {
                    const results = [];
                    // 1. Standard img tags
                    const container = document.querySelector('.reading-content, #readerarea') || document;
                    container.querySelectorAll('img').forEach(img => {
                        let src = img.currentSrc || img.src || img.dataset.src || img.dataset.lazySrc || img.dataset.original || '';
                        if (src.startsWith('//')) src = 'https:' + src;
                        if (src.startsWith('/')) src = window.location.origin + src;
                        if (src && src.length > 20 && !src.includes('avatar') && !src.includes('logo') && !src.includes('banner')) {
                            results.push(src);
                        }
                    });
                    // 2. Background images
                    document.querySelectorAll('[style*="background-image"]').forEach(el => {
                        const style = el.style.backgroundImage;
                        const match = style.match(/url\(["']?(.*?)["']?\)/);
                        if (match && match[1]) {
                            let url = match[1];
                            if (url.startsWith('//')) url = 'https:' + url;
                            if (url.length > 50 && !url.includes('avatar')) results.push(url);
                        }
                    });
                    return results;
                })()
            "#;

            if let Ok(remote_obj) = tab.evaluate(extract_current_script, true) {
                if let Some(val) = remote_obj.value {
                    if let Ok(urls) = serde_json::from_value::<Vec<String>>(val) {
                        let start_count = collected_images.len();
                        for url in urls {
                            collected_images.insert(url);
                        }
                        if collected_images.len() > start_count {
                            println!("[Rust Scraper] Collected {} new images (Total: {})", collected_images.len() - start_count, collected_images.len());
                        }
                    }
                }
            }

            // Scroll check
            let height_obj = tab.evaluate("document.body.scrollHeight", true).map_err(|e| e.to_string())?;
            let current_height = height_obj.value.and_then(|v| v.as_u64()).unwrap_or(0);
            
            tab.evaluate("window.scrollBy(0, window.innerHeight * 1.8)", true).map_err(|e| e.to_string())?;
            std::thread::sleep(std::time::Duration::from_millis(1500));
            
            if current_height == last_height {
                scroll_retries += 1;
            } else {
                scroll_retries = 0;
                last_height = current_height;
            }
        }
        
        let mut final_urls: Vec<String> = collected_images.into_iter()
            .filter(|src| {
                let s = src.to_lowercase();
                s.ends_with(".jpg") || s.ends_with(".jpeg") || s.ends_with(".png") || s.ends_with(".webp")
            })
            .collect();
            
        // Final broad fallback if empty
        if final_urls.is_empty() {
             println!("[Rust Scraper] Incremental loop failed. Trying final broad extraction...");
             let broad_script = r#"
                Array.from(document.querySelectorAll('img')).map(i => i.currentSrc || i.src || '').filter(s => s.length > 50)
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
async fn scrape_series_headless(url: String) -> Result<SeriesScrapeResult, String> {
    println!("[Rust] Starting headless series scrape for: {}", url);
    
    let result = tauri::async_runtime::spawn_blocking(move || {
        let browser = Browser::new(LaunchOptions {
            headless: true,
            args: vec![
                std::ffi::OsStr::new("--no-sandbox"),
                std::ffi::OsStr::new("--disable-setuid-sandbox"),
                std::ffi::OsStr::new("--disable-blink-features=AutomationControlled"),
            ],
            ..Default::default()
        }).map_err(|e| format!("Failed to launch browser: {}", e))?;

        let tab = browser.new_tab().map_err(|e| format!("Failed to create tab: {}", e))?;

        println!("[Rust] Navigating to {}...", url);
        tab.navigate_to(&url).map_err(|e| format!("Nav failed: {}", e))?;
        tab.wait_until_navigated().map_err(|e| format!("Nav wait failed: {}", e))?;
        
        // 2. Wait for Title or Proof of Content
        println!("[Rust] Waiting for content load (60s max)...");
        let wait_content = r#"document.querySelector('h1, .title, .w-title, [class*="title"], [data-testid="title"]') !== null"#;
        let mut retries = 0;
        while retries < 60 { 
            if let Ok(obj) = tab.evaluate(wait_content, true) {
                if obj.value.and_then(|v| v.as_bool()).unwrap_or(false) { break; }
            }
            std::thread::sleep(std::time::Duration::from_millis(1000));
            retries += 1;
        }

        // 3. Extra Delay for Hydration/Lazy Loads (15s)
        println!("[Rust] Waiting 15s for hydration and animations...");
        std::thread::sleep(std::time::Duration::from_millis(15000));

        // 4. Scroll to Bottom (Trigger Lazy Load)
        println!("[Rust] Scrolling to bottom...");
        let _ = tab.evaluate("window.scrollTo(0, document.body.scrollHeight)", true);
        std::thread::sleep(std::time::Duration::from_millis(5000));

        // 5. Extraction Script
        let extract_script = r#"
            (() => {
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

                    // 4. Extract Links (Unified)
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

                    const finalLinks = links.map(href => {
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
        let json_str = remote_obj.value.and_then(|v| v.as_str().map(|s| s.to_string()))
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
                 .map(|png| std::fs::write("headless_extraction_failed.png", png));
             return Err("Found 0 chapters. Page might be blocked (Cloudflare) or layout changed. Check headless_extraction_failed.png".to_string());
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
    let ext = src_path.extension().and_then(|s| s.to_str()).unwrap_or("jpg");
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
async fn generate_chapter_thumbnail(chapter_path: String, series_path: String) -> Result<String, String> {
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
            e.path().is_file() && e.path().extension()
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
    let ch_name = ch_path.file_name().and_then(|s| s.to_str()).unwrap_or("unknown");
    let thumb_filename = format!("thumb_{}.jpg", sanitize_filename(ch_name));
    let dest_path = s_path.join(&thumb_filename);

    // 3. Pick a random-ish image from the middle (25% - 75%)
    let len = images.len();
    let mid_start = len / 4;
    let mid_end = (len * 3) / 4;
    
    // Deterministic selection based on path hash
    let hash: usize = chapter_path.bytes().fold(0usize, |acc, b| acc.wrapping_mul(31).wrapping_add(b as usize));
    let range = if mid_end > mid_start { mid_end - mid_start } else { 1 };
    let idx = mid_start + (hash % range);
    let chosen_idx = idx.min(len - 1);

    let src_path = images[chosen_idx].path();
    
    // 4. Copy to series path
    fs::copy(&src_path, &dest_path).map_err(|e| format!("Failed to copy thumbnail: {}", e))?;

    Ok(normalize_path(&dest_path))
}

#[derive(Serialize)]
pub struct AmbientSound {
    name: String,
    path: String,
}

#[command]
async fn list_ambient_sounds(app: AppHandle) -> Result<Vec<AmbientSound>, String> {
    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let audio_dir = data_dir.join("audio").join("ambient");
    
    if !audio_dir.exists() {
        fs::create_dir_all(&audio_dir).map_err(|e| e.to_string())?;
    }

    let mut sounds = Vec::new();
    let supported = ["mp3", "ogg", "wav", "m4a"];

    for entry in fs::read_dir(audio_dir).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let path = entry.path();
        if path.is_file() {
            if let Some(ext) = path.extension().and_then(|s| s.to_str()) {
                if supported.contains(&ext.to_lowercase().as_str()) {
                    sounds.push(AmbientSound {
                        name: path.file_stem().unwrap_or_default().to_string_lossy().to_string(),
                        path: normalize_path(&path),
                    });
                }
            }
        }
    }

    Ok(sounds)
}

#[command]
async fn import_ambient_sound(app: AppHandle, path: String) -> Result<AmbientSound, String> {
    let src_path = Path::new(&path);
    if !src_path.exists() {
        return Err("Source file does not exist".to_string());
    }

    let data_dir = app.path().app_data_dir().map_err(|e| e.to_string())?;
    let audio_dir = data_dir.join("audio").join("ambient");
    
    if !audio_dir.exists() {
        fs::create_dir_all(&audio_dir).map_err(|e| e.to_string())?;
    }

    let dest_filename = src_path.file_name().ok_or("Invalid filename")?;
    let dest_path = audio_dir.join(dest_filename);

    fs::copy(src_path, &dest_path).map_err(|e| format!("Failed to copy file: {}", e))?;

    Ok(AmbientSound {
        name: dest_path.file_stem().unwrap_or_default().to_string_lossy().to_string(),
        path: normalize_path(&dest_path),
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
        // If chapters dir is missing, everything is effectively "invalid"
        // But we return an empty vec for the frontend to handle as "no chapters found on disk"
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

    // Iterate and remove entries
    for entry in fs::read_dir(p).map_err(|e| e.to_string())? {
        let entry = entry.map_err(|e| e.to_string())?;
        let entry_path = entry.path();
        
        // Preserve cover and metadata
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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_log::Builder::default().build())
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
        scrape_images_headless,
        scrape_series_headless,
        read_file_string,
        set_manga_cover,
        remove_manga_cover,
        generate_chapter_thumbnail,
        list_ambient_sounds,
        import_ambient_sound,
        validate_chapter_contents,
        wipe_manga_contents
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
                // Wait a bit for the frontend to be ready
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
