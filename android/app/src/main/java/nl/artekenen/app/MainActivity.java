package nl.artekenen.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import androidx.core.content.FileProvider;
import androidx.webkit.WebViewAssetLoader;

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.io.FileOutputStream;
import java.io.OutputStream;

/** Shows the AR Tekenen web app (bundled in assets/www) full screen in a WebView. */
public class MainActivity extends Activity {

    private static final String START_URL = "https://appassets.androidplatform.net/assets/www/index.html";
    private static final int REQ_CAMERA_PERMISSION = 1;
    private static final int REQ_FILE = 2;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private PermissionRequest pendingPermission;
    private ValueCallback<Uri[]> fileCallback;
    private Uri cameraPhotoUri;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/assets/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = new WebView(this);
        webView.setBackgroundColor(Color.WHITE);
        setContentView(webView);

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);

        webView.addJavascriptInterface(new Bridge(), "AndroidApp");
        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }
        });
        webView.setWebChromeClient(new ChromeClient());

        if (savedInstanceState != null) {
            webView.restoreState(savedInstanceState);
        } else {
            webView.loadUrl(START_URL);
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        webView.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            super.onBackPressed();
        }
    }

    // ---------- Camera permission for getUserMedia ----------

    private class ChromeClient extends WebChromeClient {
        @Override
        public void onPermissionRequest(final PermissionRequest request) {
            runOnUiThread(() -> {
                boolean wantsCamera = false;
                for (String r : request.getResources()) {
                    if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r)) wantsCamera = true;
                }
                if (!wantsCamera) {
                    request.deny();
                    return;
                }
                if (checkSelfPermission(Manifest.permission.CAMERA) == PackageManager.PERMISSION_GRANTED) {
                    request.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
                } else {
                    pendingPermission = request;
                    requestPermissions(new String[] {Manifest.permission.CAMERA}, REQ_CAMERA_PERMISSION);
                }
            });
        }

        @Override
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
            if (fileCallback != null) fileCallback.onReceiveValue(null);
            fileCallback = callback;
            Intent intent;
            if (params.isCaptureEnabled()) {
                try {
                    File dir = new File(getCacheDir(), "photos");
                    dir.mkdirs();
                    File photo = new File(dir, "foto-" + System.currentTimeMillis() + ".jpg");
                    cameraPhotoUri = FileProvider.getUriForFile(MainActivity.this, getPackageName() + ".files", photo);
                    intent = new Intent(MediaStore.ACTION_IMAGE_CAPTURE);
                    intent.putExtra(MediaStore.EXTRA_OUTPUT, cameraPhotoUri);
                    intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION);
                } catch (Exception e) {
                    cameraPhotoUri = null;
                    intent = galleryIntent();
                }
            } else {
                cameraPhotoUri = null;
                intent = galleryIntent();
            }
            try {
                startActivityForResult(intent, REQ_FILE);
            } catch (Exception e) {
                fileCallback.onReceiveValue(null);
                fileCallback = null;
                return false;
            }
            return true;
        }
    }

    private Intent galleryIntent() {
        Intent i = new Intent(Intent.ACTION_GET_CONTENT);
        i.addCategory(Intent.CATEGORY_OPENABLE);
        i.setType("image/*");
        return i;
    }

    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode != REQ_FILE || fileCallback == null) return;
        Uri[] result = null;
        if (resultCode == RESULT_OK) {
            if (cameraPhotoUri != null) {
                result = new Uri[] {cameraPhotoUri};
            } else if (data != null && data.getData() != null) {
                result = new Uri[] {data.getData()};
            }
        }
        fileCallback.onReceiveValue(result);
        fileCallback = null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode != REQ_CAMERA_PERMISSION || pendingPermission == null) return;
        if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
            pendingPermission.grant(new String[] {PermissionRequest.RESOURCE_VIDEO_CAPTURE});
        } else {
            pendingPermission.deny();
        }
        pendingPermission = null;
    }

    private static String quote(String s) {
        return "'" + s.replace("\\", "\\\\").replace("'", "\\'") + "'";
    }

    // ---------- JavaScript bridge ----------

    private class Bridge {
        /** Saves a JPEG (base64) to the phone's Pictures/AR Tekenen folder. */
        @JavascriptInterface
        public boolean saveImage(String base64) {
            try {
                byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
                String name = "schets-" + System.currentTimeMillis() + ".jpg";
                if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                    ContentValues v = new ContentValues();
                    v.put(MediaStore.Images.Media.DISPLAY_NAME, name);
                    v.put(MediaStore.Images.Media.MIME_TYPE, "image/jpeg");
                    v.put(MediaStore.Images.Media.RELATIVE_PATH, Environment.DIRECTORY_PICTURES + "/AR Tekenen");
                    Uri uri = getContentResolver().insert(MediaStore.Images.Media.EXTERNAL_CONTENT_URI, v);
                    if (uri == null) return false;
                    try (OutputStream os = getContentResolver().openOutputStream(uri)) {
                        if (os == null) return false;
                        os.write(bytes);
                    }
                } else {
                    File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_PICTURES), "AR Tekenen");
                    dir.mkdirs();
                    try (FileOutputStream os = new FileOutputStream(new File(dir, name))) {
                        os.write(bytes);
                    }
                }
                return true;
            } catch (Exception e) {
                return false;
            }
        }

        /**
         * Downloads an image outside the WebView (so no CORS rules apply) and hands
         * it back as a data URL through window.__androidImage(id, dataUrl or null).
         */
        @JavascriptInterface
        public void fetchImage(final String id, final String url) {
            new Thread(() -> {
                String result = null;
                HttpURLConnection con = null;
                try {
                    con = (HttpURLConnection) new URL(url).openConnection();
                    con.setConnectTimeout(30000);
                    con.setReadTimeout(180000);
                    con.setInstanceFollowRedirects(true);
                    if (con.getResponseCode() == 200) {
                        String type = con.getContentType();
                        try (InputStream in = con.getInputStream()) {
                            ByteArrayOutputStream buf = new ByteArrayOutputStream();
                            byte[] chunk = new byte[16384];
                            int n;
                            while ((n = in.read(chunk)) > 0) buf.write(chunk, 0, n);
                            result = "data:" + (type != null && type.startsWith("image/") ? type : "image/jpeg")
                                    + ";base64," + Base64.encodeToString(buf.toByteArray(), Base64.NO_WRAP);
                        }
                    }
                } catch (Exception e) {
                    result = null;
                } finally {
                    if (con != null) con.disconnect();
                }
                final String js = "window.__androidImage && window.__androidImage(" + quote(id) + ","
                        + (result == null ? "null" : quote(result)) + ")";
                runOnUiThread(() -> webView.evaluateJavascript(js, null));
            }).start();
        }

        @JavascriptInterface
        public boolean isApp() {
            return true;
        }
    }
}
