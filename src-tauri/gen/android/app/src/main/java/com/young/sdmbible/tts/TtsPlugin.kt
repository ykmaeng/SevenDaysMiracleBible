package com.young.sdmbible.tts

import android.app.Activity
import android.os.Bundle
import android.speech.tts.TextToSpeech
import android.speech.tts.UtteranceProgressListener
import android.util.Log
import app.tauri.annotation.Command
import app.tauri.annotation.InvokeArg
import app.tauri.annotation.TauriPlugin
import app.tauri.plugin.JSObject
import app.tauri.plugin.Plugin
import app.tauri.plugin.Invoke
import java.util.Locale
import java.util.concurrent.ConcurrentHashMap
import java.util.concurrent.ConcurrentLinkedQueue

@InvokeArg
class SpeakArgs {
    var text: String = ""
    var language: String? = null
    var rate: Float = 1.0f
    var pitch: Float = 1.0f
}

data class PendingSpeak(val invoke: Invoke, val args: SpeakArgs)

@TauriPlugin
class TtsPlugin(private val activity: Activity) : Plugin(activity), TextToSpeech.OnInitListener {
    private var tts: TextToSpeech? = null
    private var isReady = false
    private val pendingQueue = ConcurrentLinkedQueue<PendingSpeak>()
    // Map utteranceId -> Invoke, so we resolve when speech finishes
    private val activeUtterances = ConcurrentHashMap<String, Invoke>()

    companion object {
        private const val TAG = "TtsPlugin"
    }

    override fun load(webView: android.webkit.WebView) {
        super.load(webView)
        tts = TextToSpeech(activity, this)
    }

    override fun onInit(status: Int) {
        if (status == TextToSpeech.SUCCESS) {
            isReady = true
            Log.i(TAG, "TTS initialized, voices: ${tts?.voices?.size ?: 0}")

            tts?.setOnUtteranceProgressListener(object : UtteranceProgressListener() {
                override fun onStart(utteranceId: String?) {}

                override fun onDone(utteranceId: String?) {
                    utteranceId?.let { id ->
                        activeUtterances.remove(id)?.resolve(
                            JSObject().apply {
                                put("success", true)
                                put("utterance_id", id)
                            }
                        )
                    }
                }

                @Deprecated("Deprecated in API 21")
                override fun onError(utteranceId: String?) {
                    utteranceId?.let { id ->
                        activeUtterances.remove(id)?.reject("Speech error for $id")
                    }
                }
            })

            while (pendingQueue.isNotEmpty()) {
                val pending = pendingQueue.poll() ?: break
                doSpeak(pending.invoke, pending.args)
            }
        } else {
            Log.e(TAG, "TTS init failed: $status")
            while (pendingQueue.isNotEmpty()) {
                pendingQueue.poll()?.invoke?.reject("TTS init failed")
            }
        }
    }

    @Command
    fun speak(invoke: Invoke) {
        val args = invoke.parseArgs(SpeakArgs::class.java)
        if (!isReady) {
            pendingQueue.add(PendingSpeak(invoke, args))
            return
        }
        doSpeak(invoke, args)
    }

    private fun doSpeak(invoke: Invoke, args: SpeakArgs) {
        val engine = tts
        if (engine == null) {
            invoke.reject("TTS engine null")
            return
        }

        try {
            args.language?.let { lang ->
                val locale = Locale.forLanguageTag(lang)
                engine.setLanguage(locale)
            }

            if (args.rate != 1.0f) engine.setSpeechRate(args.rate.coerceIn(0.1f, 4.0f))
            if (args.pitch != 1.0f) engine.setPitch(args.pitch.coerceIn(0.5f, 2.0f))

            val utteranceId = "tts_${System.currentTimeMillis()}"
            val params = Bundle().apply {
                putString(TextToSpeech.Engine.KEY_PARAM_UTTERANCE_ID, utteranceId)
            }

            // Store invoke to resolve later when speech finishes
            activeUtterances[utteranceId] = invoke

            val result = engine.speak(args.text, TextToSpeech.QUEUE_FLUSH, params, utteranceId)

            if (result != TextToSpeech.SUCCESS) {
                activeUtterances.remove(utteranceId)
                invoke.reject("speak() error: $result")
            }
            // Don't resolve here — onDone callback will resolve
        } catch (e: Exception) {
            invoke.reject("speak failed: ${e.message}")
        }
    }

    @Command
    fun stop(invoke: Invoke) {
        tts?.stop()
        // Resolve any pending utterances
        for ((id, pendingInvoke) in activeUtterances) {
            pendingInvoke.resolve(JSObject().apply {
                put("success", false)
                put("utterance_id", id)
                put("stopped", true)
            })
        }
        activeUtterances.clear()
        invoke.resolve(JSObject().put("success", true))
    }

    @Command
    fun isSpeaking(invoke: Invoke) {
        invoke.resolve(JSObject().put("speaking", tts?.isSpeaking ?: false))
    }

    @Command
    fun isInitialized(invoke: Invoke) {
        invoke.resolve(JSObject().apply {
            put("initialized", isReady)
            put("voiceCount", tts?.voices?.size ?: 0)
        })
    }

    override fun onDestroy() {
        super.onDestroy()
        tts?.stop()
        tts?.shutdown()
        tts = null
    }
}
