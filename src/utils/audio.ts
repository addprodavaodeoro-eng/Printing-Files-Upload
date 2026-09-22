export interface SoundSettings {
  soundEnabled: boolean;
  soundVolume: number; // 0 to 100
  selectedSoundType: 'default' | 'custom';
  customSoundFilename?: string | null;
  hasCustomSound?: boolean;
}

class SoundNotifier {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;
  private volume: number = 80; // 0 - 100
  private selectedSoundType: 'default' | 'custom' = 'default';
  private customSoundFilename: string | null = null;
  private customAudio: HTMLAudioElement | null = null;
  private seenRequestIds: Set<string> = new Set();
  private audioBlocked: boolean = false;

  constructor() {
    if (typeof window !== 'undefined') {
      const savedEnabled = localStorage.getItem('oyangoren_sound_enabled');
      if (savedEnabled !== null) {
        this.enabled = savedEnabled === 'true';
      }

      const savedVol = localStorage.getItem('oyangoren_sound_volume');
      if (savedVol !== null) {
        const parsed = Number(savedVol);
        if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
          this.volume = parsed;
        }
      }

      const savedType = localStorage.getItem('oyangoren_sound_type');
      if (savedType === 'custom' || savedType === 'default') {
        this.selectedSoundType = savedType;
      }

      const savedFilename = localStorage.getItem('oyangoren_sound_filename');
      if (savedFilename) {
        this.customSoundFilename = savedFilename;
      }

      // Pre-listen to user gestures to unlock audio context
      const unlock = () => {
        this.unlockAudioContext();
        window.removeEventListener('click', unlock);
        window.removeEventListener('keydown', unlock);
        window.removeEventListener('touchstart', unlock);
      };
      window.addEventListener('click', unlock, { once: true });
      window.addEventListener('keydown', unlock, { once: true });
      window.addEventListener('touchstart', unlock, { once: true });
    }
  }

  public isEnabled(): boolean {
    return this.enabled;
  }

  public getVolume(): number {
    return this.volume;
  }

  public getSoundType(): 'default' | 'custom' {
    return this.selectedSoundType;
  }

  public getCustomFilename(): string | null {
    return this.customSoundFilename;
  }

  public isBlocked(): boolean {
    return this.audioBlocked;
  }

  public updateConfig(config: {
    soundEnabled?: boolean;
    soundVolume?: number;
    selectedSoundType?: 'default' | 'custom';
    customSoundFilename?: string | null;
    hasCustomSound?: boolean;
  }) {
    if (config.soundEnabled !== undefined) {
      this.setEnabled(config.soundEnabled);
    }
    if (config.soundVolume !== undefined) {
      this.setVolume(config.soundVolume);
    }
    if (config.selectedSoundType !== undefined) {
      this.selectedSoundType = config.selectedSoundType;
      if (typeof window !== 'undefined') {
        localStorage.setItem('oyangoren_sound_type', config.selectedSoundType);
      }
    }
    if (config.customSoundFilename !== undefined) {
      this.customSoundFilename = config.customSoundFilename;
      if (typeof window !== 'undefined') {
        if (config.customSoundFilename) {
          localStorage.setItem('oyangoren_sound_filename', config.customSoundFilename);
        } else {
          localStorage.removeItem('oyangoren_sound_filename');
        }
      }
    }

    if (config.hasCustomSound || config.customSoundFilename) {
      this.setupCustomAudio();
    }
  }

  public setEnabled(val: boolean) {
    this.enabled = val;
    if (typeof window !== 'undefined') {
      localStorage.setItem('oyangoren_sound_enabled', String(val));
    }
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(100, vol));
    this.volume = clamped;
    if (typeof window !== 'undefined') {
      localStorage.setItem('oyangoren_sound_volume', String(clamped));
    }
  }

  public setSoundType(type: 'default' | 'custom') {
    this.selectedSoundType = type;
    if (typeof window !== 'undefined') {
      localStorage.setItem('oyangoren_sound_type', type);
    }
  }

  public setupCustomAudio() {
    if (typeof window === 'undefined') return;
    const cacheBuster = Date.now();
    const url = `/api/admin/settings/notification-sound/file?t=${cacheBuster}`;
    if (!this.customAudio) {
      this.customAudio = new Audio();
    }
    this.customAudio.src = url;
    this.customAudio.load();
  }

  public unlockAudioContext() {
    if (typeof window === 'undefined') return;
    try {
      if (!this.ctx) {
        const AudioCtx =
          window.AudioContext ||
          (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
      if (this.customAudio) {
        this.customAudio.load();
      }
      this.audioBlocked = false;
    } catch {
      // ignore
    }
  }

  public markRequestsSeen(ids: string[]) {
    for (const id of ids) {
      if (id) this.seenRequestIds.add(id);
    }
  }

  public notifyNewRequest(requestId: string): boolean {
    if (!requestId) return false;
    if (this.seenRequestIds.has(requestId)) {
      return false; // Prevent repeating sound for previously notified request
    }
    this.seenRequestIds.add(requestId);
    this.playNotificationSound();
    return true;
  }

  public async playNotificationSound(): Promise<boolean> {
    if (!this.enabled || typeof window === 'undefined') return false;

    // Try custom sound first if custom selected
    if (this.selectedSoundType === 'custom') {
      try {
        if (!this.customAudio) {
          this.setupCustomAudio();
        }
        if (this.customAudio) {
          this.customAudio.volume = Math.max(0, Math.min(1, this.volume / 100));
          this.customAudio.currentTime = 0;
          const playPromise = this.customAudio.play();
          if (playPromise !== undefined) {
            await playPromise;
          }
          this.audioBlocked = false;
          return true;
        }
      } catch (err: any) {
        if (err?.name === 'NotAllowedError') {
          this.audioBlocked = true;
          console.warn('Notification audio playback blocked by browser autoplay policy.');
          return false;
        }
        console.warn('Custom notification audio playback failed, falling back to chime:', err);
      }
    }

    // Default synthesized chime
    return this.playChime();
  }

  public playChime(): boolean {
    if (!this.enabled || typeof window === 'undefined') return false;
    try {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) return false;
      if (!this.ctx) {
        this.ctx = new AudioCtx();
      }
      if (this.ctx.state === 'suspended') {
        this.ctx.resume();
      }

      const now = this.ctx.currentTime;
      const masterVol = Math.max(0, Math.min(1, this.volume / 100));
      if (masterVol === 0) return true;

      // High-pitched pleasant bell chime (D5 -> A5 harmonized)
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const gainNode = this.ctx.createGain();

      osc1.type = 'sine';
      osc2.type = 'triangle';

      osc1.frequency.setValueAtTime(587.33, now); // D5
      osc1.frequency.exponentialRampToValueAtTime(880, now + 0.12); // A5

      osc2.frequency.setValueAtTime(880, now);
      osc2.frequency.exponentialRampToValueAtTime(1174.66, now + 0.12); // D6

      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(0.25 * masterVol, now + 0.03);
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

      osc1.connect(gainNode);
      osc2.connect(gainNode);
      gainNode.connect(this.ctx.destination);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.6);
      osc2.stop(now + 0.6);

      this.audioBlocked = false;
      return true;
    } catch {
      this.audioBlocked = true;
      return false;
    }
  }
}

export const soundNotifier = new SoundNotifier();
