package com.allarmeapp

import android.app.NotificationManager
import android.content.Context
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class AlarmSoundModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "AlarmSoundModule"

  /** Rimuove tutte le notifiche dell’app (tray): utile per eliminare un push “fantasma” prima di Notifee. */
  @ReactMethod
  fun cancelAllTrayNotifications(promise: Promise) {
    try {
      val nm =
        reactApplicationContext.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      nm.cancelAll()
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_CANCEL_TRAY", e.message, e)
    }
  }

  @ReactMethod
  fun startSiren(title: String?, body: String?, promise: Promise) {
    try {
      val safeTitle = (title ?: "").trim().ifBlank { "Allarme" }
      val safeBody = (body ?: "").trim()
      AlarmSirenForegroundService.start(
        reactApplicationContext.applicationContext,
        safeTitle,
        safeBody,
      )
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SIREN_START", e.message, e)
    }
  }

  @ReactMethod
  fun stopSiren(promise: Promise) {
    try {
      AlarmSirenForegroundService.stop(reactApplicationContext.applicationContext)
      promise.resolve(null)
    } catch (e: Exception) {
      promise.reject("E_SIREN_STOP", e.message, e)
    }
  }
}
