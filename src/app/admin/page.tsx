'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { useAuth } from '@/lib/authContext';
import { UserAvatar } from '@/components/UserAvatar';
import { GoogleLoginButton } from '@/components/GoogleLoginButton';
import { ReportListClient } from '@/components/admin/ReportListClient';
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
  History,
  ShieldAlert,
  Loader2,
} from 'lucide-react';
import { AdminSkeleton } from '@/components/skeletons/AdminSkeleton';
import { isCourseBatch } from '@/lib/batchAccess';

interface SessionEventItem {
  timestamp: number;
  type: 'navigation' | 'state_change' | 'interaction';
  details: string;
}

function formatTimeAgo(secondsAgo: number | null): string {
  if (secondsAgo === null || isNaN(secondsAgo)) return '—';
  if (secondsAgo < 60) return `${secondsAgo}s ago`;
  const minutes = Math.floor(secondsAgo / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  const years = Math.floor(days / 365);
  return `${years}y ago`;
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
  ipAddress?: string;
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

import { AVAILABLE_BATCH_OPTIONS } from '@/lib/batchAccess';

interface AdminUserItem {
  id: string;
  name: string;
  email: string;
  image?: string;
  role: 'superadmin' | 'admin' | 'user';
  adminPermissions: string[];
  allowedBatches?: string[];
  isPremium: boolean;
  premiumExpiresAt: string | null;
  premiumPlan: string;
  totalScore: number;
  testsCompleted: number;
  createdAt: string;
}

export default function AdminDashboardPage() {
  const { user: authUser, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<'overview' | 'codes' | 'emails' | 'users' | 'active-sessions' | 'all-sessions' | 'reports'>('overview');

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [codes, setCodes] = useState<RedeemCodeItem[]>([]);
  const [events, setEvents] = useState<LaunchEventItem[]>([]);
  const [emails, setEmails] = useState<PreapprovedEmailItem[]>([]);
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [reports, setReports] = useState<any[]>([]);

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

  // All Sessions Log state
  const [allSessionsList, setAllSessionsList] = useState<any[]>([]);
  const [allSessionsStats, setAllSessionsStats] = useState<{ total: number; active: number; offline: number; terminated: number } | null>(null);
  const [allSessionsTabState, setAllSessionsTabState] = useState<'all' | 'active' | 'offline' | 'terminated'>('all');
  const [allSessionsQuery, setAllSessionsQuery] = useState('');
  const [allSessionsLoading, setAllSessionsLoading] = useState(false);

  const loadedTabs = useRef<Set<string>>(new Set());
  const tabLastFetched = useRef<Record<string, number>>({});

  const [loading, setLoading] = useState(true);
  const [feedbackMsg, setFeedbackMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Code Generator Form
  const [codePrefix, setCodePrefix] = useState('PREPTEA');
  const [codeCount, setCodeCount] = useState(10);
  const [codeDuration, setCodeDuration] = useState(365);
  const [codeMaxUses, setCodeMaxUses] = useState(1);
  const [codeBatchName, setCodeBatchName] = useState('SigmaX');
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

  // Auto Demo Settings
  const [autoDemoEnabled, setAutoDemoEnabled] = useState<boolean>(false);
  const [autoDemoDuration, setAutoDemoDuration] = useState<number>(15);
  const [updatingAutoDemo, setUpdatingAutoDemo] = useState<boolean>(false);

  // User Search & Code Copy
  const [userQuery, setUserQuery] = useState('');
  const [copiedCodeId, setCopiedCodeId] = useState('');

  const isSuperadmin = authUser?.role === 'superadmin';
  const isAdmin = isSuperadmin || authUser?.role === 'admin';

  const userPerms = useMemo(() => {
    if (isSuperadmin) {
      return ['manage_codes', 'manage_events', 'manage_emails', 'manage_users', 'manage_global_free', 'access_courses', '*'];
    }
    return authUser?.adminPermissions || [];
  }, [isSuperadmin, authUser?.adminPermissions]);

  const canManageCodes = userPerms.includes('manage_codes') || userPerms.includes('*');
  const canManageEvents = userPerms.includes('manage_events') || userPerms.includes('*');
  const canManageEmails = userPerms.includes('manage_emails') || userPerms.includes('*');
  const canManageUsers = userPerms.includes('manage_users') || userPerms.includes('*');
  const canManageGlobalFree = userPerms.includes('manage_global_free') || userPerms.includes('*');

  // Load Tab Data
  useEffect(() => {
    if (!authUser || !isAdmin) {
      setLoading(false);
      return;
    }

    const hasLoaded = loadedTabs.current.has(activeTab);
    const lastFetch = tabLastFetched.current[activeTab] || 0;
    const isFresh = Date.now() - lastFetch < 60000;

    // If already loaded and fresh (<60s), switch tab instantly without skeleton or network hit
    if (hasLoaded && isFresh) {
      setLoading(false);
      return;
    }

    async function loadAdminData() {
      try {
        if (!hasLoaded) {
          setLoading(true);
        }
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

          const autoDemoRes = await fetch('/api/admin/auto-demo');
          const autoDemoJson = await autoDemoRes.json();
          if (autoDemoJson.success) {
            setAutoDemoEnabled(!!autoDemoJson.autoDemoEnabled);
            setAutoDemoDuration(autoDemoJson.autoDemoDurationMinutes || 15);
          }

          const eventRes = await fetch('/api/admin/events');
          const eventJson = await eventRes.json();
          if (eventJson.success) setEvents(eventJson.events);
        } else if (activeTab === 'codes') {
          const res = await fetch('/api/admin/codes');
          const json = await res.json();
          if (json.success) setCodes(json.codes);
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
        } else if (activeTab === 'all-sessions') {
          await fetchAllSessions();
        } else if (activeTab === 'reports') {
          const res = await fetch('/api/admin/reports');
          const json = await res.json();
          if (json.success) setReports(json.reports);
        }

        loadedTabs.current.add(activeTab);
        tabLastFetched.current[activeTab] = Date.now();
      } catch (err) {
        console.error('Failed to load admin tab data:', err);
      } finally {
        setLoading(false);
      }
    }

    loadAdminData();
  }, [authUser?.email, isAdmin, activeTab]);

  const fetchAllSessions = async (query = allSessionsQuery, status = allSessionsTabState) => {
    try {
      setAllSessionsLoading(true);
      const params = new URLSearchParams();
      if (query) params.set('email', query);
      if (status !== 'all') params.set('status', status);
      params.set('limit', '300');

      const res = await fetch(`/api/admin/all-sessions?${params.toString()}`);
      const json = await res.json();
      if (json.success) {
        setAllSessionsList(json.sessions);
        setAllSessionsStats(json.stats);
      }
    } catch (err) {
      console.error('Failed to fetch all user sessions:', err);
    } finally {
      setAllSessionsLoading(false);
    }
  };

  const handleTerminateAllSessionsForEmail = async (userEmail: string) => {
    if (!confirm(`Are you sure you want to terminate ALL active sessions for ${userEmail}?`)) return;
    try {
      const res = await fetch('/api/admin/active-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate_all', targetUserEmail: userEmail }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(`Terminated all sessions for ${userEmail}`);
        fetchAllSessions();
        setActiveSessions((prev) => prev.filter((s) => s.userEmail.toLowerCase() !== userEmail.toLowerCase()));
      } else {
        setErrorMsg(json.error || 'Failed to terminate sessions');
      }
    } catch (err) {
      setErrorMsg('Failed to terminate sessions');
    }
  };

  const handleTerminateSystemWideSessions = async () => {
    if (!confirm('⚠️ SYSTEM WARNING: Are you sure you want to TERMINATE ALL active sessions across ALL user accounts in the entire system? Everyone will be forced to log in again.')) return;
    try {
      const res = await fetch('/api/admin/active-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate_entire_system' }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(`Successfully terminated all ${json.count || 0} active sessions across the entire system.`);
        fetchAllSessions();
        setActiveSessions([]);
      } else {
        setErrorMsg(json.error || 'Failed to terminate system sessions');
      }
    } catch (err) {
      setErrorMsg('Failed to terminate system sessions');
    }
  };

  // Auto-refresh active sessions every 15 seconds when activeTab === 'active-sessions' (paused when tab hidden)
  useEffect(() => {
    if (activeTab !== 'active-sessions' || !authUser || !isAdmin) return;

    const interval = setInterval(async () => {
      if (typeof document !== 'undefined' && document.hidden) return;
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
    }, 45000);

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
        if (inspectingUserEmail) {
          openCandidateInspector(inspectingUserEmail);
        }
      } else {
        setErrorMsg(json.error || 'Failed to terminate session');
      }
    } catch {
      setErrorMsg('Error terminating session');
    }
  };

  const handleTerminateAllUserSessions = async (email: string) => {
    try {
      const res = await fetch('/api/admin/active-sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'terminate_all', targetUserEmail: email }),
      });
      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message || `Terminated all sessions for ${email}`);
        setActiveSessions((prev) => prev.filter((s) => s.userEmail.toLowerCase() !== email.toLowerCase()));
        if (inspectingSession?.userEmail.toLowerCase() === email.toLowerCase()) setInspectingSession(null);
        openCandidateInspector(email);
      } else {
        setErrorMsg(json.error || 'Failed to terminate user sessions');
      }
    } catch {
      setErrorMsg('Error terminating user sessions');
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

  // Update Auto Demo Settings for New Users
  const handleSaveAutoDemo = async (enabled: boolean, minutesToSet: number) => {
    try {
      setUpdatingAutoDemo(true);
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/auto-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ autoDemoEnabled: enabled, autoDemoDurationMinutes: minutesToSet }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        setAutoDemoEnabled(!!json.autoDemoEnabled);
        setAutoDemoDuration(json.autoDemoDurationMinutes || 15);
      } else {
        setErrorMsg(json.error || 'Failed to update auto-demo settings');
      }
    } catch {
      setErrorMsg('Error updating auto-demo settings');
    } finally {
      setUpdatingAutoDemo(false);
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

  const [editingUserForBatches, setEditingUserForBatches] = useState<AdminUserItem | null>(null);
  const [selectedUserBatches, setSelectedUserBatches] = useState<string[]>([]);

  // Candidate 360° Inspector Modal state
  const [inspectingUserEmail, setInspectingUserEmail] = useState<string | null>(null);
  const [inspectData, setInspectData] = useState<any | null>(null);
  const [loadingInspectData, setLoadingInspectData] = useState(false);
  const [inspectActiveTab, setInspectActiveTab] = useState<'overview' | 'activity' | 'attempts' | 'promos' | 'raw_json'>('overview');

  // ESC key listener to close active popups / modals
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inspectingUserEmail) {
          setInspectingUserEmail(null);
          setInspectData(null);
        } else if (inspectingSession) {
          setInspectingSession(null);
        } else if (editingUserForPerms) {
          setEditingUserForPerms(null);
        } else if (editingUserForBatches) {
          setEditingUserForBatches(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [inspectingUserEmail, inspectingSession, editingUserForPerms, editingUserForBatches]);

  const openCandidateInspector = async (email: string) => {
    setInspectingUserEmail(email);
    setLoadingInspectData(true);
    setInspectData(null);
    setInspectActiveTab('overview');

    try {
      const res = await fetch(`/api/admin/user-details?email=${encodeURIComponent(email)}`);
      const json = await res.json();
      if (json.success) {
        setInspectData(json);
      }
    } catch {
      // ignore
    } finally {
      setLoadingInspectData(false);
    }
  };

  const formatInspectDuration = (seconds?: number) => {
    if (!seconds) return '0m 0s';
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m ${secs}s`;
  };

  // User Role & Permissions Submit
  const handleUpdateUser = async (targetEmail: string, role: string, isPremium: boolean, adminPermissions?: string[], allowedBatches?: string[]) => {
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
          adminPermissions: adminPermissions ?? [],
          allowedBatches: allowedBatches ?? [],
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

  const handleGrantDemo = async (targetEmail: string, durationMinutes: number) => {
    try {
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'grant_demo',
          targetEmail,
          demoDurationMinutes: durationMinutes,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        const userRes = await fetch('/api/admin/users');
        const userJson = await userRes.json();
        if (userJson.success) setUsers(userJson.users);
      } else {
        setErrorMsg(json.error || 'Failed to grant demo');
      }
    } catch {
      setErrorMsg('Error granting demo');
    }
  };

  const handleDeleteUser = async (targetEmail: string) => {
    if (!targetEmail) return;
    const confirmed = window.confirm(
      `⚠️ PERMANENT USER PURGE & DELETION\n\nAre you sure you want to permanently delete "${targetEmail}"?\n\nThis will completely delete:\n• All user profile & account data\n• All practice tests, answers & leaderboard scores\n• All active sessions & daily activity logs\n• All preapproved & premium access rights\n\nIf the user logs in again, they will start as a brand new account from scratch.`
    );
    if (!confirmed) return;

    try {
      setErrorMsg('');
      setFeedbackMsg('');

      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete_user',
          targetEmail,
        }),
      });

      const json = await res.json();
      if (json.success) {
        setFeedbackMsg(json.message);
        const userRes = await fetch('/api/admin/users');
        const userJson = await userRes.json();
        if (userJson.success) setUsers(userJson.users);

        if (inspectingUserEmail?.toLowerCase() === targetEmail.toLowerCase()) {
          setInspectingUserEmail(null);
          setInspectData(null);
        }
      } else {
        setErrorMsg(json.error || 'Failed to delete user');
      }
    } catch {
      setErrorMsg('Error deleting user');
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
    await handleUpdateUser(editingUserForPerms.email, editingUserForPerms.role, editingUserForPerms.isPremium, selectedPerms, editingUserForPerms.allowedBatches);
    setEditingUserForPerms(null);
  };

  const openBatchesModal = (u: AdminUserItem) => {
    setEditingUserForBatches(u);
    setSelectedUserBatches(u.allowedBatches || []);
  };

  const handleSaveUserBatches = async () => {
    if (!editingUserForBatches) return;
    const hasCourseBatches = selectedUserBatches.some((b: string) => isCourseBatch(b));
    // If admin grants any course batch to a user, automatically grant them premium (isPremium: true)
    const nextIsPremium = hasCourseBatches ? true : editingUserForBatches.isPremium;
    await handleUpdateUser(
      editingUserForBatches.email,
      editingUserForBatches.role,
      nextIsPremium,
      editingUserForBatches.adminPermissions,
      selectedUserBatches
    );
    setEditingUserForBatches(null);
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
    return null;
  }

  // 404 Authorization Guard: Unauthorized access throws 404 Not Found
  if (!authUser || !isAdmin) {
    notFound();
  }

  if (loading && !stats) {
    return <AdminSkeleton />;
  }

  const filteredUsers = users.filter(
    (u) =>
      u.name.toLowerCase().includes(userQuery.toLowerCase()) ||
      u.email.toLowerCase().includes(userQuery.toLowerCase())
  );

  return (
    <main className="w-full px-4 sm:px-8 lg:px-12 py-6 space-y-8" role="main">

      {/* Global Notifications / Alerts */}
      {feedbackMsg && (
        <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-500/40 text-emerald-200 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
            <span>{feedbackMsg}</span>
          </div>
          <button onClick={() => setFeedbackMsg('')} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="p-4 rounded-2xl bg-rose-950/60 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center justify-between shadow-lg">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
            <span>{errorMsg}</span>
          </div>
          <button onClick={() => setErrorMsg('')} className="text-muted-foreground hover:text-foreground">
            ✕
          </button>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto no-scrollbar p-1.5 glass-panel rounded-2xl border border-card-border">
        {[
          { id: 'overview', label: 'Overview', icon: BarChart3, allowed: true },
          { id: 'active-sessions', label: 'Live Monitor 🟢', icon: Activity, allowed: canManageUsers },
          { id: 'all-sessions', label: 'All Sessions Log 🌐', icon: Globe, allowed: canManageUsers },
          { id: 'codes', label: 'Redeem Codes', icon: Key, allowed: canManageCodes },
          { id: 'emails', label: 'Bulk CSV / Emails', icon: Mail, allowed: canManageEmails },
          { id: 'users', label: 'User Roles & Perms', icon: Users, allowed: canManageUsers },
          { id: 'reports', label: 'Reports', icon: ShieldAlert, allowed: canManageUsers },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          const isAllowed = tab.allowed;

          return (
            <button
              key={tab.id}
              onClick={() => {
                if (!isAllowed) {
                  setErrorMsg(`Access Restricted: You do not have permission to access ${tab.label}`);
                  return;
                }
                setActiveTab(tab.id as any);
                setFeedbackMsg('');
                setErrorMsg('');
              }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                isActive
                  ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/20'
                  : isAllowed
                  ? 'text-muted-foreground hover:text-foreground hover:bg-slate-800/60'
                  : 'text-slate-600 opacity-50 cursor-not-allowed'
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
            <div className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Total Registered Candidates</span>
              <p className="text-2xl font-black text-foreground">{stats?.totalUsers ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Active Premium Members</span>
              <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400">{stats?.premiumUsers ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Generated Redeem Codes</span>
              <p className="text-2xl font-black text-primary-600 dark:text-primary-400">{stats?.totalCodes ?? '-'}</p>
            </div>

            <div className="glass-card rounded-2xl p-5 border border-card-border space-y-2">
              <span className="text-xs text-muted-foreground font-medium">Active Launch Promos</span>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{stats?.activeEventsCount ?? '-'}</p>
            </div>
          </div>

          {/* Global Platform-Wide Free Access Feature Card */}
          <div className="glass-panel rounded-3xl p-6 border border-primary-500/30 space-y-4 bg-card shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-amber-600 dark:text-amber-400 animate-pulse" />
                  <h3 className="text-base font-bold text-foreground">Make Platform Free For Everyone</h3>
                </div>
                <p className="text-xs text-foreground/80">
                  Instantly unlock all premium practice tests and solutions for all candidates on the platform for X days.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {isGlobalFreeActive ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-emerald-500/20 border border-emerald-500/40 text-emerald-600 dark:text-emerald-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-emerald-950/50">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                    <span>Free for everyone until {globalFreeUntilDate}</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Normal Access Rules Active</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
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
                          ? 'bg-primary-600 text-white border-primary-400 shadow-md shadow-primary-950/50'
                          : 'bg-card/90 text-foreground/80 border-card-border hover:bg-slate-800'
                      }`}
                    >
                      {d} {d === 1 ? 'Day' : 'Days'}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-muted-foreground font-semibold">Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="365"
                      value={globalFreeDays}
                      onChange={(e) => setGlobalFreeDaysInput(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-12 bg-transparent text-foreground font-bold outline-none text-center no-spin"
                    />
                    <span className="text-muted-foreground font-semibold">Days</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={updatingGlobalFree || !canManageGlobalFree}
                  onClick={() => handleSetGlobalFree(globalFreeDays)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-lg shadow-emerald-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  title={!canManageGlobalFree ? 'Permission required: manage_global_free' : ''}
                >
                  <Sparkles className="w-4 h-4 text-yellow-300" />
                  <span>{updatingGlobalFree ? 'Updating...' : `Make Platform Free (${globalFreeDays} Days)`}</span>
                </button>

                {isGlobalFreeActive && (
                  <button
                    type="button"
                    disabled={updatingGlobalFree || !canManageGlobalFree}
                    onClick={() => handleSetGlobalFree(0)}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canManageGlobalFree ? 'Permission required: manage_global_free' : 'Revert platform back to normal access rules'}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Auto-Grant Demo Access to New Users Feature Card */}
          <div className="glass-panel rounded-3xl p-6 border border-violet-500/30 space-y-4 bg-card shadow-xl">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-card-border">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-violet-500 animate-pulse" />
                  <h3 className="text-base font-bold text-foreground">Auto-Grant Demo to New Emails</h3>
                </div>
                <p className="text-xs text-foreground/80">
                  Automatically give demo access & unlock course options for candidate emails who have never had premium/demo in the past when they log in or come online.
                </p>
              </div>

              {/* Status Badge */}
              <div className="shrink-0">
                {autoDemoEnabled ? (
                  <div className="px-3.5 py-1.5 rounded-xl bg-violet-500/20 border border-violet-500/40 text-violet-600 dark:text-violet-300 text-xs font-bold flex items-center gap-1.5 shadow-lg shadow-violet-950/50">
                    <span className="w-2 h-2 rounded-full bg-violet-400 animate-ping" />
                    <span>Auto Demo ACTIVE ({autoDemoDuration} mins)</span>
                  </div>
                ) : (
                  <div className="px-3.5 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700 text-muted-foreground text-xs font-semibold flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                    <span>Auto Demo Disabled</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end pt-1">
              <div className="space-y-2 md:col-span-2">
                <label className="text-xs font-semibold text-foreground/80 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-violet-500" />
                  <span>Choose Demo Duration (Minutes)</span>
                </label>

                <div className="flex flex-wrap items-center gap-2">
                  {[15, 30, 60, 120, 1440].map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setAutoDemoDuration(m)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all border ${
                        autoDemoDuration === m
                          ? 'bg-violet-600 text-white border-violet-400 shadow-md shadow-violet-950/50'
                          : 'bg-card/90 text-foreground/80 border-card-border hover:bg-slate-800'
                      }`}
                    >
                      {m >= 1440 ? `${Math.floor(m / 1440)} Day` : m >= 60 ? `${Math.floor(m / 60)} hr` : `${m} mins`}
                    </button>
                  ))}

                  <div className="flex items-center gap-1.5 bg-card border border-card-border rounded-xl px-2.5 py-1 text-xs">
                    <span className="text-muted-foreground font-semibold">Custom:</span>
                    <input
                      type="number"
                      min="1"
                      max="525600"
                      value={autoDemoDuration}
                      onChange={(e) => setAutoDemoDuration(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-16 bg-transparent text-foreground font-bold outline-none text-center no-spin"
                    />
                    <span className="text-muted-foreground font-semibold">Mins</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={updatingAutoDemo || !canManageGlobalFree}
                  onClick={() => handleSaveAutoDemo(true, autoDemoDuration)}
                  className="flex-1 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white font-bold text-xs shadow-lg shadow-violet-950/40 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                  title={!canManageGlobalFree ? 'Permission required: manage_global_free' : ''}
                >
                  <BookOpen className="w-4 h-4 text-violet-200" />
                  <span>{updatingAutoDemo ? 'Updating...' : `Enable Auto Demo (${autoDemoDuration} Mins)`}</span>
                </button>

                {autoDemoEnabled && (
                  <button
                    type="button"
                    disabled={updatingAutoDemo || !canManageGlobalFree}
                    onClick={() => handleSaveAutoDemo(false, autoDemoDuration)}
                    className="px-3 py-2.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/30 text-rose-600 dark:text-rose-300 font-bold text-xs transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!canManageGlobalFree ? 'Permission required: manage_global_free' : 'Disable auto-grant demo for new users'}
                  >
                    Deactivate
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Launch Event Campaigns Section (Merged into Overview) */}
          {canManageEvents && (
            <div className="space-y-6 pt-2 border-t border-card-border/60">
              {/* Create Launch Event Form */}
              <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border space-y-4">
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Rocket className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                  <span>Launch Event Creator (&quot;First N Members Get Free Premium&quot;)</span>
                </h2>

                <form onSubmit={handleCreateEvent} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="sm:col-span-2">
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Event Title</label>
                    <input
                      type="text"
                      value={eventTitle}
                      onChange={(e) => setEventTitle(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
                      placeholder="e.g. Next 100 New Users Get Yearly Pro"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Max Users Claim</label>
                    <input
                      type="number"
                      min="1"
                      value={eventMaxClaims}
                      onChange={(e) => setEventMaxClaims(parseInt(e.target.value) || 100)}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Duration (Days)</label>
                    <select
                      value={eventDuration}
                      onChange={(e) => setEventDuration(parseInt(e.target.value))}
                      className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
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
                      className="px-6 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all flex items-center gap-1.5"
                    >
                      <Rocket className="w-4 h-4" />
                      <span>{creatingEvent ? 'Creating Event...' : 'Launch Event'}</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Active Launch Events Grid */}
              <div className="space-y-4">
                <h3 className="text-base font-bold text-foreground">Active Launch Campaigns ({events.length})</h3>

                {events.length === 0 ? (
                  <div className="p-8 text-center glass-panel rounded-3xl space-y-2">
                    <p className="text-xs text-muted-foreground">No active launch campaigns created yet.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {events.map((ev) => {
                      const percent = Math.min(Math.round((ev.claimedCount / ev.maxClaimCount) * 100), 100);
                      return (
                        <div key={ev.id} className="glass-card rounded-3xl p-6 border border-card-border space-y-4 relative overflow-hidden">
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <h4 className="text-base font-bold text-foreground">{ev.title}</h4>
                              <p className="text-xs text-muted-foreground">
                                Duration: {ev.durationDays >= 3650 ? 'Lifetime' : `${ev.durationDays} Days`}
                              </p>
                            </div>

                            <button
                              onClick={() => handleToggleEvent(ev.id)}
                              className={`px-3 py-1 rounded-full text-xs font-bold border transition-colors ${
                                ev.isActive
                                  ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/40 hover:bg-emerald-500/30'
                                  : 'bg-slate-800 text-muted-foreground border-slate-700 hover:bg-slate-700'
                              }`}
                            >
                              {ev.isActive ? 'Active' : 'Paused'}
                            </button>
                          </div>

                          {/* Progress Bar */}
                          <div className="space-y-1.5">
                            <div className="flex justify-between text-xs font-semibold">
                              <span className="text-foreground/80">Claims Progress</span>
                              <span className="text-amber-600 dark:text-amber-400">{ev.claimedCount} / {ev.maxClaimCount} ({percent}%)</span>
                            </div>
                            <div className="w-full h-3 rounded-full bg-card overflow-hidden border border-card-border">
                              <div
                                className="h-full bg-amber-500 transition-all duration-500"
                                style={{ width: `${percent}%` }}
                              />
                            </div>
                          </div>

                          <div className="text-[11px] text-slate-500 pt-2 border-t border-card-border/80 flex items-center justify-between">
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
        </div>
      )}


      {/* TAB: LIVE ACTIVE SESSIONS MONITOR */}
      {activeTab === 'active-sessions' && (
        <div className="space-y-8 animate-fade-in">
          {/* Header Bar & Auto-Refresh Indicator */}
          <div className="flex items-center justify-between flex-wrap gap-4 relative overflow-hidden glass-panel p-6 rounded-3xl border border-card-border/80 shadow-2xl">
            {/* Background glowing effects */}
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none"></div>
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 bg-primary-500/10 rounded-full blur-3xl pointer-events-none"></div>
            
            <div className="relative z-10">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center w-8 h-8 rounded-full bg-emerald-500/20 border border-emerald-500/30 shadow-[0_0_15px_rgba(16,185,129,0.3)]">
                  <span className="animate-ping absolute inline-flex h-4 w-4 rounded-full bg-emerald-400 opacity-60"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400"></span>
                </div>
                <h3 className="text-xl font-black text-foreground">Live Mission Control</h3>
              </div>
              <p className="text-sm text-muted-foreground mt-1 font-medium ml-11">
                Real-time active candidate monitoring, advanced telemetry, and action audit trails.
              </p>
            </div>

            <div className="flex items-center gap-4 relative z-10 bg-background/60 p-2 pl-4 rounded-2xl border border-card-border/80 backdrop-blur-md">
              <div className="text-right">
                <p className="text-sm font-black text-emerald-600 dark:text-emerald-400 flex items-center justify-end gap-1.5 drop-shadow-[0_0_8px_rgba(52,211,153,0.4)]">
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
                className="p-3 rounded-xl bg-slate-800 border border-slate-700 hover:border-primary-500/50 text-foreground/80 hover:text-foreground transition-all shadow-lg group"
                title="Force Refresh Telemetry"
              >
                <RefreshCw className={`w-4 h-4 group-hover:rotate-180 transition-transform duration-500 ${refreshingSessions ? 'animate-spin text-amber-600 dark:text-amber-400' : ''}`} />
              </button>
            </div>
          </div>

          {/* Bento Box Metrics Grid */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-5">
            {/* Primary Metric - Active Users */}
            <div className="col-span-1 md:col-span-4 glass-card rounded-3xl p-6 border border-emerald-500/30 bg-card relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 text-emerald-500/10 group-hover:text-emerald-500/20 transition-colors">
                <Users className="w-32 h-32" />
              </div>
              <div className="relative z-10 space-y-2">
                <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/80 flex items-center gap-2">
                  <Activity className="w-4 h-4" /> Actively Interacting
                </span>
                <div className="flex items-baseline gap-3">
                  <p className="text-5xl font-black text-emerald-500">
                    {activeStats?.activeNowCount ?? 0}
                  </p>
                  <span className="px-2 py-1 rounded-md bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/30">
                    LIVE
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground font-medium">Candidates currently focused and engaging.</p>
              </div>
            </div>

            {/* Middle Column - Time Metrics */}
            <div className="col-span-1 md:col-span-4 flex flex-col gap-5">
              <div className="flex-1 glass-card rounded-3xl p-5 border border-amber-500/20 bg-amber-950/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-500/80 block mb-1">Avg Focus / Session</span>
                  <p className="text-2xl font-black text-amber-600 dark:text-amber-300">
                    {Math.floor((activeStats?.avgActiveSecondsPerUser || 0) / 60)}<span className="text-sm text-amber-500/70">m</span> {(activeStats?.avgActiveSecondsPerUser || 0) % 60}<span className="text-sm text-amber-500/70">s</span>
                  </p>
                </div>
                <div className="p-3 bg-amber-500/10 rounded-2xl border border-amber-500/20">
                  <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
              </div>
              <div className="flex-1 glass-card rounded-3xl p-5 border border-primary-500/20 bg-primary-950/10 flex items-center justify-between">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-primary-500/80 block mb-1">Total Time Logged Today</span>
                  <p className="text-2xl font-black text-primary-600 dark:text-primary-300">
                    {Math.floor((activeStats?.totalActiveSecondsToday || 0) / 3600)}<span className="text-sm text-primary-500/70">h</span> {Math.floor(((activeStats?.totalActiveSecondsToday || 0) % 3600) / 60)}<span className="text-sm text-primary-500/70">m</span>
                  </p>
                </div>
                <div className="p-3 bg-primary-500/10 rounded-2xl border border-primary-500/20">
                  <Sparkles className="w-6 h-6 text-primary-600 dark:text-primary-400" />
                </div>
              </div>
            </div>

            {/* Right Column - Device Breakdown */}
            <div className="col-span-1 md:col-span-4 glass-card rounded-3xl p-6 border border-blue-500/20 bg-blue-950/10 flex flex-col justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400 flex items-center gap-2 mb-4">
                <Laptop className="w-4 h-4" /> Platform Distribution
              </span>
              
              <div className="space-y-4">
                {[{ label: 'Desktop', icon: Laptop, count: activeStats?.desktopCount || 0, color: 'bg-primary-500', bg: 'bg-primary-500/20', text: 'text-primary-600 dark:text-primary-400' },
                  { label: 'Mobile', icon: Smartphone, count: activeStats?.mobileCount || 0, color: 'bg-emerald-500', bg: 'bg-emerald-500/20', text: 'text-emerald-600 dark:text-emerald-400' },
                  { label: 'Tablet', icon: Tablet, count: activeStats?.tabletCount || 0, color: 'bg-amber-500', bg: 'bg-amber-500/20', text: 'text-amber-600 dark:text-amber-400' }
                ].map((device) => {
                  const total = (activeStats?.desktopCount || 0) + (activeStats?.mobileCount || 0) + (activeStats?.tabletCount || 0);
                  const percentage = total === 0 ? 0 : Math.round((device.count / total) * 100);
                  
                  return (
                    <div key={device.label} className="space-y-1.5">
                      <div className="flex justify-between text-xs font-bold">
                        <span className="flex items-center gap-1.5 text-foreground/80">
                          <device.icon className={`w-3.5 h-3.5 ${device.text}`} /> {device.label}
                        </span>
                        <span className={device.text}>{device.count} <span className="text-slate-500 font-medium">({percentage}%)</span></span>
                      </div>
                      <div className="w-full h-1.5 bg-card rounded-full overflow-hidden border border-card-border">
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
                    <Crown className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <h4 className="text-sm font-black text-foreground">
                        Top Candidates Leaderboard ({activeTimeframeList.length})
                      </h4>
                      <p className="text-[10px] text-muted-foreground font-medium">
                        Showing top candidates for <span className="text-amber-600 dark:text-amber-400 font-bold">{timeframeLabels[topUsersTimeframeFilter]}</span>
                      </p>
                    </div>
                  </div>

                  {/* Timeframe selector dropdown */}
                  <div className="relative shrink-0">
                    <select
                      value={topUsersTimeframeFilter}
                      onChange={(e) => setTopUsersTimeframeFilter(e.target.value as any)}
                      className="px-3.5 py-2 rounded-xl bg-card border border-amber-500/30 text-amber-600 dark:text-amber-300 font-bold text-xs focus:outline-none focus:border-amber-400 focus:ring-1 focus:ring-amber-400 transition-all shadow-md cursor-pointer appearance-none pr-8"
                    >
                      <option value="today" className="bg-background text-foreground">📅 Today</option>
                      <option value="yesterday" className="bg-background text-foreground">⏮️ Yesterday</option>
                      <option value="thisWeek" className="bg-background text-foreground">📅 This Week</option>
                      <option value="lastWeek" className="bg-background text-foreground">⏮️ Last Week</option>
                      <option value="thisMonth" className="bg-background text-foreground">📅 This Month</option>
                      <option value="lastMonth" className="bg-background text-foreground">⏮️ Last Month</option>
                      <option value="thisYear" className="bg-background text-foreground">🗓️ This Year</option>
                      <option value="lastYear" className="bg-background text-foreground">⏮️ Last Year</option>
                      <option value="allTime" className="bg-background text-amber-600 dark:text-amber-300 font-bold">🏆 All Time</option>
                    </select>
                    <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-amber-600 dark:text-amber-400 text-[10px]">
                      ▼
                    </div>
                  </div>
                </div>

                {activeTimeframeList.length === 0 ? (
                  <div className="p-6 text-center bg-card/40 rounded-2xl border border-card-border/80">
                    <p className="text-xs font-bold text-muted-foreground">No candidate activity logged for {timeframeLabels[topUsersTimeframeFilter]}</p>
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
                          onClick={() => openCandidateInspector(u.userEmail)}
                          className="p-3.5 rounded-2xl bg-card/80 border border-card-border flex items-center justify-between gap-3 hover:border-amber-500/40 transition-all shadow-md cursor-pointer group"
                        >
                          <div className="flex items-center gap-2.5 min-w-0">
                            <span className="text-sm font-black w-6 text-center text-amber-600 dark:text-amber-300 shrink-0">{rankBadge}</span>
                            <UserAvatar name={u.userName} email={u.userEmail} image={u.userImage} size="sm" />
                            <div className="min-w-0">
                              <p className="text-xs font-bold text-foreground truncate">{u.userName}</p>
                              <p className="text-[10px] text-muted-foreground truncate">{u.userEmail}</p>
                            </div>
                          </div>

                          <div className="text-right shrink-0 flex flex-col items-end gap-1">
                            <span className="text-xs font-mono font-bold text-amber-600 dark:text-amber-300 block">
                              {timeDisplay}
                            </span>
                            <span className="text-[9px] text-muted-foreground font-mono bg-background/80 px-1.5 py-0.5 rounded-md border border-card-border/80 truncate block max-w-[110px]" title={u.lastActivePath}>
                              {u.lastActivePath || "/"}
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
            <div className="glass-panel rounded-3xl border border-primary-500/20 p-5 space-y-3 bg-primary-950/10">
              <h4 className="text-xs font-bold uppercase tracking-wider text-primary-600 dark:text-primary-400 flex items-center gap-1.5">
                <Globe className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                <span>Most Used Tabs / Pages Being Read Right Now</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {topPagesRightNow.map((p) => (
                  <a
                    key={p.path}
                    href={p.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3.5 rounded-2xl bg-card/80 border border-card-border hover:border-primary-500/40 flex items-center justify-between gap-3 transition-all group shadow-md"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-foreground group-hover:text-primary-600 dark:group-hover:text-primary-300 truncate">{p.title}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{p.path}</p>
                    </div>
                    <span className="px-2.5 py-1 rounded-xl bg-primary-600/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 text-xs font-black shrink-0">
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
              <div className="flex items-center justify-between flex-wrap gap-4 glass-panel p-4 rounded-2xl border border-card-border">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                  {[
                    { id: 'all', label: `All (${activeSessions.length})` },
                    { id: 'active', label: `🟢 Active (${activeSessions.filter(s => s.state === 'active').length})` },
                    { id: 'idle', label: `🟡 Idle (${activeSessions.filter(s => s.state === 'idle').length})` },
                    { id: 'background', label: `⚪ Bg (${activeSessions.filter(s => s.state === 'background').length})` },
                    { id: 'registered', label: `👤 Registered (${activeSessions.filter(s => !s.userEmail.startsWith('guest_')).length})` },
                    { id: 'guest', label: `👻 Guests (${activeSessions.filter(s => s.userEmail.startsWith('guest_')).length})` },
                  ].map((f) => (
                    <button
                      key={f.id}
                      onClick={() => setSessionStateFilter(f.id as any)}
                      className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 ${
                        sessionStateFilter === f.id
                          ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                          : 'bg-card/60 text-muted-foreground hover:text-foreground border border-card-border hover:border-slate-700'
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
                    className="w-full pl-9 pr-4 py-2 rounded-xl bg-background border border-card-border text-xs font-medium text-foreground focus:outline-none focus:border-primary-500 focus:ring-1 focus:ring-primary-500 transition-all shadow-inner"
                  />
                </div>
              </div>

              {/* Grid of Active Candidate Cards */}
              <div className="glass-panel rounded-3xl border border-card-border p-6 min-h-[400px]">
                <div className="flex items-center justify-between mb-6">
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5 text-primary-600 dark:text-primary-400 animate-[spin_4s_linear_infinite]">
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
                    <p className="text-sm font-bold text-foreground/80">Awaiting Signal...</p>
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
                            textTime: 'text-emerald-600 dark:text-emerald-400',
                            pingClass: 'bg-emerald-400'
                          },
                          idle: {
                            borderHover: 'hover:border-amber-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(245,158,11,0.15)]',
                            bgGlow: 'bg-amber-500/5',
                            bgDot: 'bg-amber-500',
                            textTime: 'text-amber-600 dark:text-amber-400',
                            pingClass: 'bg-amber-400'
                          },
                          background: {
                            borderHover: 'hover:border-slate-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(100,116,139,0.15)]',
                            bgGlow: 'bg-slate-500/5',
                            bgDot: 'bg-slate-500',
                            textTime: 'text-muted-foreground',
                            pingClass: 'hidden'
                          },
                          focus: {
                            borderHover: 'hover:border-blue-500/50',
                            shadowHover: 'hover:shadow-[0_0_20px_rgba(59,130,246,0.15)]',
                            bgGlow: 'bg-blue-500/5',
                            bgDot: 'bg-blue-500',
                            textTime: 'text-blue-600 dark:text-blue-400',
                            pingClass: 'bg-blue-400'
                          }
                        };
                        
                        const sConf = stateConfig[session.state] || stateConfig.active;

                        const DeviceIcon = session.deviceType === 'mobile' ? Smartphone : session.deviceType === 'tablet' ? Tablet : Laptop;
                        
                        return (
                          <div
                            key={session.id}
                            className={`relative overflow-hidden p-4 rounded-2xl bg-card/60 border border-card-border transition-all group cursor-pointer ${sConf.borderHover} ${sConf.shadowHover}`}
                            onClick={() => setInspectingSession(session)}
                          >
                            {/* Subtle background glow based on state */}
                            <div className={`absolute top-0 right-0 w-32 h-32 blur-3xl rounded-full pointer-events-none ${sConf.bgGlow}`}></div>

                             <div className="flex items-start justify-between gap-3 relative z-10">
                              <div
                                className="flex items-center gap-3 min-w-0 cursor-pointer group/prof hover:opacity-90 transition-opacity"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openCandidateInspector(session.userEmail);
                                }}
                                title="Click profile to view 360° Candidate Inspector"
                              >
                                <div className="relative shrink-0">
                                  <UserAvatar name={session.userName} email={session.userEmail} image={session.userImage} size="md" />
                                  <span className="absolute -bottom-1 -right-1 flex h-3.5 w-3.5">
                                    <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${sConf.pingClass} opacity-75`}></span>
                                    <span className={`relative inline-flex rounded-full h-3.5 w-3.5 border-2 border-slate-900 ${sConf.bgDot}`}></span>
                                  </span>
                                </div>
                                <div className="min-w-0">
                                  <p className="text-sm font-black text-foreground group-hover/prof:text-primary-600 dark:text-primary-400 group-hover/prof:underline transition-colors truncate flex items-center gap-1">
                                    <span>{session.userName}</span>
                                    <Search className="w-3 h-3 text-primary-600 dark:text-primary-400 opacity-0 group-hover/prof:opacity-100 transition-opacity shrink-0" />
                                  </p>
                                  <p className="text-[10px] text-muted-foreground font-medium truncate">{session.userEmail}</p>
                                </div>
                              </div>
                              <span className="px-2 py-1 bg-background rounded-lg border border-card-border text-[10px] font-mono text-foreground/80 font-bold shrink-0">
                                {Math.floor(session.activeSeconds / 60)}m {session.activeSeconds % 60}s
                              </span>
                            </div>

                            <div className="mt-4 p-2.5 rounded-xl bg-background/80 border border-card-border/80">
                              <p className="text-[9px] font-bold uppercase text-slate-500 mb-1 flex justify-between">
                                <span>Current View</span>
                                <span className={`${sConf.textTime}`}>{session.lastSeenSecondsAgo}s ago</span>
                              </p>
                              <p className="text-xs font-semibold text-foreground truncate">{session.pageTitle || 'Loading...'}</p>
                              <p className="text-[10px] text-primary-600 dark:text-primary-400/80 font-mono truncate mt-0.5">{session.currentPath}</p>
                            </div>

                            <div className="mt-3 flex items-center justify-between text-[10px] text-slate-500 font-bold">
                              <div className="flex items-center gap-2">
                                <DeviceIcon className="w-3.5 h-3.5 text-muted-foreground" />
                                <span>{session.os}</span>
                                <span className="w-1 h-1 rounded-full bg-slate-700"></span>
                                <span>{session.browser}</span>
                              </div>
                              {isSuperadmin && (
                                <button
                                  onClick={(e) => { e.stopPropagation(); handleTerminateSession(session.sessionId); }}
                                  className="text-rose-500/50 hover:text-rose-600 dark:hover:text-rose-400 p-1 rounded-md hover:bg-rose-500/10 transition-colors"
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
              <div className="glass-panel rounded-3xl border border-card-border p-5 h-full flex flex-col">
                <div className="flex items-center justify-between mb-4 shrink-0">
                  <h4 className="text-sm font-black text-foreground flex items-center gap-2">
                    <History className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                    <span>Global Pulse</span>
                  </h4>
                  <span className="text-[10px] bg-primary-500/20 text-primary-600 dark:text-primary-300 px-2 py-0.5 rounded-md font-bold">Live Stream</span>
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
                          <div className={`relative z-10 w-5 h-5 rounded-full flex items-center justify-center border-2 border-slate-900 ${evt.type === 'navigation' ? 'bg-primary-500' : 'bg-emerald-500'}`}>
                            {evt.type === 'navigation' ? <Globe className="w-2.5 h-2.5 text-foreground" /> : <Activity className="w-2.5 h-2.5 text-foreground" />}
                          </div>
                        </div>
                        <div className="flex-1 min-w-0 py-1 border-b border-card-border/40 group-last:border-0">
                          <p className="text-[11px] font-medium text-foreground/80">
                            <span
                              onClick={() => openCandidateInspector(evt.email)}
                              className="font-bold text-foreground hover:text-primary-600 dark:hover:text-primary-400 hover:underline cursor-pointer transition-colors"
                              title="Click profile to open Candidate 360° Inspector"
                            >
                              {evt.user}
                            </span>{' '}
                            {evt.type === 'navigation' ? 'navigated to' : 'interacted with'}{' '}
                            <span className="text-primary-600 dark:text-primary-300 font-mono ml-1">{evt.details}</span>
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
          {inspectingSession && (() => {
            const ModalDeviceIcon = inspectingSession.deviceType === 'mobile' ? Smartphone : inspectingSession.deviceType === 'tablet' ? Tablet : Laptop;
            return (
            <div
              className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in cursor-pointer"
              onClick={() => setInspectingSession(null)}
            >
              <div
                className="glass-panel w-full max-w-3xl rounded-3xl p-0 border border-slate-700/80 overflow-hidden shadow-2xl relative bg-background/90 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                {/* Modal Header */}
                <div className="p-6 border-b border-card-border bg-card flex items-center justify-between">
                  <div
                    className="flex items-center gap-4 cursor-pointer group/modalprof"
                    onClick={() => {
                      setInspectingSession(null);
                      openCandidateInspector(inspectingSession.userEmail);
                    }}
                    title="Click profile to open Candidate 360° Inspector"
                  >
                    <UserAvatar name={inspectingSession.userName} email={inspectingSession.userEmail} image={inspectingSession.userImage} size="lg" />
                    <div>
                      <h3 className="text-lg font-black text-foreground group-hover/modalprof:text-primary-600 dark:text-primary-400 group-hover/modalprof:underline transition-colors flex items-center gap-1.5">
                        <span>{inspectingSession.userName}</span>
                        <Search className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </h3>
                      <p className="text-xs text-primary-600 dark:text-primary-300 font-medium">{inspectingSession.userEmail}</p>
                    </div>
                  </div>
                  <button onClick={() => setInspectingSession(null)} className="p-2 bg-card rounded-full text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors border border-slate-700">
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-6">
                  {/* Device & Connection specs */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Device Type</span>
                      <span className="font-bold text-foreground text-xs capitalize flex items-center gap-1.5">
                        <ModalDeviceIcon className="w-4 h-4 text-primary-600 dark:text-primary-400" /> {inspectingSession.deviceType || 'Desktop'}
                      </span>
                    </div>
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Platform</span>
                      <span className="font-bold text-foreground text-xs truncate block">{inspectingSession.os}</span>
                    </div>
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Browser</span>
                      <span className="font-bold text-foreground text-xs truncate block">{inspectingSession.browser}</span>
                    </div>
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Resolution</span>
                      <span className="font-bold text-foreground text-xs truncate block">{inspectingSession.screenResolution || '1920x1080'}</span>
                    </div>
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Network</span>
                      <span className="font-bold text-foreground text-xs uppercase truncate block">{inspectingSession.networkType || '4g'}</span>
                    </div>
                    <div className="bg-card/60 p-3.5 rounded-2xl border border-card-border">
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-1">Duration</span>
                      <span className="font-bold text-emerald-600 dark:text-emerald-400 text-xs truncate block">{Math.floor(inspectingSession.activeSeconds / 60)}m active</span>
                    </div>
                  </div>

                  {/* IP Address & User-Agent info */}
                  <div className="bg-card/40 p-4 rounded-2xl border border-card-border flex flex-wrap items-center justify-between gap-4">
                    <div>
                      <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">IP Address / Hash</span>
                      <span className="font-mono text-xs font-bold text-primary-600 dark:text-primary-300">{inspectingSession.ipAddress || 'Not recorded'}</span>
                    </div>
                    {inspectingSession.userAgent && (
                      <div className="max-w-md">
                        <span className="text-[10px] text-slate-500 font-bold block uppercase tracking-wider mb-0.5">User Agent</span>
                        <span className="text-[10px] text-muted-foreground font-mono block truncate" title={inspectingSession.userAgent}>
                          {inspectingSession.userAgent}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Audit Trail Log */}
                  <div className="bg-card/40 rounded-2xl p-4 border border-card-border space-y-3">
                    <h4 className="text-xs font-bold text-foreground/80 uppercase tracking-wider flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-primary-600 dark:text-primary-400" /> Activity Audit Log
                      </span>
                      <span className="text-[10px] text-slate-500 font-normal">
                        {inspectingSession.recentEvents?.length || 0} Recorded Events
                      </span>
                    </h4>

                    <div className="max-h-56 overflow-y-auto space-y-2 pr-1 custom-scrollbar">
                      {inspectingSession.recentEvents && inspectingSession.recentEvents.length > 0 ? (
                        inspectingSession.recentEvents.map((evt: SessionEventItem, idx: number) => (
                          <div key={idx} className="bg-background/60 p-2.5 rounded-xl border border-card-border/80 text-xs flex items-start justify-between gap-3">
                            <span className="text-foreground/80 font-medium text-[11px] leading-relaxed break-all">
                              {evt.details}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500 whitespace-nowrap pt-0.5">
                              {new Date(evt.timestamp).toLocaleTimeString()}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-center py-6 text-slate-500 text-xs italic">
                          No audit trail events recorded yet for this session.
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                <div className="p-5 bg-card/50 border-t border-card-border flex items-center justify-between">
                  <div className="text-[10px] text-slate-500 font-mono font-bold">
                    ID: {inspectingSession.sessionId}
                  </div>
                  {isSuperadmin && (
                    <button
                      onClick={() => { handleTerminateSession(inspectingSession.sessionId); setInspectingSession(null); }}
                      className="px-5 py-2.5 rounded-xl bg-rose-600/10 hover:bg-rose-600/20 text-rose-600 dark:text-rose-400 text-xs font-bold border border-rose-500/20 transition-all flex items-center gap-2"
                    >
                      <Trash2 className="w-4 h-4" />
                      <span>Terminate User Session</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
            );
          })()}
        </div>
      )}

      {/* ALL SESSIONS LOG TAB */}
      {activeTab === 'all-sessions' && (
        <div className="space-y-6">
          {/* Header Stats Bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-1">
              <span className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">Total Telemetry Logs</span>
              <span className="text-2xl font-black text-foreground">{allSessionsStats?.total || allSessionsList.length || 0}</span>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
              <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400 block uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> Live Active
              </span>
              <span className="text-2xl font-black text-emerald-600 dark:text-emerald-300">{allSessionsStats?.active || 0}</span>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-slate-700/40 bg-slate-800/20 space-y-1">
              <span className="text-xs font-bold text-muted-foreground block uppercase tracking-wider">Offline / Past</span>
              <span className="text-2xl font-black text-foreground/80">{allSessionsStats?.offline || 0}</span>
            </div>
            <div className="glass-panel p-5 rounded-2xl border border-rose-500/20 bg-rose-500/5 space-y-1">
              <span className="text-xs font-bold text-rose-600 dark:text-rose-400 block uppercase tracking-wider flex items-center gap-1.5">
                <Trash2 className="w-3.5 h-3.5" /> Terminated
              </span>
              <span className="text-2xl font-black text-rose-600 dark:text-rose-300">{allSessionsStats?.terminated || 0}</span>
            </div>
          </div>

          {/* Search Bar & Filters */}
          <div className="glass-panel p-5 rounded-3xl border border-card-border space-y-4">
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user email or candidate name..."
                  value={allSessionsQuery}
                  onChange={(e) => {
                    setAllSessionsQuery(e.target.value);
                    fetchAllSessions(e.target.value, allSessionsTabState);
                  }}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-card/80 border border-card-border text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-primary-500 transition-all"
                />
                {allSessionsQuery && (
                  <button
                    onClick={() => {
                      setAllSessionsQuery('');
                      fetchAllSessions('', allSessionsTabState);
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-foreground text-xs"
                  >
                    ✕
                  </button>
                )}
              </div>

              {/* Status Filter Buttons */}
              <div className="flex items-center gap-1.5 bg-card/60 p-1 rounded-xl border border-card-border overflow-x-auto">
                {[
                  { id: 'all', label: '🌐 Online & Offline' },
                  { id: 'active', label: '🟢 Live Active' },
                  { id: 'offline', label: '⚪ Offline' },
                  { id: 'terminated', label: '🔴 Terminated' },
                  { id: 'all_with_terminated', label: '📜 History & Terminated' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => {
                      setAllSessionsTabState(st.id as any);
                      fetchAllSessions(allSessionsQuery, st.id as any);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all whitespace-nowrap ${
                      allSessionsTabState === st.id
                        ? 'bg-primary-600 text-white shadow-md shadow-primary-600/30'
                        : 'text-muted-foreground hover:text-foreground hover:bg-slate-800/40'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                {/* Refresh Button */}
                <button
                  onClick={() => fetchAllSessions(allSessionsQuery, allSessionsTabState)}
                  disabled={allSessionsLoading}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-foreground text-xs font-bold border border-slate-700 transition-all flex items-center justify-center gap-2"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${allSessionsLoading ? 'animate-spin text-primary-600 dark:text-primary-400' : ''}`} />
                  <span>Refresh</span>
                </button>

                {/* Terminate All System Sessions Button */}
                {isSuperadmin && (
                  <button
                    onClick={handleTerminateSystemWideSessions}
                    className="px-4 py-2.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/40 text-rose-600 dark:text-rose-300 text-xs font-bold border border-rose-500/30 transition-all flex items-center justify-center gap-2 shadow-lg shadow-rose-950/40"
                    title="Terminate all active user sessions across the entire platform at once"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-rose-600 dark:text-rose-400" />
                    <span>Terminate ALL Sessions (Global)</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Telemetry Table */}
          <div className="glass-panel rounded-3xl border border-card-border overflow-hidden">
            {allSessionsLoading ? (
              <div className="p-12 text-center text-muted-foreground space-y-3">
                <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary-600 dark:text-primary-400" />
                <p className="text-xs font-medium">Loading session telemetry across all user accounts...</p>
              </div>
            ) : allSessionsList.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground space-y-2">
                <Globe className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-bold text-foreground/80">No session telemetry records found</p>
                <p className="text-xs text-slate-500">Try adjusting search term or status filter tab.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs text-foreground/80">
                  <thead className="bg-card/90 text-muted-foreground font-bold border-b border-card-border uppercase tracking-wider">
                    <tr>
                      <th className="py-3.5 px-4">User / Candidate</th>
                      <th className="py-3.5 px-4">Device & IP</th>
                      <th className="py-3.5 px-4">Status & Page</th>
                      <th className="py-3.5 px-4">Logged In</th>
                      <th className="py-3.5 px-4">Last Seen</th>
                      <th className="py-3.5 px-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 font-medium">
                    {allSessionsList.map((s) => {
                      const isTerminated = s.terminated;

                      return (
                        <tr key={s.id} className="hover:bg-card/40 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2.5">
                              <UserAvatar name={s.userName} image={s.userImage} className="w-8 h-8 rounded-full border border-slate-700" />
                              <div className="space-y-0.5">
                                <span className="font-bold text-foreground block">{s.userName}</span>
                                <span className="text-[11px] text-primary-600 dark:text-primary-400 font-mono block">{s.userEmail}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span className="font-bold text-foreground block capitalize">
                                {s.deviceType === 'mobile' ? '📱 Mobile' : s.deviceType === 'tablet' ? '📱 Tablet' : '💻 Desktop'} · {s.browser}
                              </span>
                              <span className="text-[10px] text-muted-foreground font-mono block">
                                {s.os} · 📍 IP: {s.ipAddress || 'Unknown'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-1">
                              <div className="flex items-center gap-1.5">
                                {isTerminated ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                                    🔴 Terminated
                                  </span>
                                ) : s.state === 'active' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
                                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live Active
                                  </span>
                                ) : s.state === 'focus' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-primary-500/10 text-primary-600 dark:text-primary-400 border border-primary-500/20">
                                    🟣 Focus Studying
                                  </span>
                                ) : s.state === 'idle' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                                    🟡 Away Idle
                                  </span>
                                ) : s.state === 'background' ? (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-muted-foreground border border-slate-700">
                                    ⚙️ Background Tab
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-slate-800 text-muted-foreground border border-slate-700">
                                    ⚪ Offline
                                  </span>
                                )}
                              </div>
                              <span className="text-[10px] text-muted-foreground font-mono block truncate max-w-[180px]" title={s.currentPath}>
                                {s.currentPath}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <span
                              className="text-foreground/80 font-mono text-[11px] block cursor-help"
                              title={s.startedAt ? new Date(s.startedAt).toLocaleString() : undefined}
                            >
                              {formatTimeAgo(s.startedAt ? Math.max(0, Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000)) : null)}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            <div className="space-y-0.5">
                              <span
                                className="text-foreground font-mono text-[11px] block cursor-help"
                                title={s.lastHeartbeat ? new Date(s.lastHeartbeat).toLocaleString() : undefined}
                              >
                                {formatTimeAgo(s.lastSeenSecondsAgo)}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono block">
                                {new Date(s.lastHeartbeat).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5">
                              {!isTerminated && (
                                <button
                                  onClick={() => handleTerminateSession(s.sessionId)}
                                  title="Terminate this session"
                                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all text-xs font-bold"
                                >
                                  Terminate
                                </button>
                              )}
                              <button
                                onClick={() => handleTerminateAllSessionsForEmail(s.userEmail)}
                                title="Terminate ALL sessions for this email"
                                className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-900/30 text-foreground/80 hover:text-rose-600 dark:hover:text-rose-300 border border-slate-700 transition-all text-[11px] font-bold"
                              >
                                Terminate All
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: REDEEM CODES */}
      {activeTab === 'codes' && (
        <div className="space-y-6">
          {/* Generator Form */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border space-y-4">
            <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
              <Key className="w-5 h-5 text-primary-600 dark:text-primary-400" />
              <span>Redeem Code Generator</span>
            </h2>

            <form onSubmit={handleGenerateCodes} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Prefix</label>
                <input
                  type="text"
                  value={codePrefix}
                  onChange={(e) => setCodePrefix(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-mono font-bold text-foreground uppercase"
                  placeholder="PREPTEA"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Quantity (Max 100)</label>
                <input
                  type="number"
                  min="1"
                  max="100"
                  value={codeCount}
                  onChange={(e) => setCodeCount(parseInt(e.target.value) || 1)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Duration (Days)</label>
                <select
                  value={codeDuration}
                  onChange={(e) => setCodeDuration(parseInt(e.target.value))}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
                >
                  <option value={30}>30 Days (1 Month)</option>
                  <option value={90}>90 Days (3 Months)</option>
                  <option value={365}>365 Days (1 Year)</option>
                  <option value={3650}>Lifetime Access</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-muted-foreground mb-1">Batch Access Tier</label>
                <select
                  value={codeBatchName}
                  onChange={(e) => setCodeBatchName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
                >
                  <option value="SigmaX">SigmaX (All Batches Access)</option>
                  <option value="Sigma 6.0">Sigma 6.0</option>
                  <option value="Sigma 8.0">Sigma 8.0</option>
                  <option value="Sigma 11.0">Sigma 11.0</option>
                  <option value="Prime">Prime (AI/ML & Projects)</option>
                  <option value="Delta">Delta (DevHub & Delta 5-9)</option>
                  <option value="Alpha">Alpha (Alpha Plus 5-8)</option>
                </select>
              </div>

              <div className="flex items-end">
                <button
                  type="submit"
                  disabled={generatingCodes}
                  className="w-full py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all flex items-center justify-center gap-1.5"
                >
                  <Plus className="w-4 h-4" />
                  <span>{generatingCodes ? 'Generating...' : 'Generate Codes'}</span>
                </button>
              </div>
            </form>
          </div>

          {/* Codes Data Table */}
          <div className="glass-panel rounded-3xl border border-card-border overflow-hidden space-y-4">
            <div className="p-4 sm:p-6 border-b border-card-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-bold text-foreground">Generated Redeem Codes ({codes.length})</h3>
                <p className="text-xs text-muted-foreground">Copy code strings or export batch to CSV.</p>
              </div>

              {codes.length > 0 && (
                <button
                  onClick={downloadCodesCSV}
                  className="px-4 py-2 rounded-xl bg-card hover:bg-slate-800 border border-slate-700 text-foreground font-bold text-xs flex items-center gap-1.5 transition-colors"
                >
                  <Download className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  <span>Export to CSV</span>
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[11px] font-semibold border-b border-card-border">
                  <tr>
                    <th className="py-3 px-4">Code</th>
                    <th className="py-3 px-4">Batch</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-center">Uses</th>
                    <th className="py-3 px-4 text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {codes.map((c) => (
                    <tr key={c.id} className="hover:bg-card/40 text-foreground transition-colors">
                      <td className="py-3 px-4">
                        <button
                          type="button"
                          onClick={() => copyToClipboard(c.code, c.id)}
                          className="font-mono font-bold text-amber-600 dark:text-amber-300 hover:text-amber-200 flex items-center gap-1.5 cursor-pointer text-left transition-colors group"
                          title="Click to copy code"
                        >
                          <span>{c.code}</span>
                          {copiedCodeId === c.id ? (
                            <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-0.5 bg-emerald-950/60 px-1.5 py-0.5 rounded border border-emerald-500/30">
                              <Check className="w-3 h-3 text-emerald-600 dark:text-emerald-400" /> Copied!
                            </span>
                          ) : (
                            <Copy className="w-3.5 h-3.5 text-slate-500 group-hover:text-amber-600 dark:group-hover:text-amber-300 transition-colors opacity-70 group-hover:opacity-100" />
                          )}
                        </button>
                      </td>
                      <td className="py-3 px-4 text-foreground/80 font-medium">
                        {c.batchName}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {c.durationDays >= 3650 ? 'Lifetime' : `${c.durationDays} days`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-bold text-primary-600 dark:text-primary-400">{c.usedCount}</span> / {c.maxUses}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {c.usedCount >= c.maxUses ? (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-800 text-muted-foreground border border-slate-700">
                            Redeemed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                            Active
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: BULK CSV / EMAILS */}
      {activeTab === 'emails' && (
        <div className="space-y-6">
          {/* CSV File Upload & Textarea Panel */}
          <div className="glass-panel rounded-3xl p-6 sm:p-8 border border-card-border space-y-6">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <Mail className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
                <span>Bulk Email Access Granting & CSV / Excel Upload</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Upload a `.csv` file or paste emails. Granted emails get premium activated automatically on sign-in without requiring a code.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left Option: File Upload */}
              <div className="glass-card rounded-2xl p-6 border-2 border-dashed border-primary-500/30 text-center space-y-4 flex flex-col justify-center items-center">
                <div className="w-12 h-12 rounded-2xl bg-primary-600/20 text-primary-600 dark:text-primary-400 flex items-center justify-center">
                  <Upload className="w-6 h-6" />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-foreground">Upload CSV or Excel File</h4>
                  <p className="text-xs text-muted-foreground mt-1">Select a `.csv` or `.txt` file containing candidate email addresses.</p>
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
                  className="px-5 py-2.5 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/20 transition-all flex items-center gap-2"
                >
                  <Upload className="w-4 h-4" />
                  <span>Choose File & Grant</span>
                </button>
              </div>

              {/* Right Option: Textarea Input */}
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-foreground/80">
                  Or Paste Emails (Comma or Newline Separated)
                </label>
                <textarea
                  rows={4}
                  value={emailText}
                  onChange={(e) => setEmailText(e.target.value)}
                  placeholder="student1@gmail.com, student2@gmail.com&#10;student3@gmail.com"
                  className="w-full p-3 rounded-2xl bg-card border border-card-border text-xs font-mono text-foreground placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />

                <div className="flex items-center justify-between gap-3">
                  <select
                    value={bulkDuration}
                    onChange={(e) => setBulkDuration(parseInt(e.target.value))}
                    className="px-3 py-2 rounded-xl bg-card border border-card-border text-xs font-bold text-foreground"
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
          <div className="glass-panel rounded-3xl border border-card-border overflow-hidden space-y-4">
            <div className="p-4 sm:p-6 border-b border-card-border">
              <h3 className="text-base font-bold text-foreground">Pre-Approved / Granted Email List ({emails.length})</h3>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[11px] font-semibold border-b border-card-border">
                  <tr>
                    <th className="py-3 px-4">Email</th>
                    <th className="py-3 px-4 text-center">Duration</th>
                    <th className="py-3 px-4 text-center">Activation Status</th>
                    <th className="py-3 px-4 text-right">Granted By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {emails.map((m) => (
                    <tr key={m.id} className="hover:bg-card/40 text-foreground transition-colors">
                      <td
                        className="py-3 px-4 font-bold text-foreground cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 hover:underline transition-colors"
                        onClick={() => openCandidateInspector(m.email)}
                        title="Click to open Candidate 360° Inspector"
                      >
                        {m.email}
                      </td>
                      <td className="py-3 px-4 text-center font-semibold">
                        {m.durationDays >= 3650 ? 'Lifetime' : `${m.durationDays} Days`}
                      </td>
                      <td className="py-3 px-4 text-center">
                        {m.isActivated ? (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border border-emerald-500/30">
                            Active User
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                            Pending Sign-In
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right text-muted-foreground">{m.addedBy}</td>
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
          <div className="glass-panel rounded-3xl p-6 border border-card-border space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                  <Users className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                  <span>User & Administrator Management</span>
                </h2>
                <p className="text-xs text-muted-foreground mt-1">Assign admin roles, permissions, and direct premium status.</p>
              </div>

              {/* Search Bar */}
              <div className="relative w-full sm:w-64">
                <Search className="w-4 h-4 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  placeholder="Search user name or email..."
                  value={userQuery}
                  onChange={(e) => setUserQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-xl bg-card border border-card-border text-xs text-foreground placeholder-slate-500 focus:outline-none focus:border-primary-500"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-card/80 text-muted-foreground uppercase text-[11px] font-semibold border-b border-card-border">
                  <tr>
                    <th className="py-3 px-4">User</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-4 text-center">Admin Rights</th>
                    <th className="py-3 px-4 text-center">Course Batches</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map((u) => {
                    const isSuper = u.email.toLowerCase() === (process.env.SUPERADMIN_EMAIL ?? '').toLowerCase();
                    const permCount = u.adminPermissions ? u.adminPermissions.length : 0;
                    const batchCount = u.allowedBatches ? u.allowedBatches.length : 0;

                    return (
                      <tr key={u.id} className="hover:bg-card/40 text-foreground transition-colors">
                        <td
                          className="py-3 px-4 flex items-center gap-3 cursor-pointer group/user"
                          onClick={() => openCandidateInspector(u.email)}
                          title="Click profile to open Candidate 360° Inspector"
                        >
                          <UserAvatar name={u.name} email={u.email} image={u.image} size="sm" />
                          <div>
                            <p className="font-bold text-foreground group-hover/user:text-primary-600 dark:text-primary-400 group-hover/user:underline transition-colors flex items-center gap-1.5">
                              <span>{u.name}</span>
                              <Search className="w-3 h-3 text-primary-600 dark:text-primary-400 opacity-0 group-hover/user:opacity-100 transition-opacity shrink-0" />
                            </p>
                            <p className="text-[10px] text-muted-foreground font-mono">{u.email}</p>
                          </div>
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isSuper ? (
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-amber-500 text-black">
                              Super Admin
                            </span>
                          ) : (
                            <select
                              value={u.role}
                              onChange={(e) => handleUpdateUser(u.email, e.target.value, u.isPremium, u.adminPermissions, u.allowedBatches)}
                              disabled={!isSuperadmin}
                              className="px-2 py-1 rounded-lg bg-card border border-slate-700 text-xs font-bold text-foreground"
                            >
                              <option value="user">User</option>
                              <option value="admin">Admin</option>
                            </select>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          {isSuper ? (
                            <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400">Full Permanent Rights</span>
                          ) : (
                            <button
                              onClick={() => openPermissionModal(u)}
                              disabled={!isSuperadmin}
                              className="px-2.5 py-1 rounded-xl bg-primary-500/20 text-primary-600 dark:text-primary-300 hover:bg-primary-500/30 border border-primary-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto"
                            >
                              <ShieldCheck className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                              <span>{permCount} active</span>
                            </button>
                          )}
                        </td>

                        <td className="py-3 px-4 text-center">
                          <button
                            onClick={() => openBatchesModal(u)}
                            className="px-2.5 py-1 rounded-xl bg-primary-500/20 text-primary-600 dark:text-primary-300 hover:bg-primary-500/30 border border-primary-500/30 text-[11px] font-bold transition-all flex items-center gap-1.5 mx-auto"
                          >
                            <BookOpen className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                            <span>{batchCount > 0 ? `${batchCount} batch(es)` : 'Grant Access'}</span>
                          </button>
                        </td>

                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <select 
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleGrantDemo(u.email, parseInt(e.target.value));
                                  e.target.value = ""; // Reset after selection
                                }
                              }}
                              className="px-2 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-md border-none text-[11px] font-bold outline-none cursor-pointer text-center appearance-none"
                              defaultValue=""
                            >
                              <option value="" disabled>Grant Demo</option>
                              <option value="5">5 mins</option>
                              <option value="15">15 mins</option>
                              <option value="60">1 Hour</option>
                              <option value="720">12 Hours</option>
                              <option value="1440">24 Hours</option>
                              <option value="4320">3 Days</option>
                            </select>
                            <button
                              onClick={() => {
                                const nextPrem = !u.isPremium;
                                handleUpdateUser(u.email, u.role, nextPrem, u.adminPermissions, u.allowedBatches || []);
                              }}
                              className={`px-3 py-1.5 rounded-xl text-[11px] font-bold transition-all ${
                                u.isPremium
                                  ? 'bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-500/30 hover:bg-rose-900/60'
                                  : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md'
                              }`}
                            >
                              {u.isPremium ? 'Revoke Premium' : 'Grant Premium'}
                            </button>
                            {!isSuper && (
                              <button
                                onClick={() => handleDeleteUser(u.email)}
                                title="Permanently Delete User & All Data"
                                className="px-2.5 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-500 hover:text-rose-400 font-bold text-[11px] transition-all flex items-center gap-1 shrink-0"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            )}
                          </div>
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
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in cursor-pointer"
              onClick={() => setEditingUserForPerms(null)}
            >
              <div
                className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-primary-500/30 shadow-2xl space-y-5 bg-card/95 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-card-border">
                  <div className="flex items-center gap-2.5">
                    <ShieldCheck className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <div>
                      <h3 className="text-base font-bold text-foreground">Configure Admin Rights</h3>
                      <p className="text-xs text-muted-foreground">{editingUserForPerms.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingUserForPerms(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Presets */}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedPerms(ALL_ADMIN_PERMISSIONS.map((p) => p.id))}
                    className="px-2.5 py-1 rounded-lg bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 text-[11px] font-bold hover:bg-primary-500/30 transition-all"
                  >
                    Grant All Rights
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPerms(['manage_codes', 'manage_events', 'manage_emails'])}
                    className="px-2.5 py-1 rounded-lg bg-slate-800 text-foreground/80 border border-slate-700 text-[11px] font-bold hover:bg-slate-700 transition-all"
                  >
                    Promos Only
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedPerms([])}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 text-rose-600 dark:text-rose-300 border border-rose-500/20 text-[11px] font-bold hover:bg-rose-500/20 transition-all"
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
                            ? 'bg-primary-950/40 border-primary-500/40 text-white'
                            : 'bg-card/60 border-card-border text-muted-foreground hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-1 w-4 h-4 rounded text-primary-600 focus:ring-primary-500 bg-card border-slate-700"
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-foreground flex items-center gap-1.5">
                            <Icon className="w-3.5 h-3.5 text-primary-600 dark:text-primary-400" />
                            <span>{perm.label}</span>
                          </p>
                          <p className="text-[11px] text-muted-foreground mt-0.5">{perm.desc}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-2 pt-2 border-t border-card-border">
                  <button
                    type="button"
                    onClick={() => setEditingUserForPerms(null)}
                    className="px-4 py-2 rounded-xl text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSavePermissions}
                    className="px-5 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white text-xs font-bold shadow-lg shadow-primary-600/30 transition-all flex items-center gap-1.5"
                  >
                    <ShieldCheck className="w-4 h-4" />
                    <span>Save Admin Permissions</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Admin Batch Access Management Modal */}
          {editingUserForBatches && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-fade-in cursor-pointer"
              onClick={() => setEditingUserForBatches(null)}
            >
              <div
                className="w-full max-w-lg glass-panel rounded-3xl p-6 border border-primary-500/30 shadow-2xl space-y-5 bg-card/95 cursor-default"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between pb-3 border-b border-card-border">
                  <div className="flex items-center gap-2.5">
                    <BookOpen className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                    <div>
                      <h3 className="text-base font-bold text-foreground">Grant Course Batch Access</h3>
                      <p className="text-xs text-muted-foreground">{editingUserForBatches.email}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setEditingUserForBatches(null)}
                    className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <p className="text-xs text-foreground/80">
                  Select course batch tiers to grant this candidate access to specific video courses:
                </p>

                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {AVAILABLE_BATCH_OPTIONS.map((opt) => {
                    const isChecked = selectedUserBatches.includes(opt.id);

                    return (
                      <div
                        key={opt.id}
                        onClick={() => {
                          setSelectedUserBatches((prev) =>
                            isChecked ? prev.filter((b) => b !== opt.id) : [...prev, opt.id]
                          );
                        }}
                        className={`flex items-start gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${
                          isChecked
                            ? 'bg-primary-950/50 border-primary-500/50 text-white'
                            : 'bg-background/50 border-card-border/80 text-muted-foreground hover:border-slate-700'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded border-slate-700 text-primary-600 focus:ring-primary-500"
                        />
                        <div className="space-y-0.5">
                          <div className="text-xs font-bold text-foreground">
                            {opt.label}
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-normal">{opt.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-card-border">
                  <button
                    type="button"
                    onClick={() => setEditingUserForBatches(null)}
                    className="px-4 py-2 rounded-xl bg-card border border-slate-700 text-foreground/80 hover:text-foreground font-bold text-xs transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUserBatches}
                    className="px-4 py-2 rounded-xl bg-primary-600 hover:bg-primary-500 text-white font-bold text-xs shadow-lg shadow-primary-600/30 transition-all flex items-center gap-1.5"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Save Batch Access</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Candidate 360° Deep Inspector Modal */}
      {inspectingUserEmail && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4 animate-fade-in cursor-pointer"
          onClick={() => {
            setInspectingUserEmail(null);
            setInspectData(null);
          }}
        >
          <div
            className="bg-background border border-card-border rounded-3xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden shadow-2xl cursor-default"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-6 border-b border-card-border flex items-center justify-between bg-card/60">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary-600/20 border border-primary-500/30 text-primary-600 dark:text-primary-400 flex items-center justify-center font-bold text-lg">
                  🔍
                </div>
                <div>
                  <h3 className="text-lg font-black text-foreground flex items-center gap-2">
                    Candidate 360° Inspector
                    <span className="text-xs px-2 py-0.5 rounded-md bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/30 font-mono font-normal">
                      {inspectingUserEmail}
                    </span>
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Complete MongoDB database dump, live session telemetry, study activity, and test history.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {inspectData?.user?.role !== 'superadmin' && authUser?.email?.toLowerCase() !== inspectingUserEmail.toLowerCase() && (
                  <button
                    onClick={() => handleDeleteUser(inspectingUserEmail)}
                    className="px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/30 border border-rose-500/30 text-rose-500 hover:text-rose-400 font-bold text-xs flex items-center gap-1.5 transition-all shadow-sm"
                    title="Permanently Delete User & All Data"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete User</span>
                  </button>
                )}
                <button
                  onClick={() => {
                    setInspectingUserEmail(null);
                    setInspectData(null);
                  }}
                  className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-slate-800 transition-all"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {loadingInspectData ? (
              <div className="p-12 text-center space-y-3 flex-1 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-primary-500 animate-spin" />
                <p className="text-xs font-bold text-muted-foreground">Fetching complete MongoDB records for {inspectingUserEmail}...</p>
              </div>
            ) : !inspectData ? (
              <div className="p-12 text-center text-rose-600 dark:text-rose-400 text-xs font-bold">Failed to load candidate details.</div>
            ) : (
              <div className="flex-1 flex flex-col min-h-0">
                {/* Modal Tab Navigation */}
                <div className="flex items-center gap-2 px-6 pt-4 border-b border-card-border/80 bg-card/30 overflow-x-auto">
                  <button
                    onClick={() => setInspectActiveTab('overview')}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                      inspectActiveTab === 'overview'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    📊 Overview & Profile
                  </button>
                  <button
                    onClick={() => setInspectActiveTab('activity')}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                      inspectActiveTab === 'activity'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    📅 Daily Study Logs ({inspectData.activityLogs?.length || 0})
                  </button>
                  <button
                    onClick={() => setInspectActiveTab('attempts')}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                      inspectActiveTab === 'attempts'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    📝 Quiz Attempts ({inspectData.attempts?.length || 0})
                  </button>
                  <button
                    onClick={() => setInspectActiveTab('promos')}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                      inspectActiveTab === 'promos'
                        ? 'border-primary-500 text-primary-600 dark:text-primary-400 bg-primary-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    🎁 Promos & Claims ({(inspectData.redeemCodes?.length || 0) + (inspectData.claimedEvents?.length || 0) + (inspectData.preApprovedRecord ? 1 : 0)})
                  </button>
                  <button
                    onClick={() => setInspectActiveTab('raw_json')}
                    className={`px-4 py-2 rounded-t-xl text-xs font-bold transition-all border-b-2 ${
                      inspectActiveTab === 'raw_json'
                        ? 'border-emerald-500 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10'
                        : 'border-transparent text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    ⚡ Raw MongoDB JSON Dump
                  </button>
                </div>

                {/* Modal Body Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                  {/* TAB 1: OVERVIEW */}
                  {inspectActiveTab === 'overview' && (
                    <div className="space-y-6">
                      {/* Top Metric Cards */}
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-3.5 rounded-2xl bg-primary-950/30 border border-primary-500/30">
                          <p className="text-[10px] text-primary-600 dark:text-primary-400 font-bold uppercase tracking-wider">Total Active Study</p>
                          <p className="text-lg font-black text-foreground mt-1">
                            {Math.floor((inspectData.stats?.lifetimeActiveSeconds || 0) / 3600)}h{' '}
                            {Math.floor(((inspectData.stats?.lifetimeActiveSeconds || 0) % 3600) / 60)}m
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30">
                          <p className="text-[10px] text-emerald-600 dark:text-emerald-400 font-bold uppercase tracking-wider">Focus Reading Time</p>
                          <p className="text-lg font-black text-foreground mt-1">
                            {Math.floor((inspectData.stats?.lifetimeFocusSeconds || 0) / 3600)}h{' '}
                            {Math.floor(((inspectData.stats?.lifetimeFocusSeconds || 0) % 3600) / 60)}m
                          </p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-500/30">
                          <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold uppercase tracking-wider">Total Quiz Attempts</p>
                          <p className="text-lg font-black text-foreground mt-1">{inspectData.stats?.totalAttempts || 0}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-cyan-950/30 border border-cyan-500/30">
                          <p className="text-[10px] text-cyan-600 dark:text-cyan-400 font-bold uppercase tracking-wider">Days Active</p>
                          <p className="text-lg font-black text-foreground mt-1">{inspectData.stats?.totalDaysActive || 0} Days</p>
                        </div>
                      </div>

                      {/* Profile Details Grid */}
                      <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-4">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Candidate Profile Record</h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                          <div>
                            <span className="text-slate-500 block">Full Name</span>
                            <span className="font-bold text-foreground">{inspectData.user.name}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Email Address</span>
                            <span className="font-bold text-foreground font-mono">{inspectData.user.email}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Platform Role</span>
                            <span className="font-bold text-primary-600 dark:text-primary-400 uppercase">{inspectData.user.role || 'user'}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Premium Status</span>
                            <span className={`font-bold ${inspectData.user.isPremium ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                              {inspectData.user.isPremium ? 'Premium Candidate' : 'Standard Candidate'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Allowed Batches</span>
                            <span className="font-bold text-foreground">
                              {inspectData.user.allowedBatches?.length > 0 ? inspectData.user.allowedBatches.join(', ') : 'None'}
                            </span>
                          </div>
                          <div>
                            <span className="text-slate-500 block">Registered At</span>
                            <span className="font-bold text-foreground/80">
                              {inspectData.user.createdAt ? new Date(inspectData.user.createdAt).toLocaleString() : 'N/A'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* All Logged-In Devices Telemetry */}
                      <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                          <div className="flex items-center gap-2">
                            <Laptop className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                              All Logged-In Devices ({inspectData.sessions?.length || 0})
                            </h4>
                            {inspectData.sessions?.length > 1 && (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-600 dark:text-amber-300 border border-amber-500/30">
                                ⚠️ {inspectData.sessions.length} Active Devices
                              </span>
                            )}
                          </div>
                          {isSuperadmin && inspectData.sessions?.length > 0 && (
                            <button
                              onClick={() => handleTerminateAllUserSessions(inspectData.user.email)}
                              className="px-3 py-1.5 rounded-xl bg-rose-600/20 hover:bg-rose-600/30 text-rose-600 dark:text-rose-300 border border-rose-500/30 text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Logout All Devices</span>
                            </button>
                          )}
                        </div>

                        {inspectData.sessions?.length === 0 ? (
                          <p className="text-xs text-slate-500 py-4 text-center">No active or historical session records found for this account.</p>
                        ) : (
                          <div className="space-y-2.5 max-h-72 overflow-y-auto custom-scrollbar pr-1">
                            {inspectData.sessions.map((s: any) => {
                              const loginAt = s.startedAt ? new Date(s.startedAt) : null;
                              const loginSecondsAgo = loginAt ? Math.max(0, Math.floor((Date.now() - loginAt.getTime()) / 1000)) : null;
                              const loginAtLabel = formatTimeAgo(loginSecondsAgo);
                              const lastSeen = s.lastHeartbeat ? new Date(s.lastHeartbeat) : null;
                              const secondsAgo = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 1000) : null;
                              const lastSeenLabel = formatTimeAgo(secondsAgo);

                              const stateColors: Record<string, string> = {
                                active: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300 border-emerald-500/30',
                                focus: 'bg-blue-500/20 text-blue-600 dark:text-blue-300 border-blue-500/30',
                                idle: 'bg-amber-500/20 text-amber-600 dark:text-amber-300 border-amber-500/30',
                                background: 'bg-slate-700/40 text-muted-foreground border-slate-600/30',
                              };

                              return (
                                <div key={s._id} className="p-3.5 rounded-xl bg-card/80 border border-card-border/80 text-xs hover:border-slate-700 transition-all space-y-2.5">
                                  {/* Row 1: Path + device type + state badge */}
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="flex items-center gap-2 min-w-0">
                                      <span className="font-bold text-foreground text-xs truncate">{s.currentPath || '/'}</span>
                                      <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-slate-800 text-foreground/80 font-bold uppercase shrink-0">{s.deviceType || 'desktop'}</span>
                                    </div>
                                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border shrink-0 ${stateColors[s.state] || stateColors.background}`}>
                                      {s.state || 'unknown'}
                                    </span>
                                  </div>

                                  {/* Row 2: Browser / OS / IP / Resolution */}
                                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-muted-foreground font-mono">
                                    <span className="text-primary-600 dark:text-primary-300 font-bold">🌐 {s.browser || 'Unknown'}</span>
                                    <span>•</span>
                                    <span className="text-foreground/80">💻 {s.os || 'Unknown'}</span>
                                    <span>•</span>
                                    <span className="text-emerald-600 dark:text-emerald-400 font-bold">📍 IP: {s.ipAddress || '127.0.0.1'}</span>
                                    <span>•</span>
                                    <span className="text-muted-foreground">🖥️ {s.screenResolution || '1920x1080'}</span>
                                  </div>

                                  {/* Row 3: Login time + Last seen + Terminate */}
                                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-card-border/60">
                                    <div className="flex items-center gap-4 text-[10px] font-mono">
                                      <div className="space-y-0.5">
                                        <p className="text-slate-500 uppercase tracking-wider font-bold">Logged in at</p>
                                        <p className="text-foreground/80 font-bold cursor-help" title={loginAt ? loginAt.toLocaleString() : undefined}>
                                          {loginAtLabel}
                                        </p>
                                      </div>
                                      <div className="space-y-0.5">
                                        <p className="text-slate-500 uppercase tracking-wider font-bold">Last seen</p>
                                        <p className="text-amber-600 dark:text-amber-300 font-bold cursor-help" title={lastSeen ? lastSeen.toLocaleString() : undefined}>{lastSeenLabel}</p>
                                      </div>
                                    </div>
                                    {isSuperadmin && (
                                      <button
                                        onClick={() => handleTerminateSession(s.sessionId)}
                                        className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 transition-all shrink-0"
                                        title="Logout / Terminate this device session"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {/* Recent Live Sessions Telemetry (last 2 hours) */}
                      {inspectData.recentSessions && inspectData.recentSessions.length > 0 && (
                        <div className="glass-panel p-5 rounded-2xl border border-primary-500/20 bg-primary-950/10 space-y-3">
                          <div className="flex items-center gap-2">
                            <History className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                            <h4 className="text-xs font-bold uppercase tracking-wider text-foreground/80">
                              Recent Sessions Telemetry
                            </h4>
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary-500/20 text-primary-600 dark:text-primary-300 border border-primary-500/30">
                              Last 2h · {inspectData.recentSessions.length} records
                            </span>
                          </div>

                          <div className="overflow-x-auto rounded-xl border border-card-border">
                            <table className="w-full text-left text-[11px]">
                              <thead className="bg-card/80 text-muted-foreground font-bold border-b border-card-border">
                                <tr>
                                  <th className="px-3 py-2.5">Path</th>
                                  <th className="px-3 py-2.5">State</th>
                                  <th className="px-3 py-2.5">Active Time</th>
                                  <th className="px-3 py-2.5">Device / Browser</th>
                                  <th className="px-3 py-2.5">IP</th>
                                  <th className="px-3 py-2.5">Logged In</th>
                                  <th className="px-3 py-2.5">Last Seen</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-800/60">
                                {inspectData.recentSessions.map((s: any) => {
                                  const loginAt = s.startedAt ? new Date(s.startedAt) : null;
                                  const loginSecondsAgo = loginAt ? Math.max(0, Math.floor((Date.now() - loginAt.getTime()) / 1000)) : null;
                                  const loginAtLabel = formatTimeAgo(loginSecondsAgo);
                                  const lastSeen = s.lastHeartbeat ? new Date(s.lastHeartbeat) : null;
                                  const secondsAgo = lastSeen ? Math.floor((Date.now() - lastSeen.getTime()) / 1000) : null;
                                  const lastSeenLabel = formatTimeAgo(secondsAgo);

                                  const stateStyles: Record<string, string> = {
                                    active: 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300',
                                    focus: 'bg-blue-500/20 text-blue-600 dark:text-blue-300',
                                    idle: 'bg-amber-500/20 text-amber-600 dark:text-amber-300',
                                    background: 'bg-slate-700/40 text-muted-foreground',
                                  };

                                  return (
                                    <tr key={s._id} className={`hover:bg-card/40 transition-colors ${s.terminated ? 'opacity-50' : ''}`}>
                                      <td className="px-3 py-2.5 font-mono text-primary-600 dark:text-primary-300 font-bold truncate max-w-[120px]">
                                        <span title={s.currentPath}>{s.currentPath || '/'}</span>
                                        {s.terminated && (
                                          <span className="ml-1.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/30 uppercase tracking-wider">
                                            terminated
                                          </span>
                                        )}
                                      </td>
                                      <td className="px-3 py-2.5">
                                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${stateStyles[s.state] || stateStyles.background}`}>
                                          {s.state || '—'}
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 font-mono text-foreground/80 font-bold">
                                        {Math.floor((s.activeSeconds || 0) / 60)}m {(s.activeSeconds || 0) % 60}s
                                      </td>
                                      <td className="px-3 py-2.5 text-muted-foreground font-mono">
                                        {s.deviceType || 'desktop'} · {s.browser || '—'} · {s.os || '—'}
                                      </td>
                                      <td className="px-3 py-2.5 font-mono text-emerald-600 dark:text-emerald-400 font-bold">
                                        {s.ipAddress || '127.0.0.1'}
                                      </td>
                                      <td
                                        className="px-3 py-2.5 font-mono text-foreground/80 cursor-help"
                                        title={loginAt ? loginAt.toLocaleString() : undefined}
                                      >
                                        {loginAtLabel}
                                      </td>
                                      <td
                                        className="px-3 py-2.5 font-mono text-amber-600 dark:text-amber-300 font-bold cursor-help"
                                        title={lastSeen ? lastSeen.toLocaleString() : undefined}
                                      >
                                        {lastSeenLabel}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 2: DAILY ACTIVITY LOGS */}
                  {inspectActiveTab === 'activity' && (
                    <div className="space-y-3">
                      {inspectData.activityLogs?.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No daily activity logs recorded yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-card-border">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-card text-muted-foreground font-bold border-b border-card-border">
                              <tr>
                                <th className="p-3">Date</th>
                                <th className="p-3">Active Study Time</th>
                                <th className="p-3">Focus Reading</th>
                                <th className="p-3">Idle Time</th>
                                <th className="p-3">Heartbeats</th>
                                <th className="p-3">Last Page Visited</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-foreground/80">
                              {inspectData.activityLogs.map((log: any) => (
                                <tr key={log._id} className="hover:bg-card/40 font-mono">
                                  <td className="p-3 font-bold text-amber-600 dark:text-amber-300">{log.dateStr}</td>
                                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                                    {formatInspectDuration(log.activeSeconds)}
                                  </td>
                                  <td className="p-3 text-primary-600 dark:text-primary-300">
                                    {formatInspectDuration(log.focusSeconds)}
                                  </td>
                                  <td className="p-3 text-slate-500">
                                    {formatInspectDuration(log.idleSeconds)}
                                  </td>
                                  <td className="p-3">{log.heartbeatsCount}</td>
                                  <td className="p-3 text-muted-foreground truncate max-w-[150px]">{log.lastActivePath}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 3: QUIZ ATTEMPTS */}
                  {inspectActiveTab === 'attempts' && (
                    <div className="space-y-3">
                      {inspectData.attempts?.length === 0 ? (
                        <p className="text-xs text-slate-500 text-center py-8">No test or quiz attempts recorded yet.</p>
                      ) : (
                        <div className="overflow-x-auto rounded-2xl border border-card-border">
                          <table className="w-full text-left text-xs">
                            <thead className="bg-card text-muted-foreground font-bold border-b border-card-border">
                              <tr>
                                <th className="p-3">Quiz & Test Title</th>
                                <th className="p-3">Score</th>
                                <th className="p-3">Accuracy</th>
                                <th className="p-3">Time Spent</th>
                                <th className="p-3">First Attempt?</th>
                                <th className="p-3">Date</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-800/60 text-foreground/80">
                              {inspectData.attempts.map((att: any) => (
                                <tr key={att._id} className="hover:bg-card/40 font-mono">
                                  <td className="p-3 font-bold text-foreground">{att.quizTitle}</td>
                                  <td className="p-3 font-bold text-emerald-600 dark:text-emerald-400">
                                    {`${att.score} / ${att.maxScore}`}
                                  </td>
                                  <td className="p-3 font-bold text-amber-600 dark:text-amber-300">{att.accuracy}%</td>
                                  <td className="p-3 text-primary-600 dark:text-primary-300">
                                    {formatInspectDuration(att.timeSpentSeconds)}
                                  </td>
                                  <td className="p-3">
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${att.isFirstAttempt ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-slate-800 text-muted-foreground'}`}>
                                      {att.isFirstAttempt ? 'YES' : 'RETAKE'}
                                    </span>
                                  </td>
                                  <td className="p-3 text-muted-foreground">
                                    {new Date(att.createdAt || att.timestamp).toLocaleDateString()}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {/* TAB 4: PROMOS & CLAIMS */}
                  {inspectActiveTab === 'promos' && (
                    <div className="space-y-6">
                      {/* Pre-Approved Status */}
                      <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-2">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Pre-Approved Email Access</h4>
                        {inspectData.preApprovedRecord ? (
                          <div className="p-3 rounded-xl bg-emerald-950/30 border border-emerald-500/30 text-xs flex items-center justify-between">
                            <div>
                              <p className="font-bold text-emerald-600 dark:text-emerald-300">Pre-Approved Candidate ({inspectData.preApprovedRecord.durationDays} Days Access)</p>
                              <p className="text-[10px] text-muted-foreground">Added By: {inspectData.preApprovedRecord.addedBy}</p>
                            </div>
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${inspectData.preApprovedRecord.isActivated ? 'bg-emerald-500/20 text-emerald-600 dark:text-emerald-300' : 'bg-amber-500/20 text-amber-600 dark:text-amber-300'}`}>
                              {inspectData.preApprovedRecord.isActivated ? 'ACTIVATED' : 'PENDING'}
                            </span>
                          </div>
                        ) : (
                          <p className="text-xs text-slate-500">Not in pre-approved email whitelist.</p>
                        )}
                      </div>

                      {/* Redeem Code History */}
                      <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Redeemed Promo Codes ({inspectData.redeemCodes?.length || 0})</h4>
                        {inspectData.redeemCodes?.length === 0 ? (
                          <p className="text-xs text-slate-500">No promo codes redeemed by this candidate.</p>
                        ) : (
                          <div className="space-y-2">
                            {inspectData.redeemCodes.map((c: any) => (
                              <div key={c._id} className="p-3 rounded-xl bg-card/60 border border-card-border text-xs flex items-center justify-between font-mono">
                                <div>
                                  <span className="font-bold text-amber-600 dark:text-amber-300">{c.code}</span>
                                  <span className="text-[10px] text-muted-foreground ml-2">Batch: {c.batchName} ({c.durationDays} Days)</span>
                                </div>
                                <span className="text-[10px] text-slate-500">Created By: {c.createdBy}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Launch Event Claims */}
                      <div className="glass-panel p-5 rounded-2xl border border-card-border space-y-3">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Claimed Launch Events ({inspectData.claimedEvents?.length || 0})</h4>
                        {inspectData.claimedEvents?.length === 0 ? (
                          <p className="text-xs text-slate-500">No launch events claimed by this candidate.</p>
                        ) : (
                          <div className="space-y-2">
                            {inspectData.claimedEvents.map((ev: any) => (
                              <div key={ev._id} className="p-3 rounded-xl bg-card/60 border border-card-border text-xs flex items-center justify-between">
                                <span className="font-bold text-foreground">{ev.title} ({ev.durationDays} Days)</span>
                                <span className="text-[10px] text-slate-500 font-mono">Created By: {ev.createdBy}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* TAB 5: RAW MONGODB JSON DUMP */}
                  {inspectActiveTab === 'raw_json' && (
                    <div className="space-y-4">
                      <p className="text-xs text-muted-foreground">
                        Below is the raw, unedited MongoDB JSON dump for candidate <span className="text-emerald-600 dark:text-emerald-400 font-mono">{inspectingUserEmail}</span> across all 9 database collections.
                      </p>
                      <pre className="p-4 rounded-2xl bg-card/90 border border-card-border text-emerald-600 dark:text-emerald-300 font-mono text-[11px] overflow-x-auto max-h-[500px]">
                        {JSON.stringify(inspectData, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-6">
          <div className="glass-panel rounded-3xl p-6 border border-card-border space-y-4">
            <div>
              <h2 className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2">
                <ShieldAlert className="w-5 h-5 text-amber-500" />
                <span>Question Reports</span>
              </h2>
              <p className="text-xs text-muted-foreground mt-1">Review and resolve issues reported by students in quizzes.</p>
            </div>
            
            <div className="pt-4">
              <ReportListClient initialReports={reports} />
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
