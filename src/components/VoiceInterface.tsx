import React, { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Progress } from './ui/progress'
import { Separator } from './ui/separator'
import { 
  Mic, 
  MicOff, 
  Phone, 
  PhoneOff, 
  Volume2, 
  VolumeX,
  Activity,
  Clock,
  User,
  MessageSquare,
  Zap
} from 'lucide-react'
import { VoiceProcessingEngine } from '../services/voice-processing'
import { AgentManager } from '../services/agent-manager'
import type { VoiceProcessingState, Agent, TranscriptEntry, CallMetrics } from '../types/voice-ai'

interface VoiceInterfaceProps {
  customerId: string
  onCallEnd?: () => void
}

export function VoiceInterface({ customerId, onCallEnd }: VoiceInterfaceProps) {
  const [isCallActive, setIsCallActive] = useState(false)
  const [currentAgent, setCurrentAgent] = useState<Agent | null>(null)
  const [processingState, setProcessingState] = useState<VoiceProcessingState>({
    isListening: false,
    isProcessing: false,
    isSpeaking: false,
    currentVolume: 0,
    silenceDetected: false,
    interruptionDetected: false
  })
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [metrics, setMetrics] = useState<CallMetrics>({
    latency: { stt: 0, gpt: 0, tts: 0, total: 0 },
    audioQuality: 0,
    interruptionCount: 0,
    responseTime: 0
  })
  const [isMuted, setIsMuted] = useState(false)

  const voiceEngineRef = useRef<VoiceProcessingEngine | null>(null)
  const agentManagerRef = useRef<AgentManager | null>(null)
  const animationFrameRef = useRef<number>()

  const updateProcessingState = React.useCallback(() => {
    if (voiceEngineRef.current) {
      const state = voiceEngineRef.current.getProcessingState()
      setProcessingState(state)
    }
    
    if (isCallActive) {
      animationFrameRef.current = requestAnimationFrame(updateProcessingState)
    }
  }, [isCallActive])

  useEffect(() => {
    agentManagerRef.current = new AgentManager()
    
    return () => {
      if (voiceEngineRef.current) {
        voiceEngineRef.current.cleanup()
      }
    }
  }, [])

  useEffect(() => {
    if (isCallActive) {
      updateProcessingState()
    }
  }, [isCallActive, updateProcessingState])

  const startCall = async () => {
    try {
      setIsCallActive(true)
      
      // Initialize voice processing
      voiceEngineRef.current = new VoiceProcessingEngine()
      await voiceEngineRef.current.initialize()
      
      // Route initial call
      const agent = await agentManagerRef.current!.routeCall(customerId, "Hello, I need help")
      setCurrentAgent(agent)
      
      // Add initial transcript entry
      const initialEntry: TranscriptEntry = {
        id: Date.now().toString(),
        timestamp: new Date(),
        speaker: 'agent',
        text: `Hello! I'm ${agent.name}, your ${agent.type} specialist. How can I help you today?`,
        confidence: 1.0
      }
      setTranscript([initialEntry])
      
      console.log('Call started successfully')
    } catch (error) {
      console.error('Failed to start call:', error)
      setIsCallActive(false)
    }
  }

  const endCall = () => {
    setIsCallActive(false)
    
    if (voiceEngineRef.current) {
      voiceEngineRef.current.cleanup()
      voiceEngineRef.current = null
    }
    
    if (agentManagerRef.current) {
      agentManagerRef.current.endCall(customerId)
    }
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
    }
    
    onCallEnd?.()
    console.log('Call ended')
  }

  const toggleMute = () => {
    setIsMuted(!isMuted)
    // In a real implementation, this would mute the microphone
  }

  const interruptAgent = () => {
    if (voiceEngineRef.current) {
      voiceEngineRef.current.interruptCurrentResponse()
      setMetrics(prev => ({
        ...prev,
        interruptionCount: prev.interruptionCount + 1
      }))
    }
  }

  const getStatusColor = () => {
    if (processingState.isSpeaking) return 'bg-blue-500'
    if (processingState.isProcessing) return 'bg-yellow-500'
    if (processingState.isListening) return 'bg-green-500'
    return 'bg-gray-400'
  }

  const getLatencyStatus = () => {
    const total = metrics.latency.total
    if (total <= 200) return { color: 'text-green-600', status: 'Excellent' }
    if (total <= 300) return { color: 'text-yellow-600', status: 'Good' }
    return { color: 'text-red-600', status: 'Slow' }
  }

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-6">
      {/* Call Status Header */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className={`w-4 h-4 rounded-full ${getStatusColor()} animate-pulse`} />
              <CardTitle className="text-xl">
                {isCallActive ? 'Call Active' : 'Call Inactive'}
              </CardTitle>
              {currentAgent && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <User className="w-3 h-3" />
                  <span>{currentAgent.name} ({currentAgent.type})</span>
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-2">
              {isCallActive && (
                <>
                  <Button
                    variant={isMuted ? "destructive" : "outline"}
                    size="sm"
                    onClick={toggleMute}
                  >
                    {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={interruptAgent}
                    disabled={!processingState.isSpeaking}
                  >
                    <Zap className="w-4 h-4" />
                    Interrupt
                  </Button>
                </>
              )}
              
              <Button
                variant={isCallActive ? "destructive" : "default"}
                onClick={isCallActive ? endCall : startCall}
                className="flex items-center space-x-2"
              >
                {isCallActive ? (
                  <>
                    <PhoneOff className="w-4 h-4" />
                    <span>End Call</span>
                  </>
                ) : (
                  <>
                    <Phone className="w-4 h-4" />
                    <span>Start Call</span>
                  </>
                )}
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {isCallActive && (
        <>
          {/* Voice Activity Visualization */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Activity className="w-5 h-5" />
                <span>Voice Activity</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Volume Meter */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Input Volume</span>
                    <span>{Math.round(processingState.currentVolume * 100)}%</span>
                  </div>
                  <Progress 
                    value={processingState.currentVolume * 100} 
                    className="h-2"
                  />
                </div>

                {/* Processing States */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                      processingState.isListening ? 'bg-green-100 text-green-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Mic className="w-6 h-6" />
                    </div>
                    <p className="text-sm mt-2">Listening</p>
                  </div>
                  
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                      processingState.isProcessing ? 'bg-yellow-100 text-yellow-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Activity className="w-6 h-6" />
                    </div>
                    <p className="text-sm mt-2">Processing</p>
                  </div>
                  
                  <div className="text-center">
                    <div className={`w-12 h-12 mx-auto rounded-full flex items-center justify-center ${
                      processingState.isSpeaking ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'
                    }`}>
                      <Volume2 className="w-6 h-6" />
                    </div>
                    <p className="text-sm mt-2">Speaking</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Performance Metrics */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center space-x-2">
                <Clock className="w-5 h-5" />
                <span>Performance Metrics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {metrics.latency.stt.toFixed(0)}ms
                  </div>
                  <p className="text-sm text-gray-600">STT Latency</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {metrics.latency.gpt.toFixed(0)}ms
                  </div>
                  <p className="text-sm text-gray-600">GPT Processing</p>
                </div>
                
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {metrics.latency.tts.toFixed(0)}ms
                  </div>
                  <p className="text-sm text-gray-600">TTS Latency</p>
                </div>
                
                <div className="text-center">
                  <div className={`text-2xl font-bold ${getLatencyStatus().color}`}>
                    {metrics.latency.total.toFixed(0)}ms
                  </div>
                  <p className="text-sm text-gray-600">Total ({getLatencyStatus().status})</p>
                </div>
              </div>
              
              <Separator className="my-4" />
              
              <div className="flex justify-between text-sm">
                <span>Interruptions: {metrics.interruptionCount}</span>
                <span>Target: ≤300ms</span>
              </div>
            </CardContent>
          </Card>

          {/* Live Transcript */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center space-x-2">
                <MessageSquare className="w-5 h-5" />
                <span>Live Transcript</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-64 overflow-y-auto">
                {transcript.map((entry) => (
                  <div
                    key={entry.id}
                    className={`flex space-x-3 ${
                      entry.speaker === 'agent' ? 'justify-start' : 'justify-end'
                    }`}
                  >
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        entry.speaker === 'agent'
                          ? 'bg-blue-100 text-blue-900'
                          : 'bg-gray-100 text-gray-900'
                      }`}
                    >
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-xs font-medium">
                          {entry.speaker === 'agent' ? currentAgent?.name : 'Customer'}
                        </span>
                        <span className="text-xs text-gray-500">
                          {entry.timestamp.toLocaleTimeString()}
                        </span>
                        {entry.confidence && (
                          <Badge variant="outline" className="text-xs">
                            {Math.round(entry.confidence * 100)}%
                          </Badge>
                        )}
                      </div>
                      <p className="text-sm">{entry.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}