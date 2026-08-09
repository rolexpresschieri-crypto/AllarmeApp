package com.allarmeapp

import android.app.Notification
import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.PendingIntent
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.AudioAttributes
import android.media.MediaPlayer
import android.os.Build
import android.os.Handler
import android.os.IBinder
import android.os.Looper
import android.os.PowerManager
import androidx.core.app.NotificationCompat

/**
 * Sirena in foreground service: resta attiva con schermo spento / bloccato.
 * Mostra direttamente la notifica allarme (titolo + corpo + Interrompi sirena),
 * così non c'è più una seconda notifica Notifee separata.
 * Durata massima [MAX_DURATION_MS]; si ferma anche con Interrompi sirena.
 */
class AlarmSirenForegroundService : Service() {

  override fun onBind(intent: Intent?): IBinder? = null

  private var mediaPlayer: MediaPlayer? = null
  private val handler = Handler(Looper.getMainLooper())
  private val stopAfterTimeout = Runnable { stopWithSummary() }

  private var lastTitle: String? = null
  private var lastBody: String? = null

  override fun onCreate() {
    super.onCreate()
    ensureChannels()
  }

  override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
    if (intent?.action == ACTION_STOP) {
      stopWithSummary()
      return START_NOT_STICKY
    }

    val title = intent?.getStringExtra(EXTRA_TITLE)?.takeIf { it.isNotBlank() }
      ?: lastTitle
      ?: getString(R.string.alarm_fgs_default_title)
    val body = intent?.getStringExtra(EXTRA_BODY)?.takeIf { it.isNotBlank() }
      ?: lastBody
      ?: getString(R.string.alarm_fgs_default_body)
    lastTitle = title
    lastBody = body

    handler.removeCallbacks(stopAfterTimeout)

    val notification = buildForegroundNotification(title, body)
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      startForeground(
        NOTIFICATION_ID,
        notification,
        android.content.pm.ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PLAYBACK,
      )
    } else {
      startForeground(NOTIFICATION_ID, notification)
    }

    startOrRestartPlayer()
    handler.postDelayed(stopAfterTimeout, MAX_DURATION_MS)

    return START_STICKY
  }

  override fun onDestroy() {
    handler.removeCallbacks(stopAfterTimeout)
    releasePlayer()
    super.onDestroy()
  }

  @Suppress("DEPRECATION")
  private fun stopWithSummary() {
    handler.removeCallbacks(stopAfterTimeout)
    releasePlayer()
    val title = lastTitle ?: getString(R.string.alarm_fgs_default_title)
    val body = lastBody ?: ""
    postSummaryNotification(title, body)
    stopForeground(true)
    stopSelf()
  }

  private fun releasePlayer() {
    try {
      mediaPlayer?.stop()
    } catch (_: Exception) {
    }
    try {
      mediaPlayer?.release()
    } catch (_: Exception) {
    }
    mediaPlayer = null
  }

  private fun startOrRestartPlayer() {
    releasePlayer()
    val mp =
      MediaPlayer.create(this, R.raw.siren)?.apply {
        setAudioAttributes(
          AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build(),
        )
        isLooping = true
        setWakeMode(this@AlarmSirenForegroundService, PowerManager.PARTIAL_WAKE_LOCK)
        start()
      }
    mediaPlayer = mp
  }

  private fun ensureChannels() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager

    if (nm.getNotificationChannel(CHANNEL_ID) == null) {
      val ch =
        NotificationChannel(
          CHANNEL_ID,
          getString(R.string.alarm_fgs_channel_name),
          NotificationManager.IMPORTANCE_HIGH,
        ).apply {
          description = getString(R.string.alarm_fgs_channel_desc)
          setSound(null, null)
          enableVibration(true)
          vibrationPattern = longArrayOf(0L, 600L, 600L, 600L)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
      nm.createNotificationChannel(ch)
    }

    if (nm.getNotificationChannel(SUMMARY_CHANNEL_ID) == null) {
      val sc =
        NotificationChannel(
          SUMMARY_CHANNEL_ID,
          getString(R.string.alarm_fgs_summary_channel_name),
          NotificationManager.IMPORTANCE_DEFAULT,
        ).apply {
          description = getString(R.string.alarm_fgs_summary_channel_desc)
          setSound(null, null)
          enableVibration(false)
          lockscreenVisibility = Notification.VISIBILITY_PUBLIC
        }
      nm.createNotificationChannel(sc)
    }
  }

  private fun buildForegroundNotification(title: String, body: String): Notification {
    val stopIntent =
      Intent(this, AlarmSirenForegroundService::class.java).apply {
        action = ACTION_STOP
      }
    val stopPending =
      PendingIntent.getService(
        this,
        0,
        stopIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val openIntent =
      Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
    val openPending =
      PendingIntent.getActivity(
        this,
        0,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    return NotificationCompat.Builder(this, CHANNEL_ID)
      .setContentTitle(title)
      .setContentText(body)
      .setStyle(NotificationCompat.BigTextStyle().bigText(body))
      .setSmallIcon(R.mipmap.ic_launcher)
      .setOngoing(true)
      .setAutoCancel(false)
      .setOnlyAlertOnce(false)
      .setPriority(NotificationCompat.PRIORITY_HIGH)
      .setCategory(NotificationCompat.CATEGORY_ALARM)
      .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
      .setContentIntent(openPending)
      .addAction(
        0,
        getString(R.string.alarm_fgs_stop_action),
        stopPending,
      )
      .build()
  }

  private fun postSummaryNotification(title: String, body: String) {
    val nm = getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
    val summaryText =
      if (body.isBlank()) getString(R.string.alarm_fgs_summary_fallback)
      else getString(R.string.alarm_fgs_summary_prefix) + " " + body

    val openIntent =
      Intent(this, MainActivity::class.java).apply {
        flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP
      }
    val openPending =
      PendingIntent.getActivity(
        this,
        0,
        openIntent,
        PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE,
      )

    val n =
      NotificationCompat.Builder(this, SUMMARY_CHANNEL_ID)
        .setContentTitle(title)
        .setContentText(summaryText)
        .setStyle(NotificationCompat.BigTextStyle().bigText(summaryText))
        .setSmallIcon(R.mipmap.ic_launcher)
        .setOngoing(false)
        .setAutoCancel(true)
        .setOnlyAlertOnce(true)
        .setSilent(true)
        .setPriority(NotificationCompat.PRIORITY_DEFAULT)
        .setCategory(NotificationCompat.CATEGORY_ALARM)
        .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
        .setContentIntent(openPending)
        .build()
    nm.notify(SUMMARY_NOTIFICATION_ID, n)
  }

  companion object {
    /** Canale v2: HIGH importance, suono nullo (sirena via MediaPlayer). */
    const val CHANNEL_ID = "alarm_siren_fgs_v2"

    /** Canale per il messaggio dopo lo stop sirena. */
    const val SUMMARY_CHANNEL_ID = "alarm_siren_summary_v2"

    private const val NOTIFICATION_ID = 91002
    private const val SUMMARY_NOTIFICATION_ID = 91003

    const val ACTION_START = "com.allarmeapp.action.START_ALARM_SIREN_SERVICE"
    const val ACTION_STOP = "com.allarmeapp.action.STOP_ALARM_SIREN_SERVICE"
    const val EXTRA_TITLE = "extra_title"
    const val EXTRA_BODY = "extra_body"

    /** 20 minuti — poi la sirena si ferma da sola e mostra il messaggio. */
    private const val MAX_DURATION_MS = 20L * 60L * 1000L

    fun start(context: Context, title: String, body: String) {
      val i =
        Intent(context, AlarmSirenForegroundService::class.java).apply {
          action = ACTION_START
          putExtra(EXTRA_TITLE, title)
          putExtra(EXTRA_BODY, body)
        }
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
        context.startForegroundService(i)
      } else {
        context.startService(i)
      }
    }

    fun stop(context: Context) {
      val i =
        Intent(context, AlarmSirenForegroundService::class.java).apply {
          action = ACTION_STOP
        }
      context.startService(i)
    }
  }
}
