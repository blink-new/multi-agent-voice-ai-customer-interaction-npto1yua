import { blink } from '../blink/client'
import type { Agent, ConversationContext, AppointmentData, ConsultationData } from '../types/voice-ai'

export class AgentManager {
  private agents: Map<string, Agent> = new Map()
  private activeContexts: Map<string, ConversationContext> = new Map()

  constructor() {
    this.initializeAgents()
  }

  private initializeAgents(): void {
    // Booking Agent
    const bookingAgent: Agent = {
      id: 'booking-agent-001',
      name: 'Sarah',
      type: 'booking',
      persona: `You are Sarah, a professional appointment booking specialist. 
      You're warm, efficient, and detail-oriented. You help customers schedule appointments 
      by gathering their preferred dates, times, and service requirements. 
      You speak naturally and handle interruptions gracefully. 
      Always confirm details before booking and provide clear next steps.`,
      voiceId: 'nova',
      isActive: true
    }

    // Consultation Agent
    const consultationAgent: Agent = {
      id: 'consultation-agent-001',
      name: 'Michael',
      type: 'consultation',
      persona: `You are Michael, a skilled consultation specialist. 
      You're empathetic, thorough, and professional. You collect detailed information 
      about customer needs, concerns, and requirements for consultations. 
      You ask clarifying questions naturally and ensure all important details are captured. 
      You handle sensitive topics with care and maintain professional boundaries.`,
      voiceId: 'onyx',
      isActive: true
    }

    this.agents.set(bookingAgent.id, bookingAgent)
    this.agents.set(consultationAgent.id, consultationAgent)
  }

  public async routeCall(customerId: string, initialMessage: string): Promise<Agent> {
    // Intelligent intent detection using GPT
    const intent = await this.detectIntent(initialMessage)
    
    let selectedAgent: Agent
    
    if (intent.includes('appointment') || intent.includes('booking') || intent.includes('schedule')) {
      selectedAgent = this.agents.get('booking-agent-001')!
    } else {
      selectedAgent = this.agents.get('consultation-agent-001')!
    }

    // Initialize conversation context
    const context: ConversationContext = {
      customerId,
      intent,
      entities: await this.extractEntities(initialMessage),
      conversationHistory: [initialMessage],
      currentAgent: selectedAgent.id
    }

    this.activeContexts.set(customerId, context)
    
    console.log(`Routed customer ${customerId} to ${selectedAgent.name} (${selectedAgent.type})`)
    
    return selectedAgent
  }

  private async detectIntent(message: string): Promise<string> {
    try {
      const { text } = await blink.ai.generateText({
        prompt: `Analyze this customer message and determine their primary intent. 
        Respond with one of: "appointment_booking", "consultation_request", "general_inquiry"
        
        Customer message: "${message}"
        
        Intent:`,
        model: 'gpt-4o-mini',
        maxTokens: 10
      })

      return text.trim().toLowerCase()
    } catch (error) {
      console.error('Intent detection failed:', error)
      return 'general_inquiry'
    }
  }

  private async extractEntities(message: string): Promise<Record<string, any>> {
    try {
      const { object } = await blink.ai.generateObject({
        prompt: `Extract relevant entities from this customer message. 
        Look for: names, dates, times, services, contact info, urgency levels.
        
        Message: "${message}"`,
        schema: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            date: { type: 'string' },
            time: { type: 'string' },
            service: { type: 'string' },
            email: { type: 'string' },
            phone: { type: 'string' },
            urgency: { type: 'string', enum: ['low', 'medium', 'high'] }
          }
        }
      })

      return object
    } catch (error) {
      console.error('Entity extraction failed:', error)
      return {}
    }
  }

  public async processMessage(customerId: string, message: string): Promise<string> {
    const context = this.activeContexts.get(customerId)
    if (!context) {
      throw new Error('No active context for customer')
    }

    const agent = this.agents.get(context.currentAgent)
    if (!agent) {
      throw new Error('Agent not found')
    }

    // Update conversation history
    context.conversationHistory.push(message)

    // Generate contextual response
    const response = await this.generateAgentResponse(agent, context, message)

    // Update context with new entities
    const newEntities = await this.extractEntities(message)
    context.entities = { ...context.entities, ...newEntities }

    // Check if we need to transfer or complete the task
    await this.handleTaskCompletion(context, message, response)

    return response
  }

  private async generateAgentResponse(agent: Agent, context: ConversationContext, message: string): Promise<string> {
    const conversationHistory = context.conversationHistory.slice(-10).join('\n')
    
    const systemPrompt = `${agent.persona}

    Current conversation context:
    - Customer ID: ${context.customerId}
    - Intent: ${context.intent}
    - Extracted entities: ${JSON.stringify(context.entities)}
    
    Recent conversation:
    ${conversationHistory}
    
    Guidelines:
    - Keep responses under 50 words for low latency
    - Be natural and conversational
    - Handle interruptions gracefully
    - Ask one question at a time
    - Confirm important details
    - Use the customer's name if known`

    try {
      const { text } = await blink.ai.generateText({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: message }
        ],
        model: 'gpt-4o-mini',
        maxTokens: 150
      })

      return text
    } catch (error) {
      console.error('Agent response generation failed:', error)
      return "I apologize, I'm having trouble processing that. Could you please repeat?"
    }
  }

  private async handleTaskCompletion(context: ConversationContext, message: string, response: string): Promise<void> {
    const agent = this.agents.get(context.currentAgent)!
    
    if (agent.type === 'booking') {
      await this.handleBookingCompletion(context, message)
    } else if (agent.type === 'consultation') {
      await this.handleConsultationCompletion(context, message)
    }
  }

  private async handleBookingCompletion(context: ConversationContext, message: string): Promise<void> {
    // Check if we have enough information to book
    const entities = context.entities
    
    if (entities.name && entities.date && entities.time && entities.service) {
      const appointmentData: AppointmentData = {
        customerName: entities.name,
        email: entities.email || '',
        phone: entities.phone || '',
        preferredDate: entities.date,
        preferredTime: entities.time,
        serviceType: entities.service,
        duration: 60, // Default 1 hour
        notes: context.conversationHistory.join(' ')
      }

      // Save to Google Calendar (simulated)
      await this.saveToGoogleCalendar(appointmentData)
      
      // Save to database
      await this.saveAppointmentToDatabase(appointmentData)
      
      console.log('Appointment booked successfully:', appointmentData)
    }
  }

  private async handleConsultationCompletion(context: ConversationContext, message: string): Promise<void> {
    const entities = context.entities
    
    if (entities.name && entities.service) {
      const consultationData: ConsultationData = {
        customerName: entities.name,
        email: entities.email || '',
        phone: entities.phone || '',
        consultationType: entities.service,
        urgency: entities.urgency || 'medium',
        description: context.conversationHistory.join(' '),
        preferredContact: entities.email ? 'email' : 'phone',
        followUpRequired: true
      }

      // Save to Google Sheets (simulated)
      await this.saveToGoogleSheets(consultationData)
      
      // Save to database
      await this.saveConsultationToDatabase(consultationData)
      
      console.log('Consultation details saved:', consultationData)
    }
  }

  private async saveToGoogleCalendar(appointmentData: AppointmentData): Promise<void> {
    // This would integrate with Google Calendar API
    console.log('Saving to Google Calendar:', appointmentData)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async saveToGoogleSheets(consultationData: ConsultationData): Promise<void> {
    // This would integrate with Google Sheets API
    console.log('Saving to Google Sheets:', consultationData)
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 100))
  }

  private async saveAppointmentToDatabase(appointmentData: AppointmentData): Promise<void> {
    try {
      await blink.db.appointments.create({
        customerName: appointmentData.customerName,
        email: appointmentData.email,
        phone: appointmentData.phone,
        preferredDate: appointmentData.preferredDate,
        preferredTime: appointmentData.preferredTime,
        serviceType: appointmentData.serviceType,
        duration: appointmentData.duration,
        notes: appointmentData.notes,
        status: 'scheduled',
        createdAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to save appointment to database:', error)
    }
  }

  private async saveConsultationToDatabase(consultationData: ConsultationData): Promise<void> {
    try {
      await blink.db.consultations.create({
        customerName: consultationData.customerName,
        email: consultationData.email,
        phone: consultationData.phone,
        consultationType: consultationData.consultationType,
        urgency: consultationData.urgency,
        description: consultationData.description,
        preferredContact: consultationData.preferredContact,
        followUpRequired: consultationData.followUpRequired,
        status: 'pending',
        createdAt: new Date().toISOString()
      })
    } catch (error) {
      console.error('Failed to save consultation to database:', error)
    }
  }

  public async transferCall(customerId: string, targetAgentType: 'booking' | 'consultation', reason: string): Promise<Agent> {
    const context = this.activeContexts.get(customerId)
    if (!context) {
      throw new Error('No active context for customer')
    }

    const targetAgentId = targetAgentType === 'booking' ? 'booking-agent-001' : 'consultation-agent-001'
    const targetAgent = this.agents.get(targetAgentId)!

    // Update context
    context.currentAgent = targetAgentId
    context.transferReason = reason
    context.conversationHistory.push(`[TRANSFERRED TO ${targetAgent.name.toUpperCase()}]`)

    console.log(`Transferred customer ${customerId} to ${targetAgent.name}: ${reason}`)
    
    return targetAgent
  }

  public getActiveAgents(): Agent[] {
    return Array.from(this.agents.values()).filter(agent => agent.isActive)
  }

  public getConversationContext(customerId: string): ConversationContext | undefined {
    return this.activeContexts.get(customerId)
  }

  public endCall(customerId: string): void {
    this.activeContexts.delete(customerId)
    console.log(`Ended call for customer ${customerId}`)
  }
}