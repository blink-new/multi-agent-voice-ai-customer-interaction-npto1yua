import React, { useState, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from './ui/card'
import { Button } from './ui/button'
import { Badge } from './ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs'
import { 
  Phone, 
  Users, 
  Calendar, 
  FileSpreadsheet, 
  Activity, 
  Clock,
  TrendingUp,
  AlertCircle,
  CheckCircle,
  PhoneCall
} from 'lucide-react'
import { VoiceInterface } from './VoiceInterface'
import { blink } from '../blink/client'

interface DashboardStats {
  totalCalls: number
  activeCalls: number
  avgLatency: number
  successRate: number
  appointmentsBooked: number
  consultationsCollected: number
}

export function Dashboard() {
  const [activeTab, setActiveTab] = useState('overview')
  const [stats, setStats] = useState<DashboardStats>({
    totalCalls: 0,
    activeCalls: 0,
    avgLatency: 0,
    successRate: 0,
    appointmentsBooked: 0,
    consultationsCollected: 0
  })
  const [isCallActive, setIsCallActive] = useState(false)
  const [user, setUser] = useState<any>(null)

  const loadDashboardStats = useCallback(async () => {
    if (!user?.id) return
    
    try {
      // Load appointments
      const appointments = await blink.db.appointments.list({
        where: { userId: user.id },
        limit: 1000
      })

      // Load consultations
      const consultations = await blink.db.consultations.list({
        where: { userId: user.id },
        limit: 1000
      })

      // Load call sessions
      const callSessions = await blink.db.callSessions.list({
        where: { userId: user.id },
        limit: 1000
      })

      // Calculate stats
      const totalCalls = callSessions.length
      const activeCalls = callSessions.filter(call => call.status === 'active').length
      const avgLatency = callSessions.length > 0 
        ? callSessions.reduce((sum, call) => sum + (call.avgLatency || 0), 0) / callSessions.length
        : 0
      const successRate = totalCalls > 0 
        ? (callSessions.filter(call => call.status === 'completed').length / totalCalls) * 100
        : 0

      setStats({
        totalCalls,
        activeCalls,
        avgLatency,
        successRate,
        appointmentsBooked: appointments.length,
        consultationsCollected: consultations.length
      })
    } catch (error) {
      console.error('Failed to load dashboard stats:', error)
    }
  }, [user?.id])

  useEffect(() => {
    const unsubscribe = blink.auth.onAuthStateChanged((state) => {
      setUser(state.user)
    })
    return unsubscribe
  }, [])

  useEffect(() => {
    if (user) {
      loadDashboardStats()
    }
  }, [user, loadDashboardStats])

  const startNewCall = () => {
    setIsCallActive(true)
    setActiveTab('voice-interface')
  }

  const handleCallEnd = () => {
    setIsCallActive(false)
    setActiveTab('overview')
    loadDashboardStats() // Refresh stats after call
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <Card className="w-96">
          <CardContent className="pt-6">
            <div className="text-center">
              <Phone className="w-12 h-12 mx-auto mb-4 text-blue-600" />
              <h2 className="text-xl font-semibold mb-2">Voice AI System</h2>
              <p className="text-gray-600 mb-4">Please sign in to access the dashboard</p>
              <Button onClick={() => blink.auth.login()}>
                Sign In
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <Phone className="w-8 h-8 text-blue-600" />
                <h1 className="text-xl font-bold text-gray-900">Voice AI System</h1>
              </div>
              {isCallActive && (
                <Badge variant="destructive" className="animate-pulse">
                  <PhoneCall className="w-3 h-3 mr-1" />
                  Call Active
                </Badge>
              )}
            </div>
            
            <div className="flex items-center space-x-4">
              <Button
                onClick={startNewCall}
                disabled={isCallActive}
                className="bg-blue-600 hover:bg-blue-700"
              >
                <Phone className="w-4 h-4 mr-2" />
                {isCallActive ? 'Call in Progress' : 'Start New Call'}
              </Button>
              
              <Button
                variant="outline"
                onClick={() => blink.auth.logout()}
              >
                Sign Out
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="voice-interface">Voice Interface</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Calls</CardTitle>
                  <Phone className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.totalCalls}</div>
                  <p className="text-xs text-muted-foreground">
                    {stats.activeCalls} active now
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Latency</CardTitle>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.avgLatency.toFixed(0)}ms</div>
                  <p className="text-xs text-muted-foreground">
                    Target: ≤300ms
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
                  <TrendingUp className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.successRate.toFixed(1)}%</div>
                  <p className="text-xs text-muted-foreground">
                    Call completion rate
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Appointments</CardTitle>
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stats.appointmentsBooked}</div>
                  <p className="text-xs text-muted-foreground">
                    Booked successfully
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Agent Status */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Users className="w-5 h-5" />
                    <span>Agent Status</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Sarah (Booking Agent)</p>
                          <p className="text-sm text-gray-600">Available</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Ready</Badge>
                    </div>
                    
                    <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                      <div className="flex items-center space-x-3">
                        <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                        <div>
                          <p className="font-medium">Michael (Consultation Agent)</p>
                          <p className="text-sm text-gray-600">Available</p>
                        </div>
                      </div>
                      <Badge variant="secondary">Ready</Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <Activity className="w-5 h-5" />
                    <span>System Health</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Voice Processing</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Operational</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Twilio Connection</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Google Calendar</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Synced</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Google Sheets</span>
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="w-4 h-4 text-green-500" />
                        <span className="text-sm text-green-600">Connected</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Recent Activity */}
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="flex items-center space-x-3 p-3 bg-blue-50 rounded-lg">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Appointment booked for John Smith</p>
                      <p className="text-xs text-gray-600">2 minutes ago • Sarah (Booking Agent)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-green-50 rounded-lg">
                    <FileSpreadsheet className="w-5 h-5 text-green-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">Consultation details saved for Jane Doe</p>
                      <p className="text-xs text-gray-600">5 minutes ago • Michael (Consultation Agent)</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-3 bg-yellow-50 rounded-lg">
                    <AlertCircle className="w-5 h-5 text-yellow-600" />
                    <div className="flex-1">
                      <p className="text-sm font-medium">High latency detected (450ms)</p>
                      <p className="text-xs text-gray-600">10 minutes ago • System Alert</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="voice-interface">
            <VoiceInterface 
              customerId={user.id} 
              onCallEnd={handleCallEnd}
            />
          </TabsContent>

          <TabsContent value="analytics">
            <Card>
              <CardHeader>
                <CardTitle>Call Analytics</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <TrendingUp className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Analytics Dashboard</h3>
                  <p className="text-gray-600">
                    Detailed analytics and reporting features coming soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12">
                  <Activity className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Configuration Panel</h3>
                  <p className="text-gray-600">
                    Voice AI configuration and settings panel coming soon.
                  </p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  )
}