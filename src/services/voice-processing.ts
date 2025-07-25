import { blink } from '../blink/client'
import type { VoiceProcessingState, TranscriptEntry, CallMetrics } from '../types/voice-ai'

export class VoiceProcessingEngine {
  private mediaRecorder: MediaRecorder | null = null
  private audioContext: AudioContext | null = null
  private analyser: AnalyserNode | null = null
  private stream: MediaStream | null = null
  private isProcessing = false
  private silenceTimer: NodeJS.Timeout | null = null
  private interruptionBuffer: Blob[] = []
  private currentProcessingId: string | null = null
  private currentAudio: HTMLAudioElement | null = null

  // Advanced interruption handling
  private readonly SILENCE_THRESHOLD = 0.01
  private readonly SILENCE_DURATION = 1500 // 1.5s
  private readonly INTERRUPTION_THRESHOLD = 0.05
  private readonly MAX_PROCESSING_TIME = 200 // 200ms target
  private readonly CHUNK_SIZE = 1024

  static checkBrowserCompatibility(): { supported: boolean; issues: string[] } {
    const issues: string[] = []

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      issues.push('getUserMedia not supported')
    }

    if (!window.MediaRecorder) {
      issues.push('MediaRecorder not supported')
    }

    if (!window.AudioContext && !(window as any).webkitAudioContext) {
      issues.push('AudioContext not supported')
    }

    if (!window.FileReader) {
      issues.push('FileReader not supported')
    }

    return {
      supported: issues.length === 0,
      issues
    }
  }

  private getSupportedMimeType(): { mimeType: string; bitrate: number } {
    // List of MIME types to try in order of preference
    const mimeTypes = [
      { mimeType: 'audio/webm;codecs=opus', bitrate: 16000 },
      { mimeType: 'audio/webm', bitrate: 16000 },
      { mimeType: 'audio/mp4', bitrate: 16000 },
      { mimeType: 'audio/ogg;codecs=opus', bitrate: 16000 },
      { mimeType: 'audio/wav', bitrate: 16000 },
      { mimeType: 'audio/mpeg', bitrate: 16000 }
    ]

    // Find the first supported MIME type
    for (const format of mimeTypes) {
      if (MediaRecorder.isTypeSupported(format.mimeType)) {
        console.log(`Using supported MIME type: ${format.mimeType}`)
        return format
      }
    }

    // Fallback to default (should work on most browsers)
    console.warn('No preferred MIME type supported, using default')
    return { mimeType: '', bitrate: 16000 }
  }

  private async checkMediaRecorderSupport(): Promise<boolean> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      console.error('getUserMedia not supported')
      return false
    }

    if (!window.MediaRecorder) {
      console.error('MediaRecorder not supported')
      return false
    }

    return true
  }

  async initialize(): Promise<void> {
    try {
      // Check browser support first
      const isSupported = await this.checkMediaRecorderSupport()
      if (!isSupported) {
        throw new Error('Browser does not support required audio features')
      }

      // Request microphone access with optimized settings
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 16000,
          channelCount: 1
        }
      })

      // Initialize audio context
      this.audioContext = new AudioContext({ sampleRate: 16000 })
      
      // Resume audio context if suspended (required by some browsers)
      if (this.audioContext.state === 'suspended') {
        await this.audioContext.resume()
      }

      this.analyser = this.audioContext.createAnalyser()
      this.analyser.fftSize = 2048
      this.analyser.smoothingTimeConstant = 0.8

      const source = this.audioContext.createMediaStreamSource(this.stream)
      source.connect(this.analyser)

      // Find supported MIME type with fallbacks
      const supportedMimeType = this.getSupportedMimeType()
      
      // Create MediaRecorder with proper error handling
      try {
        if (supportedMimeType.mimeType) {
          this.mediaRecorder = new MediaRecorder(this.stream, {
            mimeType: supportedMimeType.mimeType,
            audioBitsPerSecond: supportedMimeType.bitrate
          })
        } else {
          // Fallback without specifying MIME type
          this.mediaRecorder = new MediaRecorder(this.stream)
        }
      } catch (error) {
        console.warn('Failed to create MediaRecorder with preferred settings, using defaults:', error)
        this.mediaRecorder = new MediaRecorder(this.stream)
      }

      this.setupRecordingHandlers()
      this.startVoiceActivityDetection()
      
      console.log('Voice processing engine initialized successfully')
    } catch (error) {
      console.error('Failed to initialize voice processing:', error)
      this.cleanup()
      throw error
    }
  }

  private setupRecordingHandlers(): void {
    if (!this.mediaRecorder) return

    let audioChunks: Blob[] = []

    this.mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data)
      }
    }

    this.mediaRecorder.onstop = async () => {
      if (audioChunks.length === 0) return

      const audioBlob = new Blob(audioChunks, { 
        type: this.mediaRecorder?.mimeType || 'audio/webm' 
      })
      audioChunks = []

      // Process audio with interruption handling
      await this.processAudioWithInterruption(audioBlob)
    }

    this.mediaRecorder.onerror = (event) => {
      console.error('MediaRecorder error:', event)
    }

    this.mediaRecorder.onstart = () => {
      console.log('Recording started')
    }
  }

  private async processAudioWithInterruption(audioBlob: Blob): Promise<void> {
    const processingId = Date.now().toString()
    this.currentProcessingId = processingId
    this.isProcessing = true

    try {
      const startTime = performance.now()

      // Convert to base64 for transcription
      const base64Audio = await this.blobToBase64(audioBlob)
      
      // Advanced STT with interruption detection
      const transcriptionResult = await this.performSTT(base64Audio)
      
      // Check if this processing was interrupted
      if (this.currentProcessingId !== processingId) {
        console.log('Processing interrupted, discarding result')
        return
      }

      const sttTime = performance.now() - startTime

      // Skip empty or very short transcriptions
      if (!transcriptionResult.text.trim() || transcriptionResult.text.length < 3) {
        console.log('Skipping empty or very short transcription')
        return
      }

      // GPT processing with context awareness
      const gptStartTime = performance.now()
      const response = await this.performGPTProcessing(transcriptionResult.text)
      const gptTime = performance.now() - gptStartTime

      // Check interruption again before TTS
      if (this.currentProcessingId !== processingId) {
        console.log('Processing interrupted before TTS')
        return
      }

      // Advanced TTS with human-like characteristics
      const ttsStartTime = performance.now()
      await this.performTTS(response)
      const ttsTime = performance.now() - ttsStartTime

      const totalTime = performance.now() - startTime

      // Log metrics
      this.logProcessingMetrics({
        stt: sttTime,
        gpt: gptTime,
        tts: ttsTime,
        total: totalTime
      })

    } catch (error) {
      console.error('Voice processing error:', error)
    } finally {
      this.isProcessing = false
    }
  }

  private async performSTT(audioBase64: string): Promise<{ text: string; confidence: number }> {
    try {
      const result = await blink.ai.transcribeAudio({
        audio: audioBase64,
        language: 'en',
        model: 'whisper-1'
      })

      return {
        text: result.text,
        confidence: 0.95 // Whisper typically has high confidence
      }
    } catch (error) {
      console.error('STT processing failed:', error)
      throw error
    }
  }

  private async performGPTProcessing(text: string): Promise<string> {
    try {
      // Advanced prompt with interruption handling context
      const systemPrompt = `You are a professional AI agent handling customer calls. 
      You must respond naturally and handle interruptions gracefully. 
      Keep responses concise (under 50 words) for low latency.
      If the customer seems to be interrupting, acknowledge it naturally.
      Maintain conversation context and be helpful.`

      const { text: response } = await blink.ai.generateText({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: text }
        ],
        model: 'gpt-4o-mini',
        maxTokens: 150
      })

      return response
    } catch (error) {
      console.error('GPT processing failed:', error)
      throw error
    }
  }

  private async performTTS(text: string): Promise<void> {
    try {
      const { url } = await blink.ai.generateSpeech({
        text,
        voice: 'nova', // Human-like voice
        speed: 1.1 // Slightly faster for natural conversation
      })

      // Play audio with interruption capability
      await this.playAudioWithInterruption(url)
    } catch (error) {
      console.error('TTS processing failed:', error)
      throw error
    }
  }

  private async playAudioWithInterruption(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl)
      
      audio.onended = () => {
        this.currentAudio = null
        resolve()
      }
      
      audio.onerror = () => {
        this.currentAudio = null
        reject(new Error('Audio playback failed'))
      }
      
      // Store reference for interruption
      this.currentAudio = audio
      audio.play().catch((error) => {
        this.currentAudio = null
        reject(error)
      })
    })
  }

  public interruptCurrentResponse(): void {
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    
    // Cancel current processing
    this.currentProcessingId = null
    
    console.log('Response interrupted by user')
  }

  private startVoiceActivityDetection(): void {
    if (!this.analyser) return

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)

    const detectActivity = () => {
      if (!this.analyser) return // Safety check

      this.analyser.getByteFrequencyData(dataArray)
      
      // Calculate RMS for voice activity detection
      let sum = 0
      for (let i = 0; i < bufferLength; i++) {
        sum += dataArray[i] * dataArray[i]
      }
      const rms = Math.sqrt(sum / bufferLength) / 255

      // Detect speech vs silence
      if (rms > this.INTERRUPTION_THRESHOLD) {
        this.handleVoiceActivity(rms)
      } else if (rms < this.SILENCE_THRESHOLD) {
        this.handleSilence()
      }

      // Continue detection loop
      requestAnimationFrame(detectActivity)
    }

    detectActivity()
  }

  private handleVoiceActivity(volume: number): void {
    // Clear silence timer
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    // If AI is currently speaking, this is an interruption
    if (this.currentAudio && !this.currentAudio.paused) {
      this.interruptCurrentResponse()
    }

    // Start recording if not already
    if (this.mediaRecorder?.state === 'inactive') {
      try {
        this.mediaRecorder.start(100) // 100ms chunks for low latency
      } catch (error) {
        console.error('Failed to start recording:', error)
      }
    }
  }

  private handleSilence(): void {
    if (this.silenceTimer) return

    this.silenceTimer = setTimeout(() => {
      // Stop recording after silence period
      if (this.mediaRecorder?.state === 'recording') {
        try {
          this.mediaRecorder.stop()
        } catch (error) {
          console.error('Failed to stop recording:', error)
        }
      }
      this.silenceTimer = null
    }, this.SILENCE_DURATION)
  }

  private async blobToBase64(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        const base64 = dataUrl.split(',')[1]
        resolve(base64)
      }
      reader.onerror = reject
      reader.readAsDataURL(blob)
    })
  }

  private logProcessingMetrics(metrics: CallMetrics['latency']): void {
    console.log('Voice Processing Metrics:', {
      STT: `${metrics.stt.toFixed(1)}ms`,
      GPT: `${metrics.gpt.toFixed(1)}ms`,
      TTS: `${metrics.tts.toFixed(1)}ms`,
      Total: `${metrics.total.toFixed(1)}ms`,
      Target: '≤300ms',
      Status: metrics.total <= 300 ? '✅ PASS' : '⚠️ SLOW'
    })
  }

  public getProcessingState(): VoiceProcessingState {
    return {
      isListening: this.mediaRecorder?.state === 'recording' || false,
      isProcessing: this.isProcessing,
      isSpeaking: this.currentAudio ? !this.currentAudio.paused : false,
      currentVolume: this.getCurrentVolume(),
      silenceDetected: this.silenceTimer !== null,
      interruptionDetected: false
    }
  }

  private getCurrentVolume(): number {
    if (!this.analyser) return 0

    const bufferLength = this.analyser.frequencyBinCount
    const dataArray = new Uint8Array(bufferLength)
    this.analyser.getByteFrequencyData(dataArray)

    let sum = 0
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i]
    }
    return sum / bufferLength / 255
  }

  public cleanup(): void {
    try {
      if (this.mediaRecorder?.state === 'recording') {
        this.mediaRecorder.stop()
      }
    } catch (error) {
      console.warn('Error stopping MediaRecorder:', error)
    }
    
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop())
      this.stream = null
    }
    
    if (this.audioContext && this.audioContext.state !== 'closed') {
      this.audioContext.close()
      this.audioContext = null
    }
    
    if (this.currentAudio) {
      this.currentAudio.pause()
      this.currentAudio = null
    }
    
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = null
    }

    this.mediaRecorder = null
    this.analyser = null
    this.isProcessing = false
    this.currentProcessingId = null
    
    console.log('Voice processing engine cleaned up')
  }
}