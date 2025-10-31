import React, { useState, useEffect, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import PhotoScroller from '../components/PhotoScroller';
import Footer from '../components/Footer';
import Profile from './Profile';
import { apiListEvents, apiListNews } from '../utils/api';
import {
  Users,
  Newspaper,
  Calendar,
  User,
  TrendingUp,
  Clock,
  Heart,
  MessageCircle,
  GitBranch,
  Link as LinkIcon,
  ExternalLink,
  Sparkles,
  Shield,
  Star
} from 'lucide-react';


// Small helper for accent ring without changing primary palette
const Card = ({ children, className = '' }) => (
  <div className={`relative bg-white rounded-2xl shadow-md border border-gray-200 ${className}`}>
    <div className="absolute inset-0 rounded-2xl pointer-events-none" style={{
      background: 'linear-gradient(135deg, rgba(251,146,60,0.15), rgba(107,114,128,0.15))',
      mask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
      WebkitMask: 'linear-gradient(#000, #000) content-box, linear-gradient(#000, #000)',
      padding: '1px'
    }}></div>
    <div className="relative z-10">{children}</div>
  </div>
);

const Dashboard = () => {
  const navigate = useNavigate();
  // User state for display purposes
  const [displayName, setDisplayName] = useState('User');

  useEffect(() => {
    function getNameFromStorage() {
      try {
        const raw = localStorage.getItem('currentUser');
        if (!raw) return '';
        const u = JSON.parse(raw);
        // Prefer nested personalDetails
        const pd = u?.personalDetails || {};
        const namePD = [pd.firstName, pd.middleName, pd.lastName].filter(Boolean).join(' ').trim();
        if (namePD) return namePD;
        const name = [u?.firstName, u?.middleName, u?.lastName].filter(Boolean).join(' ').trim();
        if (name) return name;
        if (u?.name) {
          const n = String(u.name).trim();
          if (!n.includes('@')) return n;
        }
        if (u?.username) return String(u.username).trim();
        // Avoid falling back to email for display
        return '';
      } catch (_) {
        return '';
      }
    }

    async function fetchUser() {
      const token = localStorage.getItem('authToken');
      if (!token || token === 'undefined' || token === 'null') {
        const nm = getNameFromStorage();
        setDisplayName(nm || 'User');
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { Authorization: `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          const fromApi = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ').trim() || (data.name && !String(data.name).includes('@') ? String(data.name).trim() : '');
          const name = fromApi || getNameFromStorage();
          setDisplayName(name || 'User');
        } else {
          const nm = getNameFromStorage();
          setDisplayName(nm || 'User');
        }
      } catch (e) {
        const nm = getNameFromStorage();
        setDisplayName(nm || 'User');
      }
    }
    fetchUser();
  }, []);
  const [activeTreeTab, setActiveTreeTab] = useState('interactive');
  const [showProfile, setShowProfile] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);

  // Live data states
  const [membersCount, setMembersCount] = useState(0);
  const [membersSample, setMembersSample] = useState([]);
  const [newsItems, setNewsItems] = useState([]);
  const [eventItems, setEventItems] = useState([]);

  useEffect(() => {
    // Load news and events from backend
    apiListNews().then(d => setNewsItems(Array.isArray(d.news) ? d.news : [] )).catch(() => {});
    apiListEvents().then(d => setEventItems(Array.isArray(d.events) ? d.events : [] )).catch(() => {});
    // Load members count (public endpoint returns all members)
    fetch('/api/family/members-new')
      .then(r => r.ok ? r.json() : [])
      .then(arr => {
        const list = Array.isArray(arr) ? arr : (Array.isArray(arr.members) ? arr.members : []);
        setMembersCount(list.length || 0);
        // Build a tiny sample of display names
        const sample = list.slice(0,5).map(m => {
          const p = m.personalDetails || {};
          const name = [p.firstName || m.firstName || m.FirstName, p.middleName || m.middleName || m.MiddleName, p.lastName || m.lastName || m.LastName].filter(Boolean).join(' ').trim();
          return name || (m.name && !String(m.name).includes('@') ? String(m.name) : 'Member');
        });
        setMembersSample(sample);
      })
      .catch(() => {});
  }, []);

  const quickStats = useMemo(() => {
    // Simple derived values for dashboard tiles
    const today = new Date();
    const upcomingCount = eventItems.filter(ev => {
      const d = ev.fromDate || ev.eventDate || ev.createdAt;
      if (!d) return false;
      const dt = new Date(d);
      return !isNaN(dt) && dt >= today;
    }).length;
    return [
      { title: 'Family Members', value: String(membersCount || 0), icon: Users, tint: 'bg-orange-100 text-orange-600', chip: '' },
      { title: 'Recent News', value: String(newsItems.length || 0), icon: Newspaper, tint: 'bg-emerald-100 text-emerald-600', chip: '' },
      { title: 'Upcoming Events', value: String(upcomingCount || eventItems.length || 0), icon: Calendar, tint: 'bg-violet-100 text-violet-600', chip: '' },
      { title: 'New Photos/albums', value: '—', icon: TrendingUp, tint: 'bg-amber-100 text-amber-700', chip: '' },
    ];
  }, [membersCount, newsItems, eventItems]);

  // Derive lists for cards
  const recentNews = useMemo(() => {
    const rel = (d) => {
      if (!d) return '';
      const dt = new Date(d);
      if (isNaN(dt)) return '';
      const diff = Date.now() - dt.getTime();
      const days = Math.floor(diff/86400000);
      if (days <= 0) return 'today'; if (days===1) return '1 day ago'; if (days<7) return `${days} days ago`; const w=Math.floor(days/7); return w===1?'1 week ago':`${w} weeks ago`;
    };
    return (newsItems || []).slice(0,3).map(n => ({
      id: n._id || n.id || n.title,
      title: n.title || 'News',
      summary: (n.content || '').slice(0,120) + ((n.content||'').length>120?'…':''),
      author: n.createdByName || 'Member',
      date: rel(n.eventDate || n.createdAt),
      likes: n.likes || 0,
      comments: n.comments || 0,
    }));
  }, [newsItems]);

  const upcomingEvents = useMemo(() => {
    const fmtDate = (d) => {
      if (!d) return '';
      try { return new Date(d).toDateString(); } catch { return String(d); }
    };
    return (eventItems || [])
      .sort((a,b)=> new Date(a.fromDate||a.createdAt||0)-new Date(b.fromDate||b.createdAt||0))
      .slice(0,3)
      .map(e => ({
        id: e._id || e.title,
        title: e.title || 'Event',
        date: fmtDate(e.fromDate || e.createdAt),
        time: e.fromTime || '',
        location: [e.venue, e.city].filter(Boolean).join(', '),
        attendees: e.attendees || e.expectedAttendees || 0,
      }));
  }, [eventItems]);

  return (
  <div className="space-y-8 xs:space-y-12" style={{ fontFamily: 'Montserrat, sans-serif' }}>
      {/* Orange Bar with Profile and Logout */}
      <div className="relative overflow-hidden rounded-2xl shadow-lg">
        <div className="absolute inset-0 bg-gradient-to-br from-amber-100 to-amber-200 opacity-30" />
        <div className="relative bg-gradient-to-r from-amber-500/95 to-orange-400/95 sm:to-amber-600/90 rounded-2xl p-6 xs:p-8 sm:p-12 text-white flex flex-col sm:flex-row items-center justify-between gap-6">
          <div>
            <div className="inline-flex items-center px-3 py-1 rounded-full bg-white/20 text-white text-xs font-semibold mb-3 tracking-wide">
              <Sparkles size={16} className="mr-2" /> Welcome back, {displayName}!
            </div>
            <h1 className="text-3xl xs:text-4xl sm:text-5xl font-extrabold tracking-tight drop-shadow-lg">
              {displayName ? `Hi, ${displayName}!` : 'Welcome!'}
            </h1>
            <p className="text-amber-50/90 text-lg xs:text-xl sm:text-2xl mt-2 font-medium">
              This is your personalized family dashboard. Explore news, events, and more tailored for you.
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-white/25 font-semibold">
                <Shield size={16} className="mr-2" /> Secure Space
              </div>
              <div className="inline-flex items-center text-sm px-3 py-1 rounded-full bg-white/25 font-semibold">
                <Star size={16} className="mr-2" /> Family First
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-3">
            <button
              className="bg-white/20 rounded-full p-3 border-2 border-white/40 hover:bg-white/30 transition"
              onClick={() => setShowProfile(true)}
              aria-label="View Profile"
            >
              <User size={36} className="text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 xs:grid-cols-2 lg:grid-cols-4 gap-6">
        {quickStats.map((stat) => (
          <Card key={stat.title} className="bg-amber-50 border-amber-200">
            <div className="p-6 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-amber-700 mb-1">{stat.title}</p>
                <p className="text-3xl font-extrabold text-amber-900 tracking-tight">{stat.value}</p>
                <span className="inline-flex mt-2 text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 border-amber-200 font-medium">{stat.chip}</span>
              </div>
              <div className="bg-amber-200 text-amber-700 rounded-xl p-3 shadow">
                <stat.icon size={28} className="w-7 h-7" />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Family Tree Section (enlarged, no tree, info + button, vertical list) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 xs:gap-8">
        {/* Family Tree Info Card */}
        <Card className="md:col-span-2 flex flex-col justify-between min-h-[300px]">
          <div className="p-6 flex flex-col h-full justify-center">
            <div className="flex items-center mb-4">
              <GitBranch className="mr-2 text-orange-600" size={28} />
              <h2 className="text-2xl font-bold text-gray-900">Family Tree</h2>
            </div>
            <p className="text-gray-700 text-lg mb-6">Explore your family lineage, relationships, and history. View the full Kulavruksh for a detailed tree and connections.</p>
            <button
              className="inline-block bg-orange-600 hover:bg-orange-700 text-white font-semibold px-6 py-3 rounded-lg text-lg shadow transition"
              onClick={() => window.location.href = '/kulavruksh'}
            >
              View Family Tree
            </button>
          </div>
        </Card>
        {/* Vertical Family Members List */}
        <Card className="flex flex-col min-h-[300px] p-0">
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center">
              <Users className="mr-2 text-orange-600" size={20} /> Family Members
            </h3>
          </div>
          <div className="p-4 overflow-y-auto max-h-[260px]">
            <ul className="space-y-3">
              {membersSample.length > 0 ? (
                membersSample.map((name, idx) => (
                  <li key={idx} className="flex items-center gap-3">
                    <User className="text-orange-500" size={20} /> {name}
                  </li>
                ))
              ) : (
                <li className="text-amber-700 text-sm">Loading members…</li>
              )}
            </ul>
          </div>
        </Card>
      </div>

  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Announcements & Updates */}
        <Card className="bg-amber-50 border-amber-200">
          <div className="p-6 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-900 flex items-center">
                <Newspaper className="mr-2 text-amber-600" size={24} />
                <span>Announcements & Updates</span>
              </h2>
              <Link to="/gogte-news" className="text-amber-600 hover:text-amber-800 text-sm font-semibold">View All</Link>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-5">
              {recentNews.map((news) => (
                <div key={news.id} className="border border-amber-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-white mb-5 last:mb-0 last:border-b-0">
                  <h3 className="font-bold text-amber-900 mb-2 hover:text-amber-600 cursor-pointer text-lg">{news.title}</h3>
                  <p className="text-amber-800 text-base mb-2">{news.summary}</p>
                  <div className="flex items-center justify-between text-xs text-amber-700">
                    <div className="flex items-center space-x-4">
                      <span>By {news.author}</span>
                      <span className="flex items-center"><Clock size={14} className="mr-1" />{news.date}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center"><Heart size={14} className="mr-1" />{news.likes}</span>
                      <span className="flex items-center"><MessageCircle size={14} className="mr-1" />{news.comments}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>

        {/* Upcoming Events (moved next to Announcements & Updates) */}
        <Card className="bg-amber-50 border-amber-200">
          <div className="p-6 border-b border-amber-100">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-amber-900 flex items-center">
                <Calendar className="mr-2 text-amber-600" size={24} /> Upcoming Events
              </h2>
              <Link to="/gogte-events" className="text-amber-600 hover:text-amber-800 text-sm font-semibold">View All</Link>
            </div>
          </div>
          <div className="p-6">
            <div className="space-y-5">
              {upcomingEvents.map((event) => (
                <div key={event.id} className="border border-amber-200 rounded-xl p-5 hover:shadow-lg transition-shadow bg-white">
                  <h3 className="font-bold text-amber-900 mb-2 text-lg">{event.title}</h3>
                  <div className="space-y-1 text-base text-amber-800">
                    <p className="flex items-center"><Calendar size={16} className="mr-2" />{event.date} at {event.time}</p>
                    <p className="flex items-center"><Users size={16} className="mr-2" />{event.attendees} attending</p>
                  </div>
                  <div className="mt-4">
                    <button className="text-amber-600 hover:text-amber-800 text-base font-semibold" onClick={() => window.location.href = '/gogte-events'}>View Details →</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Card>
      </div>


      {/* PhotoScroller at the end */}
      <div className="mt-8">
        <PhotoScroller />
      </div>

      {/* Footer */}
      <Footer />

      {/* Profile Modal */}
      {showProfile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg max-w-3xl w-full p-6 relative overflow-y-auto max-h-[90vh]">
            <button
              className="absolute top-4 right-4 text-gray-500 hover:text-orange-600 text-2xl font-bold"
              onClick={() => setShowProfile(false)}
              aria-label="Close Profile"
            >
              ×
            </button>
            <Profile />
          </div>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {showLogoutModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-2xl shadow-lg max-w-sm w-full p-6 relative">
            <h2 className="text-xl font-semibold text-gray-900 mb-4">Confirm Logout</h2>
            <p className="text-gray-700 mb-6">Are you sure you want to logout?</p>
            <div className="flex justify-end gap-3">
              <button
                className="px-4 py-2 rounded-lg bg-gray-200 text-gray-700 hover:bg-gray-300"
                onClick={() => setShowLogoutModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 rounded-lg bg-orange-600 text-white hover:bg-orange-700"
                onClick={() => {
                  setShowLogoutModal(false);
                  try {
                    localStorage.removeItem('authToken');
                    localStorage.removeItem('currentUser');
                  } catch (_) {}
                  navigate('/login', { replace: true });
                }}
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      )}
  </div>
  );
};

export default Dashboard;
