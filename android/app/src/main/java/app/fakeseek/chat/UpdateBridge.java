package app.fakeseek.chat;

import android.content.Intent;
import android.net.Uri;
import android.webkit.WebView;

import java.io.File;

/**
 * 应用内更新桥：fetchVersionJson 原生 GET version.json（绕开 WebView CORS）；
 * startDownload 应用内 HttpURLConnection 直下 APK（进度实时回调，断线重试 3 次），
 * 完成后 FileProvider 拉起系统安装器。全程不跳系统下载器。
 */
public class UpdateBridge {

    private final MainActivity activity;
    private final WebView webView;
    /** 应用内下载进行中标志 */
    private volatile boolean downloading = false;

    UpdateBridge(MainActivity activity, WebView webView) {
        this.activity = activity;
        this.webView = webView;
    }

    /** 网页注入回调：window.__fakeseekUpdater({event:...,...}) */
    private void notify(String event, String detail) {
        String safe = detail == null ? "" : detail
                .replace("\\", "\\\\")
                .replace("'", "\\'")
                .replace("\n", "\\n")
                .replace("\r", "");
        final String js = "window.__fakeseekUpdater && window.__fakeseekUpdater({ event: '" + event
                + "', detail: '" + safe + "' })";
        webView.post(() -> webView.evaluateJavascript(js, null));
    }

    /** 原生 GET version.json：WebView 直接 fetch gitee 会有 CORS 限制，由原生代发 */
    void fetchVersionJson(final String url) {
        new Thread(() -> {
            String body = "";
            int code = 0;
            try {
                javax.net.ssl.HttpsURLConnection conn =
                        (javax.net.ssl.HttpsURLConnection) new java.net.URL(url).openConnection();
                conn.setConnectTimeout(15000);
                conn.setReadTimeout(15000);
                conn.setRequestProperty("User-Agent", "fakeseek-updater");
                code = conn.getResponseCode();
                if (code == 200) {
                    java.io.BufferedReader reader = new java.io.BufferedReader(
                            new java.io.InputStreamReader(conn.getInputStream(), "UTF-8"));
                    StringBuilder sb = new StringBuilder();
                    String line;
                    while ((line = reader.readLine()) != null) {
                        sb.append(line);
                    }
                    reader.close();
                    body = sb.toString();
                }
                conn.disconnect();
            } catch (Exception e) {
                body = "";
                code = 0;
            }
            final String payload = body;
            final int status = code;
            webView.post(() -> {
                String escaped = payload.replace("\\", "\\\\")
                        .replace("'", "\\'")
                        .replace("\n", "\\n")
                        .replace("\r", "");
                final String js = "window.__fakeseekUpdater && window.__fakeseekUpdater({ event: 'version', status: "
                        + status + ", body: '" + escaped + "' })";
                webView.evaluateJavascript(js, null);
            });
        }).start();
    }

    /** 应用内下载 APK（不跳系统下载器）：HttpURLConnection 直下到 App 私有目录，
     *  实时回调 downloading/{percent}，失败自动重试 3 次，完成后拉起安装器 */
    void startDownload(final String url, final String title) {
        if (downloading) {
            notify("downloading", "busy");
            return;
        }
        new Thread(() -> {
            downloading = true;
            File outFile = new File(activity.getExternalFilesDir(null), "Download/update/fakeseek-update.apk");
            outFile.getParentFile().mkdirs();
            boolean ok = false;
            String err = "";
            for (int attempt = 1; attempt <= 3 && !ok; attempt++) {
                try {
                    javax.net.ssl.HttpsURLConnection conn =
                            (javax.net.ssl.HttpsURLConnection) new java.net.URL(url).openConnection();
                    conn.setConnectTimeout(10000);
                    conn.setReadTimeout(30000);
                    conn.setRequestProperty("User-Agent", "fakeseek-updater");
                    int code = conn.getResponseCode();
                    if (code != 200) {
                        conn.disconnect();
                        err = "http-" + code;
                        continue;
                    }
                    long total = conn.getContentLength();
                    java.io.InputStream in = conn.getInputStream();
                    java.io.FileOutputStream out = new java.io.FileOutputStream(outFile, false);
                    byte[] buf = new byte[64 * 1024];
                    long got = 0;
                    int lastPct = -1;
                    int n;
                    while ((n = in.read(buf)) != -1) {
                        out.write(buf, 0, n);
                        got += n;
                        if (total > 0) {
                            int pct = (int) (got * 100 / total);
                            if (pct != lastPct) {
                                lastPct = pct;
                                notify("downloading", String.valueOf(pct));
                            }
                        }
                    }
                    out.close();
                    in.close();
                    conn.disconnect();
                    if (total > 0 && got != total) {
                        err = "truncated-" + got + "/" + total;
                        continue;
                    }
                    ok = true;
                } catch (Exception e) {
                    err = e.getClass().getSimpleName() + ":" + e.getMessage();
                }
            }
            downloading = false;
            final boolean done = ok;
            final String detail = done ? outFile.getAbsolutePath() : err;
            webView.post(() -> {
                if (done) {
                    installApk(outFile);
                } else {
                    notify("failed", detail);
                }
            });
        }).start();
    }

    /** 应用内下载完成后：FileProvider 授权拉起系统安装器 */
    private void installApk(File apk) {
        try {
            Uri uri = androidx.core.content.FileProvider.getUriForFile(
                    activity, activity.getPackageName() + ".fileprovider", apk);
            Intent install = new Intent(Intent.ACTION_INSTALL_PACKAGE);
            install.setData(uri);
            install.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            install.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            activity.startActivity(install);
            notify("done", "install-started");
        } catch (Exception e) {
            notify("failed", String.valueOf(e.getMessage()));
        }
    }
}
