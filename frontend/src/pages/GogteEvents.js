import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiCreateEvent, apiListEvents } from '../utils/api';
import { Calendar, Clock, Image as ImageIcon, MapPin, Sparkles, Upload, User } from 'lucide-react';

function EventForm({ onCreated }) {
  const [values, setValues] = useState({
    title: '', description: '', eventType: 'Other',
    fromDate: '', toDate: '', fromTime: '', toTime: '',
    priority: 'Medium',
    venue: '', venueStreet: '', city: '', state: '', pincode: '', country: '', address: '',
    visibleToAllVansh: true, visibleVanshNumbers: ''
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setValues(v => ({ ...v, [name]: type === 'checkbox' ? checked : value }));
  };

  const onFiles = (files) => {
    const arr = Array.from(files || []);
    setImages(prev => [...prev, ...arr]);
  };

  const removeImage = (idx) => setImages(prev => prev.filter((_, i) => i !== idx));

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSubmitting(true);
      const fd = new FormData();
      Object.entries(values).forEach(([k, v]) => {
        if (v !== '' && v !== null && v !== undefined) fd.append(k, v);
      });
      images.forEach((f) => fd.append('eventImages', f));
      const res = await apiCreateEvent(fd);
      if (res?.success) {
        setValues({ title: '', description: '', eventType: 'Other', fromDate: '', toDate: '', fromTime: '', toTime: '', priority: 'Medium', venue: '', venueStreet: '', city: '', state: '', pincode: '', country: '', address: '', visibleToAllVansh: true, visibleVanshNumbers: '' });
        setImages([]);
        onCreated?.(res.event);
      }
    } catch (err) {
      console.error('Create event failed', err);
      alert('Failed to create event');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white flex items-center gap-2">
        <Sparkles size={18} />
        <h2 className="text-lg font-semibold">Create a New Event</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Title</label>
          <input name="title" value={values.title} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Description</label>
          <textarea name="description" value={values.description} onChange={handleChange} rows={3} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Event Type</label>
          <select name="eventType" value={values.eventType} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2">
            {['Other','Festival','Meeting','Birthday','Wedding','Puja'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Priority</label>
          <select name="priority" value={values.priority} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2">
            {['Low','Medium','High'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">From Date</label>
          <input type="date" name="fromDate" value={values.fromDate} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">To Date</label>
          <input type="date" name="toDate" value={values.toDate} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">From Time</label>
          <input type="time" name="fromTime" value={values.fromTime} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">To Time</label>
          <input type="time" name="toTime" value={values.toTime} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div className="md:col-span-2 pt-1">
          <label className="block text-sm text-gray-700 mb-2">Event Photos</label>
          <div className="rounded-lg border-2 border-dashed border-amber-300 p-4 bg-amber-50/40">
            <div className="flex items-center gap-3">
              <button type="button" onClick={() => fileRef.current?.click()} className="inline-flex items-center px-3 py-2 bg-amber-600 text-white rounded-lg shadow hover:bg-amber-700">
                <Upload size={16} className="mr-2"/> Upload Images
              </button>
              <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e)=>onFiles(e.target.files)} className="hidden" />
              <p className="text-sm text-amber-800">PNG/JPG up to a few MB each</p>
            </div>
            {images.length>0 && (
              <div className="mt-3 grid grid-cols-2 md:grid-cols-4 gap-3">
                {images.map((img, i) => (
                  <div key={i} className="relative group">
                    <img src={URL.createObjectURL(img)} alt="preview" className="h-28 w-full object-cover rounded-lg border"/>
                    <button type="button" onClick={()=>removeImage(i)} className="absolute top-1 right-1 bg-white/80 text-red-600 rounded px-2 py-0.5 text-xs opacity-0 group-hover:opacity-100 transition">Remove</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm text-gray-700 mb-1">Venue</label>
            <input name="venue" value={values.venue} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Street</label>
            <input name="venueStreet" value={values.venueStreet} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">City</label>
            <input name="city" value={values.city} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">State</label>
            <input name="state" value={values.state} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Pincode</label>
            <input name="pincode" value={values.pincode} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div>
            <label className="block text-sm text-gray-700 mb-1">Country</label>
            <input name="country" value={values.country} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
          <div className="md:col-span-3">
            <label className="block text-sm text-gray-700 mb-1">Address</label>
            <input name="address" value={values.address} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2"/>
          </div>
        </div>
        <div className="md:col-span-2 grid grid-cols-1 md:grid-cols-3 gap-4 items-center">
          <label className="inline-flex items-center gap-2 text-sm text-gray-700">
            <input type="checkbox" name="visibleToAllVansh" checked={values.visibleToAllVansh} onChange={handleChange}/> Visible to all Vansh
          </label>
          <div className="md:col-span-2">
            <label className="block text-sm text-gray-700 mb-1">Visible Vansh Numbers (comma-separated)</label>
            <input name="visibleVanshNumbers" value={values.visibleVanshNumbers} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" placeholder="e.g. 1, 7, 12"/>
          </div>
        </div>
        <div className="md:col-span-2 flex justify-end">
          <button disabled={submitting} className="px-6 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow">
            {submitting ? 'Saving...' : 'Publish Event'}
          </button>
        </div>
      </form>
    </div>
  );
}

function GalleryModal({ images = [], onClose }) {
  const [idx, setIdx] = useState(0);
  if (!images || images.length === 0) return null;
  const src = `data:${images[idx].mimeType};base64,${images[idx].data}`;
  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-4" onClick={onClose}>
      <div className="relative max-w-4xl w-full" onClick={e=>e.stopPropagation()}>
        <img src={src} alt="event" className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"/>
        {images.length>1 && (
          <div className="flex justify-between mt-3">
            <button className="px-3 py-1 bg-white/80 rounded hover:bg-white" onClick={()=> setIdx((idx-1+images.length)%images.length)}>Prev</button>
            <button className="px-3 py-1 bg-white/80 rounded hover:bg-white" onClick={()=> setIdx((idx+1)%images.length)}>Next</button>
          </div>
        )}
        <button className="absolute top-2 right-2 px-3 py-1 bg-white/80 rounded hover:bg-white" onClick={onClose}>Close</button>
      </div>
    </div>
  );
}

function EventCard({ ev, fallbackAuthor }) {
  const cover = ev.eventImages && ev.eventImages[0] ? `data:${ev.eventImages[0].mimeType};base64,${ev.eventImages[0].data}` : null;
  const [showGallery, setShowGallery] = useState(false);
  const start = ev.fromDate ? new Date(ev.fromDate) : (ev.createdAt ? new Date(ev.createdAt) : null);
  const rel = useMemo(() => {
    if (!start) return '';
    const diff = Date.now() - start.getTime();
    const d = Math.floor(diff / (1000*60*60*24));
    if (d <= 0) return 'today';
    if (d === 1) return '1 day ago';
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d/7); return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }, [start]);
  const typeBadge = (
    <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200">
      {ev.eventType || 'General'}
    </span>
  );
  const priorityBadge = (
    <span className={`inline-flex items-center px-2 py-0.5 text-xs rounded-full border ${ev.priority==='High' ? 'bg-red-100 text-red-700 border-red-200' : ev.priority==='Low' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-amber-100 text-amber-700 border-amber-200'}`}>
      {ev.priority || 'Medium'} Priority
    </span>
  );
  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 overflow-hidden hover:shadow-lg transition">
      {cover ? <img alt={ev.title} src={cover} onClick={()=>setShowGallery(true)} className="w-full h-56 object-cover cursor-pointer hover:opacity-95"/> : (
        <div className="w-full h-56 flex items-center justify-center bg-amber-50 text-amber-600"><ImageIcon/></div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">{typeBadge}{priorityBadge}</div>
        <h3 className="text-xl font-extrabold text-amber-900 mb-1 line-clamp-1">{ev.title}</h3>
        {ev.description && <p className="text-amber-800 mb-2 line-clamp-2">{ev.description}</p>}
        <div className="flex items-center text-amber-700 text-sm mb-2">
          <Calendar size={16} className="mr-2"/>{ev.fromDate?.slice?.(0,10) || ev.createdAt?.slice?.(0,10)} {ev.fromTime ? `• ${ev.fromTime}`: ''}
        </div>
        <div className="flex items-center gap-2 text-sm text-amber-700 mt-3"><MapPin size={16}/><span>{[ev.venue, ev.city, ev.state].filter(Boolean).join(', ')}</span></div>
        <div className="mt-3 flex items-center gap-3 text-sm text-gray-900">
          <User size={16} className="text-amber-600"/>
          <span>{ev.createdByName || fallbackAuthor || 'Member'}</span>
          {rel && (<span className="inline-flex items-center gap-1"><Clock size={14}/>{rel}</span>)}
        </div>
        <div className="mt-4 flex justify-end">
          <button className="px-3 py-1.5 text-sm bg-amber-600 text-white rounded-lg hover:bg-amber-700">Read More</button>
        </div>
      </div>
      {showGallery && <GalleryModal images={ev.eventImages || []} onClose={()=>setShowGallery(false)} />}
    </div>
  );
}

export default function EventsPage() {
  const [events, setEvents] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [authorDisplayName, setAuthorDisplayName] = useState('Member');
  useEffect(() => {
    const t = localStorage.getItem('authToken');
    setAuthed(!!(t && t !== 'undefined' && t !== 'null'));
    apiListEvents().then(d => setEvents(d.events || [])).catch(()=>{});
  }, []);

  useEffect(() => {
    async function loadName() {
      try {
        const token = localStorage.getItem('authToken');
        if (!token || token==='undefined' || token==='null') return;
        const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
        if (res.ok) {
          const data = await res.json();
          const name = [data.firstName, data.middleName, data.lastName].filter(Boolean).join(' ').trim() || (data.name && !String(data.name).includes('@') ? String(data.name).trim() : 'Member');
          if (name) setAuthorDisplayName(name);
        } else {
          // fallback to localStorage currentUser
          try {
            const raw = localStorage.getItem('currentUser');
            if (raw) {
              const u = JSON.parse(raw);
              const pd = u?.personalDetails || {};
              const nm = [pd.firstName, pd.middleName, pd.lastName].filter(Boolean).join(' ').trim() || [u.firstName, u.middleName, u.lastName].filter(Boolean).join(' ').trim() || 'Member';
              setAuthorDisplayName(nm);
            }
          } catch {}
        }
      } catch {}
    }
    loadName();
  }, [authed]);

  const filtered = useMemo(() => {
    return events.filter(e => {
      const q = search.trim().toLowerCase();
      const matchesQ = !q || [e.title, e.description, e.city, e.state, e.venue].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      const matchesType = typeFilter==='All' || (e.eventType||'').toLowerCase()===typeFilter.toLowerCase();
      const matchesPr = priorityFilter==='All' || (e.priority||'').toLowerCase().includes(priorityFilter.toLowerCase());
      return matchesQ && matchesType && matchesPr;
    });
  }, [events, search, typeFilter, priorityFilter]);

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white p-6 shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">Events</h1>
          <p className="opacity-90 mt-1">Announcements, celebrations, gatherings — share your moment with the community.</p>
        </div>
        {authed && (
          <button onClick={()=>setShowForm(true)} className="self-start md:self-auto inline-flex items-center px-4 py-2 bg-white/90 text-amber-700 rounded-lg font-semibold shadow hover:bg-white">
            + Add Event
          </button>
        )}
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-amber-200 shadow p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search events..." className="w-full md:max-w-md rounded-lg border border-amber-200 px-3 py-2"/>
        <div className="flex gap-3">
          <select value={typeFilter} onChange={e=>setTypeFilter(e.target.value)} className="rounded-lg border border-amber-200 px-3 py-2">
            {['All','General','Festival','Meeting','Birthday','Wedding','Puja','Other'].map(o=> <option key={o}>{o}</option>)}
          </select>
          <select value={priorityFilter} onChange={e=>setPriorityFilter(e.target.value)} className="rounded-lg border border-amber-200 px-3 py-2">
            {['All','High','Medium','Low'].map(o=> <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {/* Modal for event form */}
      {showForm && authed && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl ring-1 ring-amber-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-2xl shadow">
              <div className="inline-flex items-center gap-2"><Sparkles size={18}/> <span className="font-semibold">Add Event</span></div>
              <button onClick={()=>setShowForm(false)} className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30">Close</button>
            </div>
            <div className="p-4">
              <EventForm onCreated={(ev)=> { ev.createdByName = ev.createdByName || authorDisplayName; setEvents(prev => [ev, ...prev]); setShowForm(false); }}/>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(ev => <div key={ev._id || ev.title} className="space-y-2">
          <EventCard ev={ev} fallbackAuthor={authorDisplayName} />
          <div className="text-sm text-gray-900 bg-white/90 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
            <User size={14} className="text-amber-600"/> <span>Added by <strong className="font-semibold">{ev.createdByName || authorDisplayName || 'Member'}</strong></span>
          </div>
        </div>)}
      </div>

      {/* Floating add button */}
      {authed && (
        <button onClick={()=>setShowForm(true)} className="fixed bottom-6 right-6 z-30 bg-gradient-to-br from-amber-500 to-orange-600 text-white rounded-full shadow-xl hover:shadow-2xl px-5 py-3 font-semibold">
          + Add Event
        </button>
      )}
    </div>
  );
}
