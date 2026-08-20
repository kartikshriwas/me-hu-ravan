'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { UserAvatar } from '@/components/UserAvatar';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import {
  ShieldCheck,
  Crown,
  Key,
  Rocket,
  Mail,
  Users,
  BarChart3,
  Plus,
  CheckCircle2,
  Copy,
  Download,
  Upload,
  Search,
  Check,
  AlertCircle,
  Clock,
  Sparkles,
  Lock,
  ArrowRight,
  RefreshCw,
  X,
  BookOpen,
  Activity,
  Eye,
  Globe,
  Laptop,
  Smartphone,
  Tablet,
  Trash2,
  History
} from 'lucide-react';

interface SessionEventItem {
  timestamp: number;
  type: 'navigation' | 'state_change' | 'interaction';
  details: string;
}

interface ActiveSessionItem {
  id: string;
  sessionId: string;
  userEmail: string;
  userName: string;
  userImage?: string;
  currentPath: string;
  pageTitle: string;
  state: 'active' | 'idle' | 'focus' | 'background';
  activeSeconds: number;
  idleSeconds: number;
  focusSeconds: number;
  lastSeenSecondsAgo: number;
  startedAt: string;
  lastHeartbeat: string;
  deviceType: 'desktop' | 'mobile' | 'tablet';
  browser: string;
  os: string;
  screenResolution: string;
  networkType: string;
  recentEvents: SessionEventItem[];
  userAgent?: string;
}

interface ActiveSessionStats {
  onlineNowCount: number;
  activeNowCount: number;
  idleNowCount: number;
  backgroundCount: number;
  desktopCount: number;
  mobileCount: number;
  tabletCount: number;
  totalActiveSecondsToday: number;
  totalIdleSecondsToday: number;
  totalFocusSecondsToday: number;
  candidateCountToday: number;
  avgActiveSecondsPerUser: number;
  avgFocusSecondsPerUser: number;
}

interface TopActiveUserItem {
  userEmail: string;
  userName: string;
  userImage?: string;
  activeSeconds: number;
  idleSeconds: number;
  focusSeconds: number;
  lastActivePath: string;
  totalScore?: number;
  testsCompleted?: number;
}

interface TopUsersByTimeframe {
  today: TopActiveUserItem[];
  yesterday: TopActiveUserItem[];
  thisWeek: TopActiveUserItem[];
  lastWeek: TopActiveUserItem[];
  thisMonth: TopActiveUserItem[];
  lastMonth: TopActiveUserItem[];
  thisYear: TopActiveUserItem[];
  lastYear: TopActiveUserItem[];
  allTime: TopActiveUserItem[];
}

interface TopPageItem {
  path: string;
  title: string;
  count: number;
}

interface AdminStats {
  totalUsers: number;
  premiumUsers: number;
  freeUsers: number;
  totalCodes: number;
  activeEventsCount: number;
  totalAttempts: number;
  preapprovedCount: number;
}

interface RedeemCodeItem {
  id: string;
  code: string;
  durationDays: number;
  maxUses: number;
  usedCount: number;
  usedBy: Array<{ userEmail: string; usedAt: string }>;
  expiresAt: string | null;
  createdBy: string;
  batchName: string;
  isActive: boolean;
  createdAt: string;
}

interface LaunchEventItem {
  id: string;
  title: string;
  maxClaimCount: number;
  claimedCount: number;
  durationDays: number;
  isActive: boolean;
  claimedUsers: Array<{ userEmail: string; claimedAt: string }>;
  createdBy: string;
  createdAt: string;
}

interface PreapprovedEmailItem {
  id: string;
  email: string;
  durationDays: number;
  addedBy: string;
  isActivated: boolean;
  activatedAt: string | null;
  createdAt: string;
}

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: 'superadmin' | 'admin' | 'user';
  adminPermissions: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  premiumPlan: string;
  totalScore: number;
  testsCompleted: number;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'events' | 'emails' | 'users' | 'active-sessions'>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [codes, setCodes] = useState<RedeemCodeItem[]>([]);
  const [events, setEvents] = useState<LaunchEventItem[]>([]);
  const [emails, setEmails] = useState<PreapprovedEmailItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);

  // Active Sessions Live Monitoring state
  const [activeSessions, setActiveSessions] = useState<ActiveSessionItem[]>([]);
  const [activeStats, setActiveStats] = useState<ActiveSessionStats | null>(null);
  const [topPagesRightNow, setTopPagesRightNow] = useState<TopPageItem[]>([]);
  const [topActiveUsers, setTopActiveUsers] = useState<TopActiveUserItem[]>([]);
  const [topUsersByTimeframe, setTopUsersByTimeframe] = useState<TopUsersByTimeframe | null>(null);
  const [topUsersTimeframeFilter, setTopUsersTimeframeFilter] = useState<'today' | 'yesterday' | 'thisWeek' | 'lastWeek' | 'thisMonth' | 'lastMonth' | 'thisYear' | 'lastYear' | 'allTime'>('today');
  const [refreshingSessions, setRefreshingSessions] = useState(false);
  const [sessionSearchQuery, setSessionSearchQuery] = useState('');
  const [sessionStateFilter, setSessionStateFilter] = useState<'all' | 'active' | 'idle' | 'background' | 'registered' | 'guest'>('all');
  const [inspectingSession, setInspectingSession] = useState<ActiveSessionItem | null>(null);

  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Code Generator Form
  const [codePrefix, setCodePrefix] = useState('PREPTEA');
  const [codeCount, setCodeCount] = useState(10);
  const [codeDuration, setCodeDuration] = useState(365);
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [codeBatchName, setCodeBatchName] = useState('Batch Access');
  const [generatingCodes, setGeneratingCodes] = useState(false);

  // Event Creator Form
  const [eventTitle, setEventTitle] = useState('Launch Promo - Next 100 Free Premium');
  const [eventMaxClaims, setEventMaxClaims] = useState(100);
  const [eventDuration, setEventDuration] = useState(365);
  const [creatingEvent, setCreatingEvent] = useState(false);

  // Bulk Email Form & File Upload
  const [emailText, setEmailText] = useState('');
  const [bulkDuration, setBulkDuration] = useState(365);
  const [grantingEmails, setGrantingEmails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Global Free Access Form
  const [globalFreeDays, setGlobalFreeDaysInput] = useState<number>(7);
  const [isGlobalFreeActive, setIsGlobalFreeActive] = useState<boolean>(false);
  const [globalFreeUntilDate, setGlobalFreeUntilDate] = useState<string | null>(null);
  const [updatingGlobalFree, setUpdatingGlobalFree] = useState<boolean>(false);

  // User Search & Code Copy
  const [userQuery, setUserQuery] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState('');

  const isSuperadmin = authUser?.email?.toLowerCase().trim() === 'fykartik@gmail.com';
  const isAdmin = isSuperadmin || authUser?.role === 'superadmin' || authUser?.role === 'admin';

  // Load Tab Data
  useEffect(() => {
    if (!authUser || !isAdmin) {
      setLoading(false);
      return;
    }

    async function loadAdminData() {
      try {
        setLoading(true);
        if (activeTab === 'overview') {
          const res = await fetch('/api/admin/stats');
          const json = await res.json();
          if (json.success) setStats(json.stats);

          const freeRes = await fetch('/api/admin/global-free');
          const freeJson = await freeRes.json();
          if (freeJson.success) {
            setIsGlobalFreeActive(!!freeJson.isGlobalFree);
            setGlobalFreeUntilDate(freeJson.freeUntil ? new Date(freeJson.freeUntil).toLocaleString() : null);
          }
        } else if (activeTab === 'codes') {
          const res = await fetch('/api/admin/codes');
          const json = await res.json();
          if (json.success) setCodes(json.codes);
        } else if (activeTab === 'events') {
          const res = await fetch('/api/admin/events');
          const json = await res.json();
          if (json.success) setEvents(json.events);
        } else if (activeTab === 'emails') {
          const res = await fetch('/api/admin/emails');
          const json = await res.json();
          if (json.success) setEmails(json.emails);
        } else if (activeTab === 'users') {
          const res = await fetch('/api/admin/users');
          const json = await res.json();
          if (json.success) setUsers(json.users);
        } else if (activeTab === 'active-sessions') {
          const res = await fetch('/api/admin/active-sessions');
          const json = await res.json();
          if (json.success) {
            setActiveSessions(json.sessions);
            setActiveStats(json.stats);
            if (json.topPagesRightNow) setTopPagesRightNow(json.topPagesRightNow);
            if (json.topActiveUsersToday) setTopActiveUsers(json.topActiveUsersToday);
            if (json.topUsersByTimeframe) setTopUsersByTimeframe(json.topUsersByTimeframe);
          }
        }
      } catch (err) {
        console.error('Failed to load admin tab data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [authUser?.email, isAdmin, activeTab]);

  // Auto-refresh active sessions every 8 seconds when activeTab === 'active-sessions'
  useEffect(() => {
    if (activeTab !== 'active-sessions' || !authUser || !isAdmin) return;

    const interval = setInterval(async () => {
      try {
        setRefreshingSessions(true);
        const res = await fetch('/api/admin/active-sessions');
        const json = await res.json();
        if (json.success) {
          setActiveSessions(json.sessions);
          setActiveStats(json.stats);
          if (json.topPagesRightNow) setTopPagesRightNow(json.topPagesRightNow);
          if (json.topActiveUsersToday) setTopActiveUsers(json.topActiveUsersToday);
          if (json.topUsersByTimeframe) setTopUsersByTimeframe(json.topUsersByTimeframe);
        }
      } catch (e) {
        // ignore
      } finally {
        setTimeout(() => setRefreshingSessions(false), 500);
      }
    }, 8000);

    return () => clearInterval(interval);
  }, [activeTab, authUser, isAdmin]);

  const handleTerminateSession = async (sessionId: string) => {
    try {
      const res = await fetch('/api/admin/active-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate', targetSessionId: sessionId }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(`Session ${sessionId} terminated successfully.`);
        setActiveSessions((prev) => prev.filter((s) => s.sessionId !== sessionId));
        if (inspectingSession?.sessionId === sessionId) setInspectingSession(null);
      } else {
        setErrorMsg(json.error || 'Failed to terminate session');
      }
    } catch {
      setErrorMsg('Error terminating session');
    }
  };

  // Code Generator Submit
  const handleGenerateCodes = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setGeneratingCodes(true);
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prefix: codePrefix,
          count: codeCount,
          durationDays: codeDuration,
          maxUses: codeMaxUses,
          batchName: codeBatchName,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message || `Generated ${json.codes.length} codes!`);
        // reload codes
        const codeRes = await fetch('/api/admin/codes');
        const codeJson = await codeRes.json();
        if (codeJson.success) setCodes(codeJson.codes);
      } else {
        setErrorMsg(json.error || 'Failed to generate codes');
      }
    } catch {
      setErrorMsg('Error submitting code generation');
    } finally {
      setGeneratingCodes(false);
    }
  };

  // Create Launch Event Submit
  const handleCreateEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setCreatingEvent(true);
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: eventTitle,
          maxClaimCount: eventMaxClaims,
          durationDays: eventDuration,
          isActive: true,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message || 'Launch event created successfully!');
        setEventTitle('');
        const eventRes = await fetch('/api/admin/events');
        const eventJson = await eventRes.json();
        if (eventJson.success) setEvents(eventJson.events);
      } else {
        setErrorMsg(json.error || 'Failed to create event');
      }
    } catch {
      setErrorMsg('Error creating launch event');
    } finally {
      setCreatingEvent(false);
    }
  };

  // Set Global Free Access Status
  const handleSetGlobalFree = async (daysToSet: number) => {
    try {
      setUpdatingGlobalFree(true);
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/global-free', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ days: daysToSet }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        setIsGlobalFreeActive(!!json.isGlobalFree);
        setGlobalFreeUntilDate(json.freeUntil ? new Date(json.freeUntil).toLocaleString() : null);
      } else {
        setErrorMsg(json.error || 'Failed to update global free access');
      }
    } catch {
      setErrorMsg('Error setting platform global free status');
    } finally {
      setUpdatingGlobalFree(false);
    }
  };

  // Toggle Launch Event Active Status
  const handleToggleEvent = async (eventId: string) => {
    try {
      const res = await fetch('/api/admin/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'toggle', eventId }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        const eventRes = await fetch('/api/admin/events');
        const eventJson = await eventRes.json();
        if (eventJson.success) setEvents(eventJson.events);
      }
    } catch (err) {
      console.error('Toggle event error:', err);
    }
  };

  // Bulk Email Grant Submit
  const handleGrantEmails = async (emailList: string[]) => {
    if (!emailList || emailList.length === 0) {
      setErrorMsg('No email addresses specified');
      return;
    }

    try {
      setGrantingEmails(true);
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/emails', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          emails: emailList,
          durationDays: bulkDuration,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message || `Granted premium to ${json.count} emails!`);
        setEmailText('');
        const emailRes = await fetch('/api/admin/emails');
        const emailJson = await emailRes.json();
        if (emailJson.success) setEmails(emailJson.emails);
      } else {
        setErrorMsg(json.error || 'Failed to grant premium to emails');
      }
    } catch {
      setErrorMsg('Network error while processing emails');
    } finally {
      setGrantingEmails(false);
    }
  };

  // CSV / Text File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      if (content) {
        // Parse CSV or newline-delimited text file
        const lines = content.split(/[\r\n,;]+/);
        const extracted = lines
          .map((line) => line.trim().toLowerCase())
          .filter((line) => line.includes('@') && line.length >= 5);

        if (extracted.length > 0) {
          handleGrantEmails(extracted);
        } else {
          setErrorMsg('No valid email addresses found in uploaded file');
        }
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Admin Permission Management List
  const ALL_ADMIN_PERMISSIONS = [
    { id: 'access_courses', label: 'View Courses Catalog', desc: 'Allows viewing /courses catalog and unit details', icon: BookOpen },
    { id: 'manage_codes', label: 'Redeem Code Generator', desc: 'Create, view, and export batch promo codes', icon: Key },
    { id: 'manage_events', label: 'Launch Event Promos', desc: 'Create & toggle launch promos for new candidates', icon: Rocket },
    { id: 'manage_emails', label: 'Bulk CSV & Pre-Approved Emails', desc: 'Upload CSV email lists and grant access', icon: Mail },
    { id: 'manage_global_free', label: 'Global Free Access Tool', desc: 'Make platform free for everyone for X days', icon: Sparkles },
    { id: 'manage_users', label: 'User Roles & Admin Rights', desc: 'Manage candidate roles and admin permissions', icon: Users },
  ];

  const [editingUserForPerms, setEditingUserForPerms] = useState<AdminUserItem | null>(null);
  const [selectedPerms, setSelectedPerms] = useState<string[]>([]);

  // User Role & Permissions Submit
  const handleUpdateUser = async (targetEmail: string, role: string, isPremium: boolean, adminPermissions?: string[]) => {
    try {
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetEmail,
          role,
          isPremium,
          adminPermissions: adminPermissions ?? (role === 'admin' ? ['manage_codes', 'manage_events', 'manage_emails', 'manage_users', 'manage_global_free'] : []),
          durationDays: 365,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        const userRes = await fetch('/api/admin/users');
        const userJson = await userRes.json();
        if (userJson.success) setUsers(userJson.users);
      } else {
        setErrorMsg(json.error || 'Failed to update user');
      }
    } catch {
      setErrorMsg('Error updating user');
    }
  };

  const openPermissionModal = (u: AdminUserItem) => {
    setEditingUserForPerms(u);
    setSelectedPerms(u.adminPermissions && u.adminPermissions.length > 0
      ? u.adminPermissions
      : []);
  };

  const handleSavePermissions = async () => {
    if (!editingUserForPerms) return;
    await handleUpdateUser(editingUserForPerms.email, editingUserForPerms.role, editingUserForPerms.isPremium, selectedPerms);
    setEditingUserForPerms(null);
  };

  // Copy Code to Clipboard
  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCodeId(id);
    setTimeout(() => setCopiedCodeId(''), 2000);
  };

  // Export Codes to CSV
  const downloadCodesCSV = () => {
    if (codes.length === 0) return;
    const headers = ['Code', 'Batch Name', 'Duration (Days)', 'Max Uses', 'Used Count', 'Status', 'Created By', 'Created At'];
    const rows = codes.map((c) => [
      c.code,
      `"${c.batchName}"`,
      c.durationDays,
      c.maxUses,
      c.usedCount,
      c.isActive ? 'Active' : 'Inactive',
      c.createdBy,
      c.createdAt,
    ]);

    const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `preptea_redeem_codes_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };


  if (authLoading) {
    return (
      <div className="space-y-6">
        <div className="glass-panel rounded-3xl p-8 h-64 animate-pulse bg-slate-900/40" />
      </div>
    );
  }

  // 404 Authorization Guard: Unauthorized access throws 404 Not Found
  if (!authUser || !isAdmin) {
    notFound();
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userQuery.toLowerCase())
  );

  return (
    <div className="space-y-8">
      
      {/* Admin Header Banner */}
      <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-amber-500/30 relative overflow-hidden space-y-4">
        <div className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-br from-amber-500/15 via-purple-500/10 to-transparent rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-bold uppercase tracking-wider">
              <ShieldCheck className="w-4 h-4 text-amber-400" />
              <span>Admin Management Hub</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-black text-white mt-2">PrepTea Control Panel</h1>
            <p className="text-xs text-slate-300 mt-1">
              Manage candidate passes, redeem codes, launch events, CSV bulk email grants, and admin permissions.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <UserAvatar name={authUser.name} email={authUser.email} image={authUser.image} size="md" />
            <div className="text-left">
              <p className="text-xs font-bold text-white">{authUser.name}</p>
              <p className="text-[10px] text-amber-300 font-mono capitalize">{authUser.role || 'Super Admin'}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Global Notifications / Alerts */}
      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-slate-400 hover:text-white">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1.5 glass-panel rounded-2xl border border-slate-800">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3 },
          { id: 'active-sessions', label: 'Live Monitor 🟢', icon: Activity },
          { id: 'codes', label: 'Redeem Codes', icon: Key },
          { id: 'events', label: 'Launch Events', icon: Rocket },
          { id: 'emails', label: 'Bulk CSV / Emails', icon: Mail },
          { id: 'users', label: 'User Roles & Perms', icon: Users },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any);
                setFeedbackMsg('');
                setErrorMsg('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-gradient-to-r from-amber-500 to-yellow-500 text-black shadow-lg shadow-amber-500/20'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Total Registered Candidates</span>
              <p className="text-2xl font-black text-white">{stats?.totalUsers ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Active Premium Members</span>
              <p className="text-2xl font-black text-emerald-400">{stats?.premiumUsers ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Generated Redeem Codes</span>
              <p className="text-2xl font-black text-indigo-400">{stats?.totalCodes ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-slate-800 space-y-2">
              <span className="text-xs text-slate-400 font-medium">Active Launch Promos</span>
              <p className="text-2xl font-black text-amber-400">{stats?.activeEventsCount ?? '-'}</p>
            </div>
          </div>

          {/* Global Platform-Wide Free Access Feature Card */}
          <div className="glass-panel rounded-3xl p-6 border border-indigo-500/30 space-y-4 bg-gradient-to-r from-indigo-950/40 via-purple-950/20 to-slate-900 shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
                  <h3 className="text-base font-bold text-white">Make Platform Free For Everyone</h3>
                </div>
                <p className="text-xs text-slate-300">
                  Instantly unlock all premium practice tests and solutions for all candidates on the platform for X days.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {isGlobalFreeActive ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Free for everyone until {globalFreeUntilDate}</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-slate-400 text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Normal Access Rules Active</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Choose Duration (Days)</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {[1, 3, 7, 14, 30].map((d) => (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setGlobalFreeDaysInput(d)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        globalFreeDays === d
                          ? 'bg-indigo-600 text-white border-indigo-400 shadow-md shadow-indigo-950/50'
                          : 'bg-slate-900/90 text-slate-300 border-slate-800 hover:bg-slate-800'
                      }`}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-slate-400 font-semibold">Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={globalFreeDays}
                      onChange={(e) => setGlobalFreeDaysInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 bg-transparent text-white font-bold outline-none text-center no-spin"
                    />
                    <span className="text-slate-400 font-semibold">Days</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={updatingGlobalFree}
                  onClick={() => handleSetGlobalFree(globalFreeDays)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 via-teal-500 to-indigo-600 hover:from-emerald-400 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>{updatingGlobalFree ? 'Updating...' : `Make Platform Free (${globalFreeDays} Days)`}</span>
                </button>

                {isGlobalFreeActive && (
                  <button
                    type="button"
                    disabled={updatingGlobalFree}
                    onClick={() => handleSetGlobalFree(0)}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-300 font-bold text-xs transition-all disabled:opacity-50"
                    title="Revert platform back to normal access rules"
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}


      {/* TAB: LIVE ACTIVE SESSIONS MONITOR */}
      {activeTab === 'active-sessions' && (
        <div className="space-y-8 animate-fade-in">
          {/* Header Bar & Auto-Refresh Indicator */}
          <div className="flex items-center justify-between flex-wrap gap-4 relative overflow-hidden glass-panel p-6 rounded-3xl border border-slate-800/80 shadow-2xl">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </div>
                <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-slate-400">Live Mission Control</h3>
              </div>
              <p className="text-sm text-slate-400 mt-1 font-medium ml-11">
                Real-time active candidate monitoring, advanced telemetry, and action audit trails.
              </p>
            </div>

            <div className="flex items-center gap-4 relative z-10 bg-slate-950/60 p-2 pl-4 rounded-2xl border border-slate-800/80 backdrop-blur-md">
              <div className="text-right">
                <p className="text-sm font-black text-emerald-400 flex items-center justify-end gap-1.5 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span>{activeStats?.onlineNowCount || 0} Online</span>
                </p>
                <p className="text-[10px] text-slate-500 font-mono mt-0.5 uppercase tracking-wider font-bold">
                  Auto-refresh 8s
                </p>
              </div>

              <button
                onClick={async () => {
                  try {
                    setRefreshingSessions(true);
                    const res = await fetch('/api/admin/active-sessions');
                    const json = await res.json();
                    if (json.success) {
                      setActiveSessions(json.sessions);
                      setActiveStats(json.stats);
                      if (json.topPagesRightNow) setTopPagesRightNow(json.topPagesRightNow);
                    }
                  } catch {} finally {
                    setTimeout(() => setRefreshingSessions(false), 400);
                  }
                }}
                className="p-3 rounded-xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700 hover:border-indigo-500/50 text-slate-300 hover:text-white transition-all shadow-lg group"
                title="Force Refresh Telemetry"
              >
                <RefreshCw className={`w-4 h-4 group-hover:rotate-180 transition-transform duration-500 ${refreshingSessions ? 'animate-spin text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Bento Box Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Primary Metric - Active Users */}
            <div className="col-span-1 md:col-span-4 glass-card rounded-3xl p-6 border border-emerald-500/30 bg-gradient-to-br from-emerald-950/20 to-transparent relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors">
                <Users className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/80 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Actively Interacting
                </span>
                <div className="flex items-baseline gap-3">
                  <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-emerald-200">
                    {activeStats?.activeNowCount ?? 0}
                  </p>
                  <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 font-medium">Candidates currently focused and engaging.</p>
              </div>
            </div>

            {/* Middle Column - Time Metrics */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-5">
              <div className="flex-1 glass-card rounded-3xl p-5 border border-amber-500/20 bg-amber-950/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 block mb-1">Avg Focus / Session</span>
                  <p className="text-2xl font-black text-amber-300">
                    {Math.floor((activeStats?.avgActiveSecondsPerUser || 0) / 60)}<span className="text-sm text-amber-500/70">m</span> {(activeStats?.avgActiveSecondsPerUser || 0) % 60}<span className="text-sm text-amber-500/70">s</span>
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <Clock className="w-6 h-6 text-amber-400" />
                </div>
              </div>
              <div className="flex-1 glass-card rounded-3xl p-5 border border-purple-500/20 bg-purple-950/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-500/80 block mb-1">Total Time Logged Today</span>
                  <p className="text-2xl font-black text-purple-300">
                    {Math.floor((activeStats?.totalActiveSecondsToday || 0) / 3600)}<span className="text-sm text-purple-500/70">h</span> {Math.floor(((activeStats?.totalActiveSecondsToday || 0) % 3600) / 60)}<span className="text-sm text-purple-500/70">m</span>
                  </p>
                </div>
                <div className="p-3 bg-purple-500/10 rounded-2xl border border-purple-500/20">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
              </div>
            </div>

            {/* Right Column - Device Breakdown */}
            <div className="col-span-1 md:col-span-4 glass-card rounded-3xl p-6 border border-blue-500/20 bg-blue-950/10 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-400 flex items-center gap-2 mb-4">
                <Laptop className="w-4 h-4" /> Platform Distribution
              </span>
              
              <div className="space-y-4">
                {[{ label: 'Desktop', icon: Laptop, count: activeStats?.desktopCount || 0, color: 'bg-indigo-500', bg: 'bg-indigo-500/20', text: 'text-indigo-400' },
                  { label: 'Mobile', icon: Smartphone, count: activeStats?.mobileCount || 0, color: 'bg-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-400' },
                  { label: 'Tablet', icon: Tablet, count: activeStats?.tabletCount || 0, color: 'bg-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-400' }
                ].map((device) => {
                  const total = (activeStats?.desktopCount || 0) + (activeStats?.mobileCount || 0) + (activeStats?.tabletCount || 0);
                  const percentage = total === 0 ? 0 : Math.round((device.count / total) * 100);
                  
                  return (
                    <div key={device.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-slate-300">
                          <device.icon className={`w-3.5 h-3.5 ${device.text}`} /> {device.label}
                        </span>
                        <span className={device.text}>{device.count} <span className="text-slate-500 font-medium">({percentage}%)</span></span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-900 rounded-full overflow-hidden border border-slate-800">
                        <div className={`h-full ${device.color} rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Most Active Candidates Usage Leaderboard (Multi-timeframe) */}
          {(() => {
            const activeTimeframeList = topUsersByTimeframe
              ? topUsersByTimeframe[topUsersTimeframeFilter] || []
              : topActiveUsers;

            const timeframeLabels = {
              today: 'Today',
              yesterday: 'Yesterday',
              thisWeek: 'This Week',
              lastWeek: 'Last Week',
              thisMonth: 'This Month',
              lastMonth: 'Last Month',
              thisYear: 'This Year',
              lastYear: 'Last Year',
              allTime: 'All Time',
            };

            return (
              <div className="glass-panel rounded-3xl border border-amber-500/20 p-5 space-y-4 bg-amber-950/10">
                <div className="flex items-center justify-between flex-wrap gap-3">
                  <div className="flex items-center gap-2">
                    <Crown className="w-5 h-5 text-amber-400" />
                    <div>
                      <h4 className="text-sm font-black text-white">
                        Top Candidates Leaderboard ({activeTimeframeList.length})
                      </h4>
                      <p className="text-[10px] text-slate-400 font-medium">
                        Showing top candidates for <span className="text-amber-400 font-bold">{timeframeLabels[topUsersTimeframeFilter]}</span>
                      </p>
                    </div>
                  </div>

                  {/* Timeframe selector dropdown */}
                  <div className="relative shrink-0">
                    <select
                      value={topUsersTimeframeFilter}
                      onChange={(e) => setTopUsersTimeframeFilter(e.target.value as any)}
                      className="px-3.5 py-2 rounded-xl bg-slate-900 border border-amber-500/30 text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-md cursor-pointer appearance-none pr-8"
                    >
                      <option value="today" className="bg-slate-950 text-slate-200">📅 Today</option>
                      <option value="yesterday" className="bg-slate-950 text-slate-200">⏮️ Yesterday</option>
                      <option value="thisWeek" className="bg-slate-950 text-slate-200">📅 This Week</option>
                      <option value="lastWeek" className="bg-slate-950 text-slate-200">⏮️ Last Week</option>
                      <option value="thisMonth" className="bg-slate-950 text-slate-200">📅 This Month</option>
                      <option value="lastMonth" className="bg-slate-950 text-slate-200">⏮️ Last Month</option>
                      <option value="thisYear" className="bg-slate-950 text-slate-200">🗓️ This Year</option>
                      <option value="lastYear" className="bg-slate-950 text-slate-200">⏮️ Last Year</option>
                      <option value="allTime" className="bg-slate-950 text-amber-300 font-bold">🏆 All Time</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                {activeTimeframeList.length === 0 ? (
                  <div className="p-6 text-center bg-slate-900/40 rounded-2xl border border-slate-800/80">
                    <p className="text-xs font-bold text-slate-400">No candidate activity logged for {timeframeLabels[topUsersTimeframeFilter]}</p>
                    <p className="text-[10px] text-slate-500 mt-0.5">As candidates study or take practice tests, their usage metrics will populate here.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                    {activeTimeframeList.slice(0, 9).map((u, idx) => {
                      const activeMins = Math.floor(u.activeSeconds / 60);
                      const activeSecs = u.activeSeconds % 60;
                      const activeHours = Math.floor(activeMins / 60);
                      const activeMinsRemainder = activeMins % 60;

                      const timeDisplay =
                        activeHours > 0
                          ? `${activeHours}h ${activeMinsRemainder}m`
                          : `${activeMins}m ${activeSecs}s`;

                      const rankBadge = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `#${idx + 1}`;

                      return (
                        <div
                          key={u.userEmail}
                          className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3 hover:border-amber-500/40 transition-all shadow-md"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm font-black w-6 text-center text-amber-300 shrink-0">{rankBadge}</span>
                            <UserAvatar name={u.userName} email={u.userEmail} image={u.userImage} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-white truncate">{u.userName}</p>
                              <p className="text-[10px] text-slate-400 truncate">{u.userEmail}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0">
                            <span className="text-xs font-mono font-bold text-amber-300 block">
                              {timeDisplay}
                            </span>
                            <span className="text-[9px] text-slate-500 font-mono truncate block max-w-[90px]" title={u.lastActivePath}>
                              {u.lastActivePath || '/'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

          {/* Top Active Pages Heatmap Right Now */}
          {topPagesRightNow.length > 0 && (
            <div className="glass-panel rounded-3xl border border-indigo-500/20 p-5 space-y-3 bg-indigo-950/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-indigo-400" />
                <span>Most Used Tabs / Pages Being Read Right Now</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {topPagesRightNow.map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-slate-900/80 border border-slate-800 hover:border-indigo-500/40 flex items-center justify-between gap-3 transition-all group shadow-md"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white group-hover:text-indigo-300 truncate">{p.title}</p>
                      <p className="text-[10px] text-slate-400 font-mono truncate">{p.path}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 text-xs font-black shrink-0">
                      {p.count} users
                    </span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* LEFT AREA: Live Candidates Grid (Spans 2 columns) */}
            <div className="lg:col-span-2 space-y-4">
              {/* Filters & Search */}
              <div className="flex items-center justify-between flex-wrap gap-4 glass-card p-4 rounded-2xl border border-slate-800">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: `All (${activeSessions.length})` },
                    { id: 'active', label: `🟢 Active (${activeSessions.filter(s => s.state === 'active').length})` },
                    { id: 'idle', label: `🟡 Idle (${activeSessions.filter(s => s.state === 'idle').length})` },
                    { id: 'background', label: `⚪ Bg (${activeSessions.filter(s => s.state === 'background').length})` },
                    { id: 'registered', label: `Users` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSessionStateFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        sessionStateFilter === f.id
                          ? 'bg-purple-600 text-white shadow-md shadow-purple-600/30'
                          : 'bg-slate-900/60 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </div>

                <div className="relative w-full sm:w-64">
                  <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-500" />
                  <input
                    type="text"
                    value={sessionSearchQuery}
                    onChange={(e) => setSessionSearchQuery(e.target.value)}
                    placeholder="Search candidate, OS, Path..."
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-950 border border-slate-800 text-xs font-medium text-white focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Grid of Active Candidate Cards */}
              <div className="glass-panel rounded-3xl border border-slate-800 p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-indigo-400 animate-[spin_4s_linear_infinite]">
                      <path d="M19.07 4.93A10 10 0 0 0 6.99 3.34" />
                      <path d="M4 6h.01" />
                      <path d="M2.29 9.62A10 10 0 1 0 21.31 8.35" />
                      <path d="M16.24 7.76A6 6 0 1 0 8.23 16.67" />
                      <path d="M12 18h.01" />
                      <path d="M17.99 11.66A6 6 0 0 1 15.77 16.67" />
                      <circle cx="12" cy="12" r="2" />
                      <path d="m13.41 10.59 5.66-5.66" />
                    </svg>
                    <span>Live Telemetry Grid</span>
                  </h4>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Real-time</span>
                </div>

                {activeSessions.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 opacity-50">
                    <div className="relative w-20 h-20 mb-4">
                      <div className="absolute inset-0 border-4 border-dashed border-slate-600 rounded-full animate-[spin_10s_linear_infinite]"></div>
                      <Globe className="absolute inset-0 m-auto w-8 h-8 text-slate-500" />
                    </div>
                    <p className="text-sm font-bold text-slate-300">Awaiting Signal...</p>
                    <p className="text-xs text-slate-500 mt-1">No active candidates connected.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {activeSessions
                      .filter((s) => {
                        const isGuest = s.userEmail.startsWith('guest_');
                        if (sessionStateFilter === 'active' && s.state !== 'active') return false;
                        if (sessionStateFilter === 'idle' && s.state !== 'idle') return false;
                        if (sessionStateFilter === 'background' && s.state !== 'background') return false;
                        if (sessionStateFilter === 'registered' && isGuest) return false;
                        if (sessionStateFilter === 'guest' && !isGuest) return false;
                        if (!sessionSearchQuery) return true;
                        const q = sessionSearchQuery.toLowerCase();
                        return (
                          s.userName.toLowerCase().includes(q) ||
                          s.userEmail.toLowerCase().includes(q) ||
                          s.currentPath.toLowerCase().includes(q) ||
                          s.pageTitle.toLowerCase().includes(q) ||
                          s.browser.toLowerCase().includes(q) ||
                          s.os.toLowerCase().includes(q)
                        );
                      })
                      .map((session) => {
                        const isGuest = session.userEmail.startsWith('guest_');

                        const stateConfig = {
                          active: {
                            borderHover: 'hover:border-emerald-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(16,185,129,0.15)]',
                            bgGlow: 'bg-emerald-500/5',
                            bgDot: 'bg-emerald-500',
                            textTime: 'text-emerald-400',
                            pingClass: 'bg-emerald-400'
                          },
                          idle: {
                            borderHover: 'hover:border-amber-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
                            bgGlow: 'bg-amber-500/5',
                            bgDot: 'bg-amber-500',
                            textTime: 'text-amber-400',
                            pingClass: 'bg-amber-400'
                          },
                          background: {
                            borderHover: 'hover:border-slate-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(100,116,139,0.15)]',
                            bgGlow: 'bg-slate-500/5',
                            bgDot: 'bg-slate-500',
                            textTime: 'text-slate-400',
                            pingClass: 'hidden'
                          },
                          focus: {
                            borderHover: 'hover:border-blue-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
                            bgGlow: 'bg-blue-500/5',
                            bgDot: 'bg-blue-500',
                            textTime: 'text-blue-400',
                            pingClass: 'bg-blue-400'
                          }
                        };
                        
                        const sConf = stateConfig[session.state] || stateConfig.active;

                        const DeviceIcon = session.deviceType === 'mobile' ? Smartphone : session.deviceType === 'tablet' ? Tablet : Laptop;
                        
                        return (
                          <div
                            key={session.id}
                            className={`relative overflow-hidden p-4 rounded-2xl bg-slate-900/60 border border-slate-800 transition-all group cursor-pointer ${sConf.borderHover} ${sConf.shadowHover}`}
                            onClick={() => setInspectingSession(session)}
                          >
                            {/* Subtle background glow based on state */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none ${sConf.bgGlow}`}></div>

                            <div className="flex items-start justify-between gap-3 relative z-10">
                              <div className="flex items-center gap-3 min-w-0">
                                <div className="relative">
                                  <UserAvatar name={session.userName} email={session.userEmail} image={session.userImage} size="md" />
                                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sConf.pingClass} opacity-75`}></span>
                                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-slate-900 ${sConf.bgDot}`}></span>
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-white truncate">{session.userName}</p>
                                  <p className="text-[10px] text-slate-400 font-medium truncate">{session.userEmail}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 bg-slate-950 rounded-lg border border-slate-800 text-[10px] font-mono text-slate-300 font-bold shrink-0">
                                {Math.floor(session.activeSeconds / 60)}m {session.activeSeconds % 60}s
                              </span>
                            </div>

                            <div className="mt-4 p-2.5 rounded-xl bg-slate-950/80 border border-slate-800/80">
                              <p className="text-[9px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                <span>Current View</span>
                                <span className={`${sConf.textTime}`}>{session.lastSeenSecondsAgo}s ago</span>
                              </p>
                              <p className="text-xs font-semibold text-slate-200 truncate">{session.pageTitle || 'Loading...'}</p>
                              <p className="text-[10px] text-indigo-400/80 font-mono truncate mt-0.5">{session.currentPath}</p>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                              <div className="flex items-center gap-2">
                                <DeviceIcon className="w-3.5 h-3.5 text-slate-400" />
                                <span>{session.os}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                <span>{session.browser}</span>
                              </div>
                              {isSuperadmin && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTerminateSession(session.sessionId); }}
                                  className="text-rose-500/50 hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors"
                                  title="Terminate Session"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                )}
              </div>
            </div>

            {/* RIGHT AREA: Global Activity Stream */}
            <div className="lg:col-span-1 space-y-4">
              <div className="glass-panel rounded-3xl border border-slate-800 p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h4 className="text-sm font-black text-white flex items-center gap-2">
                    <History className="w-4 h-4 text-purple-400" />
                    <span>Global Pulse</span>
                  </h4>
                  <span className="text-[10px] bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-md font-bold">Live Stream</span>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar h-[350px]">
                  {/* Flatten and sort all recent events from all active sessions */}
                  {(() => {
                    const allEvents = activeSessions.flatMap(s => 
                      (s.recentEvents || []).map(e => ({ ...e, user: s.userName, avatar: s.userImage, email: s.userEmail }))
                    ).sort((a, b) => b.timestamp - a.timestamp).slice(0, 50);

                    if (allEvents.length === 0) {
                      return <p className="text-xs text-slate-500 text-center py-10 font-medium">No recent activity detected.</p>;
                    }

                    return allEvents.map((evt, idx) => (
                      <div key={idx} className="flex gap-3 items-start group">
                        <div className="relative mt-1">
                          <div className="absolute top-4 left-2.5 -ml-px h-full w-0.5 bg-slate-800/50"></div>
                          <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 ${evt.type === 'navigation' ? 'bg-indigo-500' : 'bg-emerald-500'}`}>
                            {evt.type === 'navigation' ? <Globe className="w-2.5 h-2.5 text-white" /> : <Activity className="w-2.5 h-2.5 text-white" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 py-1 border-b border-slate-800/40 group-last:border-0">
                          <p className="text-[11px] font-medium text-slate-300">
                            <span className="font-bold text-white">{evt.user}</span> {evt.type === 'navigation' ? 'navigated to' : 'interacted with'} 
                            <span className="text-indigo-300 font-mono ml-1">{evt.details}</span>
                          </p>
                          <p className="text-[9px] text-slate-500 font-bold mt-0.5">
                            {new Date(evt.timestamp).toLocaleTimeString()}
                          </p>
                        </div>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            </div>
          </div>

          {/* Session Telemetry & Audit Log Inspection Modal */}
          {inspectingSession && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in">
              <div className="glass-panel w-full max-w-3xl rounded-3xl p-0 border border-slate-700/80 overflow-hidden shadow-2xl relative bg-slate-950/90">
                {/* Modal Header */}
                <div className="p-6 border-b border-slate-800 bg-gradient-to-r from-indigo-900/40 to-transparent flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <UserAvatar name={inspectingSession.userName} email={inspectingSession.userEmail} image={inspectingSession.userImage} size="lg" />
                    <div>
                      <h3 className="text-lg font-black text-white">{inspectingSession.userName}</h3>
                      <p className="text-xs text-indigo-300 font-medium">{inspectingSession.userEmail}</p>
                    </div>
                  </div>
                  <button onClick={() => setInspectingSession(null)} className="p-2 bg-slate-900 rounded-full text-slate-400 hover:text-white hover:bg-slate-800 transition-colors border border-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Device & Connection specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Platform</span>
                      <span className="font-bold text-slate-200 text-sm flex items-center gap-1.5">
                        <Laptop className="w-4 h-4 text-indigo-400" /> {inspectingSession.os}
                      </span>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Browser</span>
                      <span className="font-bold text-slate-200 text-sm">{inspectingSession.browser}</span>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Network</span>
                      <span className="font-bold text-emerald-400 uppercase text-sm">{inspectingSession.networkType}</span>
                    </div>
                    <div className="bg-slate-900/60 p-4 rounded-2xl border border-slate-800">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Active Duration</span>
                      <span className="font-bold text-amber-400 text-sm">{Math.floor(inspectingSession.activeSeconds / 60)}m {inspectingSession.activeSeconds % 60}s</span>
                    </div>
                  </div>

                  {/* Session Route & Event Chronological Audit Trail */}
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider">
                      Full Session Audit Trail ({inspectingSession.recentEvents?.length || 0} events)
                    </h4>
                    <div className="max-h-72 overflow-y-auto p-4 rounded-2xl bg-slate-950/80 border border-slate-800 font-mono text-xs custom-scrollbar space-y-1">
                      {!inspectingSession.recentEvents || inspectingSession.recentEvents.length === 0 ? (
                        <p className="text-slate-500 text-center py-8">No navigation events logged for this session yet.</p>
                      ) : (
                        inspectingSession.recentEvents.map((evt, idx) => (
                          <div key={idx} className="flex items-center justify-between border-b border-slate-800/40 pb-2 mb-2 last:border-0 last:mb-0 last:pb-0 text-[11px] hover:bg-slate-900/50 p-1.5 rounded-md transition-colors">
                            <div className="flex items-center gap-2.5 truncate">
                              <span className={`w-2 h-2 rounded-full ${evt.type === 'navigation' ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
                              <span className="text-slate-300 font-bold">{evt.type.toUpperCase()}</span>
                              <span className="text-slate-400">-</span>
                              <span className="text-indigo-200">{evt.details}</span>
                            </div>
                            <span className="text-slate-500 font-bold shrink-0 ml-4">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-slate-900/50 border-t border-slate-800 flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-mono font-bold">
                    ID: {inspectingSession.sessionId}
                  </div>
                  {isSuperadmin && (
                    <button
                      onClick={() => { handleTerminateSession(inspectingSession.sessionId); setInspectingSession(null); }}
                      className="px-5 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-400 text-xs font-bold border border-rose-500/20 transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Terminate User Session</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: REDEEM CODES */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          {/* Generator Form */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Key className="w-5 h-5 text-indigo-400" />
              <span>Redeem Code Generator</span>
            </h2>

            <form onSubmit={handleGenerateCodes} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Prefix</label>
                <input
                  type="text"
                  value={codePrefix}
                  onChange={(e) => setCodePrefix(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-mono font-bold text-white uppercase"
                  placeholder="PREPTEA"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Quantity (Max 100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={codeCount}
                  onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Duration (Days)</label>
                <select
                  value={codeDuration}
                  onChange={(e) => setCodeDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                >
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                  <option value={3650}>Lifetime Access</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Batch / Purpose</label>
                <input
                  type="text"
                  value={codeBatchName}
                  onChange={(e) => setCodeBatchName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                  placeholder="Batch Access"
                />
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={generatingCodes}
                  className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{generatingCodes ? 'Generating...' : 'Generate Codes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Codes Data Table */}
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-4">
            <div className="p-4 sm:p-6 border-b border-slate-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-white">Generated Redeem Codes ({codes.length})</h3>
                <p className="text-xs text-slate-400">Copy code strings or export batch to CSV.</p>
              </div>

              {codes.length > 0 && (
                <button
                  onClick={downloadCodesCSV}
                  className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Export to CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-center">Uses</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {codes.map((c) => (
                    <tr key={c.id} className="hover:bg-slate-900/40 text-slate-200 transition-colors">
                      <td className="py-3 px-4 font-mono font-bold text-amber-300">
                        {c.code}
                      </td>
                      <td className="py-3 px-4 text-slate-300 font-medium">
                        {c.batchName}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {c.durationDays >= 3650 ? 'Lifetime' : `${c.durationDays} days`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-indigo-400">{c.usedCount}</span> / {c.maxUses}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.usedCount >= c.maxUses ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-slate-400 border border-slate-700">
                            Redeemed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <button
                          onClick={() => copyToClipboard(c.code, c.id)}
                          className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 hover:text-white font-bold text-[11px] inline-flex items-center gap-1 transition-colors"
                        >
                          {copiedCodeId === c.id ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400">Copied!</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>Copy</span>
                            </>
                          )}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: LAUNCH EVENTS */}
      {activeTab === 'events' && (
        <div className="space-y-6">
          {/* Create Launch Event Form */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
              <Rocket className="w-5 h-5 text-amber-400" />
              <span>Launch Event Creator (&quot;First N Members Get Free Premium&quot;)</span>
            </h2>

            <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Event Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                  placeholder="e.g. Next 100 New Users Get Yearly Pro"
                  required
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Max Users Claim</label>
                <input
                  type="number"
                  min="1"
                  value={eventMaxClaims}
                  onChange={(e) => setEventMaxClaims(parseInt(e.target.value) || 100)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-400 mb-1">Duration (Days)</label>
                <select
                  value={eventDuration}
                  onChange={(e) => setEventDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                >
                  <option value={30}>30 Days</option>
                  <option value={90}>90 Days</option>
                  <option value={365}>365 Days (1 Year)</option>
                  <option value={3650}>Lifetime</option>
                </select>
              </div>

              <div className="sm:col-span-2 md:col-span-4 flex justify-end">
                <button
                  type="submit"
                  disabled={creatingEvent || !eventTitle.trim()}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-500 hover:from-amber-400 hover:to-yellow-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                >
                  <Rocket className="w-4 h-4" />
                  <span>{creatingEvent ? 'Creating Event...' : 'Launch Event'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Active Launch Events Grid */}
          <div className="space-y-4">
            <h3 className="text-base font-bold text-white">Active Launch Campaigns ({events.length})</h3>

            {events.length === 0 ? (
              <div className="p-8 text-center glass-panel rounded-3xl space-y-2">
                <p className="text-xs text-slate-400">No active launch campaigns created yet.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {events.map((ev) => {
                  const percent = Math.min(Math.round((ev.claimedCount / ev.maxClaimCount) * 100), 100);
                  return (
                    <div key={ev.id} className="glass-card rounded-3xl p-6 border border-slate-800 space-y-4 relative overflow-hidden">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-base font-bold text-white">{ev.title}</h4>
                          <p className="text-xs text-slate-400">
                            Duration: {ev.durationDays >= 3650 ? 'Lifetime' : `${ev.durationDays} Days`}
                          </p>
                        </div>

                        <button
                          onClick={() => handleToggleEvent(ev.id)}
                          className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                            ev.isActive
                              ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                              : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                          }`}
                        >
                          {ev.isActive ? 'Active' : 'Paused'}
                        </button>
                      </div>

                      {/* Progress Bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-xs font-semibold">
                          <span className="text-slate-300">Claims Progress</span>
                          <span className="text-amber-400">{ev.claimedCount} / {ev.maxClaimCount} ({percent}%)</span>
                        </div>
                        <div className="w-full h-3 rounded-full bg-slate-900 overflow-hidden border border-slate-800">
                          <div
                            className="h-full bg-gradient-to-r from-amber-500 to-yellow-400 transition-all duration-500"
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                      </div>

                      <div className="text-[11px] text-slate-500 pt-2 border-t border-slate-800/80 flex items-center justify-between">
                        <span>Created by: {ev.createdBy}</span>
                        <span>{ev.claimedUsers.length} Users Claimed</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: BULK CSV / EMAILS */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          {/* CSV File Upload & Textarea Panel */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-slate-800 space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-400" />
                <span>Bulk Email Access Granting & CSV / Excel Upload</span>
              </h2>
              <p className="text-xs text-slate-400 mt-1">
                Upload a `.csv` file or paste emails. Granted emails get premium activated automatically on sign-in without requiring a code.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Option: File Upload */}
              <div className="glass-card rounded-2xl p-6 border-2 border-dashed border-indigo-500/30 text-center space-y-4 flex flex-col justify-center items-center">
                <div className="w-12 h-12 rounded-2xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-white">Upload CSV or Excel File</h4>
                  <p className="text-xs text-slate-400 mt-1">Select a `.csv` or `.txt` file containing candidate email addresses.</p>
                </div>

                <input
                  type="file"
                  accept=".csv,.txt"
                  ref={fileInputRef}
                  onChange={handleFileUpload}
                  className="hidden"
                />

                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={grantingEmails}
                  className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-lg shadow-indigo-600/20 transition-all flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose File & Grant</span>
                </button>
              </div>

              {/* Right Option: Textarea Input */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Or Paste Emails (Comma or Newline Separated)
                </label>
                <textarea
                  rows={4}
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="student1@gmail.com, student2@gmail.com&#10;student3@gmail.com"
                  className="w-full p-3 rounded-2xl bg-slate-900 border border-slate-800 text-xs font-mono text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />

                <div className="flex items-center justify-between gap-3">
                  <select
                    value={bulkDuration}
                    onChange={(e) => setBulkDuration(parseInt(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs font-bold text-white"
                  >
                    <option value={30}>30 Days</option>
                    <option value={90}>90 Days</option>
                    <option value={365}>365 Days (1 Year)</option>
                    <option value={3650}>Lifetime Pass</option>
                  </select>

                  <button
                    type="button"
                    onClick={() => {
                      const parsed = emailText
                        .split(/[\r\n,;]+/)
                        .map((e) => e.trim())
                        .filter((e) => e.includes('@'));
                      handleGrantEmails(parsed);
                    }}
                    disabled={grantingEmails || !emailText.trim()}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-600/20 disabled:opacity-50 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{grantingEmails ? 'Processing...' : 'Grant Access'}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* PreApproved Emails List */}
          <div className="glass-panel rounded-3xl border border-slate-800 overflow-hidden space-y-4">
            <div className="p-4 sm:p-6 border-b border-slate-800">
              <h3 className="text-base font-bold text-white">Pre-Approved / Granted Email List ({emails.length})</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-center">Activation Status</th>
                    <th className="py-3 px-4 text-right">Granted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {emails.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40 text-slate-200 transition-colors">
                      <td className="py-3 px-4 font-bold text-white">{m.email}</td>
                      <td className="py-3 px-4 text-center font-semibold">
                        {m.durationDays >= 3650 ? 'Lifetime' : `${m.durationDays} Days`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.isActivated ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                            Active User
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                            Pending Sign-In
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-slate-400">{m.addedBy}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 5: USER ROLES & PERMISSIONS */}
      {activeTab === 'users' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-white flex items-center gap-2">
                  <Users className="w-5 h-5 text-purple-400" />
                  <span>User & Administrator Management</span>
                </h2>
                <p className="text-xs text-slate-400 mt-1">Assign admin roles, permissions, and direct premium status.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-slate-900 border border-slate-800 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-900/80 text-slate-400 uppercase text-[11px] font-semibold border-b border-slate-800">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-4 text-center">Admin Rights</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isSuper = u.email.toLowerCase() === 'fykartik@gmail.com';
                    const permCount = u.adminPermissions ? u.adminPermissions.length : 0;

                    return (
                      <tr key={u.id} className="hover:bg-slate-900/40 text-slate-200 transition-colors">
                        <td className="py-3 px-4 flex items-center gap-3">
                          <UserAvatar name={u.name} email={u.email} image={u.image} size="sm" />
                          <div>
                            <p className="font-bold text-white">{u.name}</p>
                            <p className="text-[10px] text-slate-400">{u.email}</p>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isSuper ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-gradient-to-r from-amber-500 to-yellow-500 text-black">
                              Super Admin
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUser(u.email, e.target.value, u.isPremium, u.adminPermissions)}
                              disabled={!isSuperadmin}
                              className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-700 text-xs font-bold text-slate-200"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isSuper ? (
                            <span className="text-[11px] font-bold text-amber-400">Full Permanent Rights</span>
                          ) : (
                            <button
                              onClick={() => openPermissionModal(u)}
                              disabled={!isSuperadmin}
                              className="px-2.5 py-1 rounded-xl bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-purple-400" />
                              <span>{permCount} active</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 text-right">
                          {!isSuper && (
                            <div className="flex items-center justify-end gap-2">
  

                              <button
                                onClick={() => handleUpdateUser(u.email, u.role, !u.isPremium, u.adminPermissions)}
                                className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                  u.isPremium
                                    ? 'bg-rose-950/40 text-rose-300 border border-rose-500/30 hover:bg-rose-900/60'
                                    : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                                }`}
                              >
                                {u.isPremium ? 'Revoke Premium' : 'Grant Premium'}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Admin Permission Management Modal */}
          {editingUserForPerms && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fade-in">
              <div className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-purple-500/30 shadow-2xl space-y-5 bg-slate-900/95">
                <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-purple-400" />
                    <div>
                      <h3 className="text-base font-bold text-white">Configure Admin Rights</h3>
                      <p className="text-xs text-slate-400">{editingUserForPerms.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingUserForPerms(null)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPerms(ALL_ADMIN_PERMISSIONS.map((p) => p.id))}
                    className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-300 border border-purple-500/30 text-[11px] font-bold hover:bg-purple-500/30 transition-all"
                  >
                    Grant All Rights
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPerms(['manage_codes', 'manage_events', 'manage_emails'])}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700 text-[11px] font-bold hover:bg-slate-700 transition-all"
                  >
                    Promos Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPerms([])}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-300 border border-rose-500/20 text-[11px] font-bold hover:bg-rose-500/20 transition-all"
                  >
                    Clear All
                  </button>
                </div>

                {/* Checkbox Options */}
                <div className="space-y-2.5 max-h-72 overflow-y-auto pr-1">
                  {ALL_ADMIN_PERMISSIONS.map((perm) => {
                    const Icon = perm.icon;
                    const isChecked = selectedPerms.includes(perm.id);
                    return (
                      <div
                        key={perm.id}
                        onClick={() => {
                          setSelectedPerms((prev) =>
                            prev.includes(perm.id) ? prev.filter((id) => id !== perm.id) : [...prev, perm.id]
                          );
                        }}
                        className={`flex items-start gap-3 p-3 rounded-2xl border cursor-pointer transition-all ${
                          isChecked
                            ? 'bg-purple-950/40 border-purple-500/40 text-white'
                            : 'bg-slate-900/60 border-slate-800 text-slate-400 hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 w-4 h-4 rounded text-purple-600 focus:ring-purple-500 bg-slate-900 border-slate-700"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-purple-400" />
                            <span>{perm.label}</span>
                          </p>
                          <p className="text-[11px] text-slate-400 mt-0.5">{perm.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-800">
                  <button
                    type="button"
                    onClick={() => setEditingUserForPerms(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-lg shadow-purple-600/30 transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Save Admin Permissions</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
}
