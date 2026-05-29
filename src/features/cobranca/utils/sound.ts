const MUTE_KEY = 'whatsapp_notif_muted'

let audioCtx: AudioContext | null = null

export function isNotifMuted(): boolean {
  try {
    return localStorage.getItem(MUTE_KEY) === '1'
  } catch {
    return false
  }
}

export function setNotifMuted(muted: boolean): void {
  try {
    localStorage.setItem(MUTE_KEY, muted ? '1' : '0')
  } catch {
    // ignore
  }
}

/**
 * Toca um bipe curto de notificação via Web Audio API (sem depender de asset).
 * Respeita a preferência de silenciar. Falha silenciosamente se o navegador
 * bloquear o áudio (ex.: sem interação prévia do usuário).
 */
export function playNotificationSound(): void {
  if (isNotifMuted()) return
  try {
    const Ctor =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!Ctor) return
    audioCtx = audioCtx ?? new Ctor()
    if (audioCtx.state === 'suspended') void audioCtx.resume()

    const ctx = audioCtx
    const now = ctx.currentTime

    const tone = (freq: number, start: number, dur: number) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0.0001, now + start)
      gain.gain.exponentialRampToValueAtTime(0.18, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + start + dur)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + dur)
    }

    tone(880, 0, 0.18)
    tone(1175, 0.16, 0.22)
  } catch {
    // ignore
  }
}
