package com.pinbead.helper;

import android.app.Activity;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Base64;
import android.util.Log;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

public class MainActivity extends Activity {
    private static final String TAG = "PinBeadHelper";
    private static final int FILE_CHOOSER_REQUEST = 1001;
    private static final int SAVE_FILE_REQUEST = 1002;

    private WebView webView;
    private ValueCallback<Uri[]> filePathCallback;
    private byte[] pendingSaveBytes;
    private String pendingSaveName;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        webView = new WebView(this);
        setContentView(webView);

        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setAllowFileAccess(true);
        settings.setAllowContentAccess(true);
        settings.setMediaPlaybackRequiresUserGesture(false);

        webView.setWebViewClient(new WebViewClient());
        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public boolean onShowFileChooser(
                    WebView view,
                    ValueCallback<Uri[]> callback,
                    FileChooserParams params
            ) {
                if (filePathCallback != null) {
                    filePathCallback.onReceiveValue(null);
                }
                filePathCallback = callback;

                Intent intent = params.createIntent();
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                try {
                    startActivityForResult(intent, FILE_CHOOSER_REQUEST);
                } catch (Exception error) {
                    filePathCallback = null;
                    return false;
                }
                return true;
            }
        });

        webView.addJavascriptInterface(new Bridge(), "PinBead");

        webView.loadUrl("file:///android_asset/www/index.html");
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);

        if (requestCode == FILE_CHOOSER_REQUEST) {
            if (filePathCallback != null) {
                filePathCallback.onReceiveValue(parseFileResults(resultCode, data));
                filePathCallback = null;
            }
            return;
        }

        if (requestCode == SAVE_FILE_REQUEST) {
            if (resultCode == RESULT_OK && data != null && data.getData() != null) {
                writeToUri(data.getData(), pendingSaveBytes);
            } else {
                toast("已取消保存");
            }
            pendingSaveBytes = null;
            pendingSaveName = null;
        }
    }

    private Uri[] parseFileResults(int resultCode, Intent data) {
        if (resultCode != RESULT_OK || data == null) {
            return null;
        }

        if (data.getClipData() != null) {
            int count = data.getClipData().getItemCount();
            Uri[] results = new Uri[count];
            for (int i = 0; i < count; i += 1) {
                results[i] = data.getClipData().getItemAt(i).getUri();
            }
            return results;
        }

        if (data.getData() != null) {
            return new Uri[]{data.getData()};
        }

        return null;
    }

    private void writeToUri(Uri uri, byte[] bytes) {
        if (bytes == null || uri == null) {
            return;
        }
        try {
            try (java.io.OutputStream out = getContentResolver().openOutputStream(uri)) {
                if (out == null) {
                    throw new java.io.IOException("无法写入目标");
                }
                out.write(bytes);
                toast("已保存：" + pendingSaveName);
            } catch (Exception error) {
                Log.w(TAG, "write to uri failed", error);
                toast("保存失败：" + error.getMessage());
            }
        } catch (Exception error) {
            Log.w(TAG, "open output stream failed", error);
            toast("保存失败：" + error.getMessage());
        }
    }

    private void toast(final String message) {
        new Handler(Looper.getMainLooper()).post(() ->
                Toast.makeText(this, message, Toast.LENGTH_SHORT).show());
    }

    private String sanitizeFileName(String fileName) {
        String name = fileName == null ? "" : fileName.replaceAll("[\\\\/:*?\"<>|]", "_");
        if (name.isEmpty()) {
            name = "拼豆图纸";
        }
        if (!name.toLowerCase().endsWith(".png")) {
            name = name + ".png";
        }
        return name;
    }

    public class Bridge {
        @JavascriptInterface
        public boolean saveFile(String dataUrl, String fileName) {
            if (dataUrl == null) {
                return false;
            }

            String pureBase64 = dataUrl;
            int comma = dataUrl.indexOf(",");
            if (dataUrl.startsWith("data:") && comma > 0) {
                pureBase64 = dataUrl.substring(comma + 1);
            }

            byte[] bytes;
            try {
                bytes = Base64.decode(pureBase64, Base64.DEFAULT);
            } catch (Exception error) {
                Log.w(TAG, "base64 decode failed", error);
                toast("保存图片失败：数据损坏");
                return false;
            }

            pendingSaveBytes = bytes;
            pendingSaveName = sanitizeFileName(fileName);

            // JavascriptInterface 运行在后台线程，SAF 对话框必须在 UI 线程启动
            runOnUiThread(() -> {
                Intent intent = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                intent.addCategory(Intent.CATEGORY_OPENABLE);
                intent.setType("image/png");
                intent.putExtra(Intent.EXTRA_TITLE, pendingSaveName);

                try {
                    startActivityForResult(intent, SAVE_FILE_REQUEST);
                } catch (Exception error) {
                    Log.w(TAG, "SAF intent failed", error);
                    toast("无法打开保存对话框");
                }
            });
            return true;
        }

        @JavascriptInterface
        public boolean share(String title, String text) {
            try {
                Intent intent = new Intent(Intent.ACTION_SEND);
                intent.setType("text/plain");
                intent.putExtra(Intent.EXTRA_SUBJECT, title);
                intent.putExtra(Intent.EXTRA_TEXT, text);
                startActivity(Intent.createChooser(intent, "分享拼豆小助手"));
                return true;
            } catch (Exception error) {
                Log.w(TAG, "share failed", error);
                toast("分享失败");
                return false;
            }
        }

        @JavascriptInterface
        public String version() {
            return "1.0.0";
        }
    }

    @Override
    public void onBackPressed() {
        if (webView != null && webView.canGoBack()) {
            webView.goBack();
            return;
        }
        super.onBackPressed();
    }
}
