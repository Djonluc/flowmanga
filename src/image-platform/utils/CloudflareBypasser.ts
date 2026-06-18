import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

export class CloudflareBypasser {
  static bypassWindowCount = 0;

  static async bypassAndFetch<T>(url: string, timeoutMs: number = 30000): Promise<T> {
    return new Promise(async (resolve, reject) => {
      this.bypassWindowCount++;
      const windowLabel = `cf-bypass-${this.bypassWindowCount}-${Date.now()}`;

      // We inject a script that sets document.title = "CF_SUCCESS:" + JSON
      // This completely avoids Tauri IPC and works flawlessly even on remote Cloudflare domains.
      const injectionScript = `
        setInterval(async () => {
          if (!document.getElementById('cf-wrapper') && !document.getElementById('challenge-running')) {
            try {
              const res = await fetch(window.location.href);
              const text = await res.text();
              if (text.startsWith('{') || text.startsWith('[')) {
                document.title = 'CF_SUCCESS:' + encodeURIComponent(text);
              }
            } catch (e) {}
          }
        }, 1000);
      `;

      let webview: WebviewWindow | null = null;
      let checkInterval: number;

      let cleanup = async () => {
        clearInterval(checkInterval);
        if (webview) {
          try {
            await webview.close();
          } catch (e) {
            console.error("Failed to close bypass window", e);
          }
        }
      };

      webview = new WebviewWindow(windowLabel, {
        url,
        hidden: true,
        width: 800,
        height: 600,
        title: "Verifying Connection...",
        initializationScript: injectionScript
      });

      // Poll the window title to see if our injection script updated it
      checkInterval = window.setInterval(async () => {
        if (!webview) return;
        try {
          const title = await webview.title();
          if (title && title.startsWith('CF_SUCCESS:')) {
            console.log("[CloudflareBypasser] Bypass successful! JSON received.");
            const rawJson = decodeURIComponent(title.substring('CF_SUCCESS:'.length));
            const data = JSON.parse(rawJson);
            cleanup();
            resolve(data as T);
          }
        } catch (e) {
          // Ignored during polling
        }
      }, 500);

      const showTimeout = setTimeout(async () => {
        if (webview) {
          try {
            console.log("[CloudflareBypasser] 5 seconds passed, showing window for physical CAPTCHA if needed.");
            await webview.show();
            await webview.setFocus();
          } catch (e) {}
        }
      }, 5000);

      const failTimeout = setTimeout(() => {
        cleanup();
        reject(new Error("Cloudflare bypass timed out."));
      }, timeoutMs);

      const originalCleanup = cleanup;
      cleanup = async () => {
        clearTimeout(showTimeout);
        clearTimeout(failTimeout);
        await originalCleanup();
      };
    });
  }
}
