import React, { useEffect, useMemo, useRef, useState } from 'react';
import { apiCreateNews, apiListNews } from '../utils/api';
import { Calendar, Clock, Image as ImageIcon, Search, Upload, User } from 'lucide-react';

function NewsForm({ onCreated }) {
  const [values, setValues] = useState({
    title: '', content: '', category: 'general', location: '', eventDate: '', tags: ''
  });
  const [images, setImages] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setValues(v => ({ ...v, [name]: value }));
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
      if (values.tags) {
        fd.set('tags', values.tags);
      }
      images.forEach((f) => fd.append('newsImages', f));
      const res = await apiCreateNews(fd);
      if (res?.success) {
        setValues({ title: '', content: '', category: 'general', location: '', eventDate: '', tags: '' });
        setImages([]);
        onCreated?.(res.news);
      } else {
        const msg = (res && (res.message || res.error)) ? String(res.message || res.error) : 'Failed to create news';
        alert(msg);
      }
    } catch (err) {
      console.error('Create news failed', err);
      const msg = err?.response?.data?.message || err?.response?.data?.error || err?.message || 'Failed to create news';
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 overflow-hidden">
      <div className="bg-gradient-to-r from-amber-500 to-orange-500 p-4 text-white">
        <h2 className="text-lg font-semibold">Share Family News</h2>
      </div>
      <form onSubmit={handleSubmit} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Title</label>
          <input name="title" value={values.title} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" required />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm text-gray-700 mb-1">Story</label>
          <textarea name="content" value={values.content} onChange={handleChange} rows={4} className="w-full rounded-lg border border-amber-200 px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Category</label>
          <select name="category" value={values.category} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2">
            {['general','celebration','achievement','announcement','tradition','milestone','reunion','memory'].map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Event Date</label>
          <input type="date" name="eventDate" value={values.eventDate} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Location</label>
          <input name="location" value={values.location} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm text-gray-700 mb-1">Tags (comma separated)</label>
          <input name="tags" value={values.tags} onChange={handleChange} className="w-full rounded-lg border border-amber-200 px-3 py-2" placeholder="wedding, celebration"/>
        </div>

        <div className="md:col-span-2 pt-1">
          <label className="block text-sm text-gray-700 mb-2">Photos</label>
          <div className="rounded-lg border-2 border-dashed border-amber-200 p-4 bg-amber-50">
            <div className="flex items-center gap-3">
              <button type="button" className="inline-flex items-center px-3 py-2 rounded-lg bg-white border border-amber-200 shadow text-amber-700" onClick={() => fileRef.current?.click()}>
                <Upload size={16} className="mr-2"/> Upload images
              </button>
              <input multiple ref={fileRef} onChange={e => onFiles(e.target.files)} className="hidden" type="file" accept="image/*"/>
              <span className="text-sm text-amber-700">PNG, JPG up to a few MB</span>
            </div>
            {images.length>0 && (
              <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
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
        <div className="md:col-span-2 flex justify-end">
          <button disabled={submitting} className="px-6 py-2 rounded-lg bg-amber-600 text-white font-semibold hover:bg-amber-700 shadow">
            {submitting ? 'Saving...' : 'Publish News'}
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
        <img src={src} alt="news" className="w-full max-h-[80vh] object-contain rounded-xl shadow-2xl"/>
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

function NewsCard({ item, fallbackAuthor }) {
  const cover = item.newsImages && item.newsImages[0] ? `data:${item.newsImages[0].mimeType};base64,${item.newsImages[0].data}` : null;
  const [showGallery, setShowGallery] = useState(false);
  const when = item.eventDate ? new Date(item.eventDate) : (item.createdAt ? new Date(item.createdAt) : null);
  const rel = React.useMemo(() => {
    if (!when) return '';
    const diff = Date.now() - when.getTime();
    const d = Math.floor(diff / (1000*60*60*24));
    if (d <= 0) return 'today';
    if (d === 1) return '1 day ago';
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d/7); return w === 1 ? '1 week ago' : `${w} weeks ago`;
  }, [when]);
  return (
    <div className="bg-white rounded-2xl shadow-md border border-amber-200 overflow-hidden hover:shadow-lg transition">
      {cover ? <img alt={item.title} src={cover} onClick={()=>setShowGallery(true)} className="w-full h-56 object-cover cursor-pointer hover:opacity-95"/> : (
        <div className="w-full h-56 flex items-center justify-center bg-amber-50 text-amber-600"><ImageIcon/></div>
      )}
      <div className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <span className="inline-flex items-center px-2 py-0.5 text-xs rounded-full bg-amber-100 text-amber-700 border border-amber-200">{item.category || 'general'}</span>
        </div>
        <h3 className="text-xl font-extrabold text-amber-900 mb-1 line-clamp-1">{item.title}</h3>
        {item.content && <p className="text-amber-800 mb-2 line-clamp-2">{item.content}</p>}
        <div className="flex items-center text-amber-700 text-sm mb-2">
          <Calendar size={16} className="mr-2"/>{item.eventDate?.slice?.(0,10) || item.createdAt?.slice?.(0,10)}
        </div>
        <div className="mt-3 flex items-center gap-3 text-sm text-gray-900">
          <User size={16} className="text-amber-600"/>
          <span>{item.createdByName || fallbackAuthor || 'Member'}</span>
          {rel && (<span className="inline-flex items-center gap-1"><Clock size={14}/>{rel}</span>)}
        </div>
      </div>
      {showGallery && <GalleryModal images={item.newsImages || []} onClose={()=>setShowGallery(false)} />}
    </div>
  );
}

export default function GogteNewsPage() {
  const [news, setNews] = useState([]);
  const [authed, setAuthed] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('All');
  const [authorDisplayName, setAuthorDisplayName] = useState('Member');

  useEffect(() => {
    const t = localStorage.getItem('authToken');
    setAuthed(!!(t && t !== 'undefined' && t !== 'null'));
    apiListNews().then(d => setNews(d.news || [])).catch(()=>{});
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
        }
      } catch {}
    }
    loadName();
  }, [authed]);

  const filtered = useMemo(() => {
    return news.filter(n => {
      const q = search.trim().toLowerCase();
      const matchesQ = !q || [n.title, n.content, n.location, n.category].filter(Boolean).some(v => String(v).toLowerCase().includes(q));
      const matchesCat = category==='All' || (n.category||'').toLowerCase()===category.toLowerCase();
      return matchesQ && matchesCat;
    });
  }, [news, search, category]);

  return (
    <div className="px-4 py-8 max-w-6xl mx-auto space-y-8">
      <div className="rounded-2xl bg-gradient-to-br from-amber-500 to-orange-500 text-white p-6 shadow flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold">News</h1>
          <p className="opacity-90 mt-1">Family stories, milestones, and announcements.</p>
        </div>
        {authed && (
          <button onClick={()=>setShowForm(true)} className="self-start md:self-auto inline-flex items-center px-4 py-2 bg-white/90 text-amber-700 rounded-lg font-semibold shadow hover:bg-white">
            + Add News
          </button>
        )}
      </div>

      <div className="bg-white rounded-2xl border border-amber-200 shadow p-4 flex flex-col md:flex-row gap-3 md:items-center md:justify-between">
        <div className="relative w-full md:max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-amber-500" size={18}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search news..." className="w-full rounded-lg border border-amber-200 px-9 py-2"/>
        </div>
        <div>
          <select value={category} onChange={e=>setCategory(e.target.value)} className="rounded-lg border border-amber-200 px-3 py-2">
            {['All','general','celebration','achievement','announcement','tradition','milestone','reunion','memory'].map(o=> <option key={o}>{o}</option>)}
          </select>
        </div>
      </div>

      {showForm && authed && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 p-4">
          <div className="relative max-w-3xl w-full max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl ring-1 ring-amber-200">
            <div className="sticky top-0 z-10 flex items-center justify-between px-6 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-t-2xl shadow">
              <div className="inline-flex items-center gap-2"><span className="font-semibold">Add News</span></div>
              <button onClick={()=>setShowForm(false)} className="px-3 py-1 bg-white/20 rounded-lg hover:bg-white/30">Close</button>
            </div>
            <div className="p-4">
              <NewsForm onCreated={(it)=> { it.createdByName = it.createdByName || authorDisplayName; setNews(prev => [it, ...prev]); setShowForm(false); }}/>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {filtered.map(item => <div key={item._id || item.title} className="space-y-2">
          <NewsCard item={item} fallbackAuthor={authorDisplayName} />
          <div className="text-sm text-gray-900 bg-white/90 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-amber-200 shadow-sm">
            <User size={14} className="text-amber-600"/> <span>Added by <strong className="font-semibold">{item.createdByName || authorDisplayName || 'Member'}</strong></span>
          </div>
        </div>)}
      </div>
    </div>
  );
}
