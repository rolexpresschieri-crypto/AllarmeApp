package com.allarmeapp

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          add(AlarmSoundPackage())
        },
    )
  }

  override fun onCreate() {
    super.onCreate()
    createAlarmNotificationChannel()
    loadReactNative(this)
  }

  private fun createAlarmNotificationChannel() {
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      val channelId = "alarm_alert_v3"
      val channelName = "Allarmi emergenza"
      val descriptionText =
        "Avvisi ad alta priorità (la sirena è gestita dall’app, non dal canale)"
      val importance = NotificationManager.IMPORTANCE_HIGH

      val channel = NotificationChannel(channelId, channelName, importance).apply {
        description = descriptionText
        /** Nessun suono sul canale: la sirena è nel servizio foreground (schermo spento). */
        setSound(null, null)
        enableVibration(true)
        enableLights(true)
        lockscreenVisibility = android.app.Notification.VISIBILITY_PUBLIC
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
          setBypassDnd(true)
        }
      }
      val notificationManager =
        getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      notificationManager.createNotificationChannel(channel)
    }
  }
}
