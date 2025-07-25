export interface VoiceAIConfig {
  sttProvider: 'deepgram' | 'azure' | 'google'
  ttsProvider: 'elevenlabs' | 'azure' | 'openai'
  gptModel: 'gpt-4o' | 'gpt-4-turbo'
  latencyTarget: number
  interruptionThreshold: number
}

export interface Agent {
  id: string
  name: string
  type: 'booking' | 'consultation'
  persona: string
  voiceId: string
  isActive: boolean
  currentCall?: string
}

export interface CallSession {
  id: string
  customerId: string
  agentId: string
  status: 'connecting' | 'active' | 'on-hold' | 'transferring' | 'ended'
  startTime: Date
  duration: number
  transcript: TranscriptEntry[]
  metrics: CallMetrics
}

export interface TranscriptEntry {
  id: string
  timestamp: Date
  speaker: 'customer' | 'agent'
  text: string
  confidence: number
  isInterruption?: boolean
  processingTime?: number
}

export interface CallMetrics {
  latency: {
    stt: number
    gpt: number
    tts: number
    total: number
  }
  audioQuality: number
  interruptionCount: number
  responseTime: number
  customerSatisfaction?: number
}

export interface VoiceProcessingState {
  isListening: boolean
  isProcessing: boolean
  isSpeaking: boolean
  currentVolume: number
  silenceDetected: boolean
  interruptionDetected: boolean
}

export interface ConversationContext {
  customerId: string
  intent: string
  entities: Record<string, any>
  conversationHistory: string[]
  currentAgent: string
  transferReason?: string
  appointmentData?: AppointmentData
  consultationData?: ConsultationData
}

export interface AppointmentData {
  customerName: string
  email: string
  phone: string
  preferredDate: string
  preferredTime: string
  serviceType: string
  duration: number
  notes?: string
}

export interface ConsultationData {
  customerName: string
  email: string
  phone: string
  consultationType: string
  urgency: 'low' | 'medium' | 'high'
  description: string
  preferredContact: string
  followUpRequired: boolean
}

export interface TwilioCallData {
  callSid: string
  from: string
  to: string
  status: string
  direction: 'inbound' | 'outbound'
  startTime: Date
  endTime?: Date
}