package bible.selah

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

class MainActivity : TauriActivity() {
    private lateinit var insetsController: WindowInsetsControllerCompat
    private var pendingFileContent: String? = null
    private var webViewRef: WebView? = null

    companion object {
        private const val REQUEST_CREATE_FILE = 1001
        private const val REQUEST_OPEN_FILE = 1002
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        insetsController = WindowCompat.getInsetsController(window, window.decorView)
        insetsController.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE

        // Inject JS interface after WebView is ready (retry until found)
        val immersiveInterface = ImmersiveInterface()
        val fileInterface = FileInterface()
        fun tryInjectInterfaces() {
            findWebView(window.decorView)?.let { webView ->
                webViewRef = webView
                webView.addJavascriptInterface(immersiveInterface, "AndroidImmersive")
                webView.addJavascriptInterface(fileInterface, "AndroidFile")
            } ?: window.decorView.postDelayed({ tryInjectInterfaces() }, 200)
        }
        window.decorView.post { tryInjectInterfaces() }
    }

    private fun findWebView(view: android.view.View): WebView? {
        if (view is WebView) return view
        if (view is android.view.ViewGroup) {
            for (i in 0 until view.childCount) {
                findWebView(view.getChildAt(i))?.let { return it }
            }
        }
        return null
    }

    @Suppress("DEPRECATION")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        when (requestCode) {
            REQUEST_CREATE_FILE -> {
                if (resultCode == Activity.RESULT_OK && data?.data != null) {
                    val ok = writeContentToUri(data.data!!)
                    evalJs(if (ok) "window.__fileSaveCallback?.('ok')" else "window.__fileSaveCallback?.('error')")
                } else {
                    evalJs("window.__fileSaveCallback?.('cancelled')")
                }
                pendingFileContent = null
            }
            REQUEST_OPEN_FILE -> {
                if (resultCode == Activity.RESULT_OK && data?.data != null) {
                    val content = readContentFromUri(data.data!!)
                    if (content != null) {
                        val jsonEncoded = org.json.JSONObject.quote(content)
                        evalJs("window.__fileOpenCallback?.($jsonEncoded)")
                    } else {
                        evalJs("window.__fileOpenCallback?.(null)")
                    }
                } else {
                    evalJs("window.__fileOpenCallback?.(null)")
                }
            }
        }
    }

    private fun evalJs(script: String) {
        runOnUiThread {
            webViewRef?.evaluateJavascript(script, null)
        }
    }

    private fun writeContentToUri(uri: Uri): Boolean {
        return try {
            contentResolver.openOutputStream(uri)?.use { stream ->
                stream.write(pendingFileContent?.toByteArray(Charsets.UTF_8))
            }
            true
        } catch (e: Exception) {
            e.printStackTrace()
            false
        }
    }

    private fun readContentFromUri(uri: Uri): String? {
        return try {
            contentResolver.openInputStream(uri)?.use { stream ->
                stream.bufferedReader().readText()
            }
        } catch (e: Exception) {
            e.printStackTrace()
            null
        }
    }

    inner class ImmersiveInterface {
        @JavascriptInterface
        fun setImmersive(enabled: Boolean) {
            runOnUiThread {
                if (enabled) {
                    insetsController.hide(WindowInsetsCompat.Type.systemBars())
                } else {
                    insetsController.show(WindowInsetsCompat.Type.systemBars())
                }
            }
        }
    }

    inner class FileInterface {
        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun saveFile(content: String, filename: String, mimeType: String) {
            runOnUiThread {
                pendingFileContent = content
                val intent = Intent(Intent.ACTION_CREATE_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                    putExtra(Intent.EXTRA_TITLE, filename)
                }
                startActivityForResult(intent, REQUEST_CREATE_FILE)
            }
        }

        @Suppress("DEPRECATION")
        @JavascriptInterface
        fun openFile(mimeType: String) {
            runOnUiThread {
                val intent = Intent(Intent.ACTION_OPEN_DOCUMENT).apply {
                    addCategory(Intent.CATEGORY_OPENABLE)
                    type = mimeType
                }
                startActivityForResult(intent, REQUEST_OPEN_FILE)
            }
        }
    }
}
