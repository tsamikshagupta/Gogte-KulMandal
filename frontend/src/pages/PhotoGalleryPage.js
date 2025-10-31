import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Filter, Search, Calendar, RefreshCw, User, Clock, Heart, MessageCircle, X, Camera, MapPin, Tag, Plus, ArrowLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { AddPhotoModal } from './AddPhotoModal';
import Footer from '../components/Footer';
import { apiCreatePhoto, apiListPhotos } from '../utils/api';

export default function PhotoGalleryPage() {
  const { t } = useTranslation();

  const [photos, setPhotos] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [currentPhotoIndex, setCurrentPhotoIndex] = useState(0);
  const [isGalleryMode, setIsGalleryMode] = useState(false);
  const [currentGalleryPhotos, setCurrentGalleryPhotos] = useState([]);

  // Load photos from backend
  useEffect(() => {
    refreshPhotos();
  }, []);

  function relative(ts) {
    if (!ts) return '';
    const dt = new Date(ts);
    if (isNaN(dt)) return '';
    const diff = Date.now() - dt.getTime();
    const d = Math.floor(diff/86400000);
    if (d <= 0) return 'today';
    if (d === 1) return '1 day ago';
    if (d < 7) return `${d} days ago`;
    const w = Math.floor(d/7); return w===1? '1 week ago' : `${w} weeks ago`;
  }

  async function refreshPhotos() {
    try {
      const d = await apiListPhotos();
      const list = Array.isArray(d.photos) ? d.photos : [];
      const mapped = list.map((p) => {
        const urls = Array.isArray(p.imageUrls) ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : []);
        return {
          id: p._id || p.id || p.title,
          title: p.title || 'Photo',
          description: p.description || '',
          category: p.category || 'general',
          photographer: p.createdByName || 'Member',
          location: p.location || '',
          eventDate: p.eventDate || p.createdAt,
          tags: p.tags || [],
          timestamp: relative(p.createdAt),
          likes: p.likes || 0,
          comments: p.comments || 0,
          imageUrl: urls[0] || '',
          imageUrls: urls,
          isCollection: urls.length > 1,
          photoCount: urls.length || 1,
        };
      });
      setPhotos(mapped);
    } catch (_) {}
  }

  const categories = [
    { value: 'all', label: 'All Categories' },
    { value: 'heritage', label: 'Heritage' },
    { value: 'celebration', label: 'Celebration' },
    { value: 'wedding', label: 'Wedding' },
    { value: 'festival', label: 'Festival' },
    { value: 'family', label: 'Family Gathering' },
    { value: 'achievement', label: 'Achievement' },
    { value: 'memory', label: 'Memory' },
    { value: 'general', label: 'General' }
  ];

  const filteredPhotos = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return photos.filter(p => {
      const matchesCat = selectedCategory === 'all' || (p.category||'').toLowerCase() === selectedCategory;
      const src = [p.title, p.description, p.location, ...(p.tags||[])].filter(Boolean).map(v => String(v).toLowerCase());
      const matchesQ = !q || src.some(v => v.includes(q));
      return matchesCat && matchesQ;
    });
  }, [photos, selectedCategory, searchTerm]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshPhotos();
    setIsRefreshing(false);
  };

  const handleAddPhoto = async (newPhoto) => {
    try {
      const fd = new FormData();
      ['title','description','category','location','eventDate'].forEach(k => { if (newPhoto[k]) fd.append(k, newPhoto[k]); });
      if (Array.isArray(newPhoto.tags)) fd.append('tags', newPhoto.tags.join(','));
      if (Array.isArray(newPhoto.uploadedImages) && newPhoto.uploadedImages.length > 0) {
        newPhoto.uploadedImages.forEach((f) => fd.append('photoImages', f));
      } else if (newPhoto.imageUrl) {
        fd.append('imageUrl', newPhoto.imageUrl);
      }
      const res = await apiCreatePhoto(fd);
      if (res?.success) {
        await refreshPhotos();
      } else {
        alert(res?.error || 'Failed to add photo');
      }
    } catch (e) {
      alert(e?.response?.data?.error || e?.message || 'Failed to add photo');
    }
  };

  const handlePhotoClick = (photoItem) => {
    const gallery = (photoItem.imageUrls && photoItem.imageUrls.length>0)
      ? photoItem.imageUrls.map((u, idx) => ({ id: `${photoItem.id}_${idx}`, imageUrl: u, title: photoItem.title, description: photoItem.description, ...photoItem }))
      : [photoItem];
    setCurrentGalleryPhotos(gallery);
    setCurrentPhotoIndex(0);
    setSelectedPhoto(gallery[0]);
    setIsGalleryMode(gallery.length > 1);
    setShowDetailModal(true);
  };

  const handleNextPhoto = () => {
    const nextIndex = (currentPhotoIndex + 1) % currentGalleryPhotos.length;
    setCurrentPhotoIndex(nextIndex);
    setSelectedPhoto(currentGalleryPhotos[nextIndex]);
  };

  const handlePrevPhoto = () => {
    const prevIndex = (currentPhotoIndex - 1 + currentGalleryPhotos.length) % currentGalleryPhotos.length;
    setCurrentPhotoIndex(prevIndex);
    setSelectedPhoto(currentGalleryPhotos[prevIndex]);
  };

  const handleCloseModal = () => {
    setShowDetailModal(false);
    setIsGalleryMode(false);
    setCurrentGalleryPhotos([]);
    setSelectedPhoto(null);
    setCurrentPhotoIndex(0);
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showDetailModal && isGalleryMode) {
        if (e.key === 'ArrowRight') handleNextPhoto();
        else if (e.key === 'ArrowLeft') handlePrevPhoto();
        else if (e.key === 'Escape') handleCloseModal();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [showDetailModal, isGalleryMode, currentPhotoIndex, filteredPhotos]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 to-orange-100">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-orange-200">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div className="flex items-center gap-3">
              <Link to="/dashboard" className="inline-flex items-center px-3 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 transition-colors">
                <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-amber-800">Photo Gallery</h1>
            </div>
            <div className="flex items-center gap-4">
              <button onClick={handleRefresh} disabled={isRefreshing} className="inline-flex items-center px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
                <RefreshCw className={`w-4 h-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
                {isRefreshing ? 'Refreshing...' : 'Refresh'}
              </button>
              <AddPhotoModal onAddPhoto={handleAddPhoto} />
            </div>
          </div>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <div className="bg-white rounded-xl shadow-sm border border-orange-200 p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5" />
                <input type="text" placeholder="Search photos..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent" />
              </div>
            </div>
            <div className="lg:w-64">
              <div className="relative">
                <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-amber-500 w-5 h-5" />
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)} className="w-full pl-10 pr-4 py-2 border border-orange-200 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-transparent appearance-none bg-white">
                  {categories.map(category => (
                    <option key={category.value} value={category.value}>{category.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-lg p-4 shadow-sm border border-orange-200">
            <div className="flex items-center">
              <Camera className="w-8 h-8 text-amber-500 mr-3" />
              <div>
                <p className="text-sm text-amber-700">Total Photos</p>
                <p className="text-2xl font-bold text-amber-800">{photos.length}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-lg p-4 shadow-sm border border-orange-200">
            <div className="flex items-center">
              <Filter className="w-8 h-8 text-amber-500 mr-3" />
              <div>
                <p className="text-sm text-amber-700">Categories</p>
                <p className="text-2xl font-bold text-amber-800">{categories.length - 1}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Photo Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredPhotos.length > 0 ? (
            filteredPhotos.map(photoItem => (
              <div key={photoItem.id} onClick={() => handlePhotoClick(photoItem)} className="bg-white rounded-xl shadow-sm border border-orange-200 overflow-hidden cursor-pointer hover:shadow-lg transition-shadow duration-300">
                <div className="aspect-video bg-gradient-to-br from-amber-100 to-orange-200 relative">
                  {photoItem.imageUrl ? (
                    <img src={photoItem.imageUrl} alt={photoItem.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="w-16 h-16 bg-amber-200 rounded-full flex items-center justify-center mx-auto mb-2">
                          <Camera className="w-8 h-8 text-amber-600" />
                        </div>
                        <p className="text-amber-600 font-medium">No Image</p>
                      </div>
                    </div>
                  )}
                  <div className="absolute top-3 left-3">
                    <span className="bg-amber-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                      {categories.find(cat => cat.value === photoItem.category)?.label || photoItem.category}
                    </span>
                  </div>
                  {photoItem.isCollection && photoItem.photoCount > 1 && (
                    <div className="absolute top-3 right-3">
                      <span className="bg-orange-500 text-white px-3 py-1 rounded-full text-sm font-medium">
                        {photoItem.photoCount} photos
                      </span>
                    </div>
                  )}
                </div>
                <div className="p-6">
                  <h3 className="text-xl font-bold text-amber-800 mb-2 line-clamp-2">{photoItem.title}</h3>
                  <p className="text-amber-700 mb-4 line-clamp-3">{photoItem.description}</p>
                  <div className="flex items-center justify-between text-sm text-amber-600">
                    <div className="flex items-center space-x-4">
                      <span className="flex items-center"><User className="w-4 h-4 mr-1" />{photoItem.photographer}</span>
                      <span className="flex items-center"><Clock className="w-4 h-4 mr-1" />{photoItem.timestamp}</span>
                    </div>
                    <div className="flex items-center space-x-3">
                      <span className="flex items-center"><Heart className="w-4 h-4 mr-1" />{photoItem.likes}</span>
                      <span className="flex items-center"><MessageCircle className="w-4 h-4 mr-1" />{photoItem.comments}</span>
                    </div>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="col-span-full bg-white rounded-xl shadow-sm border border-orange-200 p-12 text-center">
              <div className="text-amber-500 mb-4"><Camera className="w-16 h-16 mx-auto" /></div>
              <h3 className="text-xl font-semibold text-amber-800 mb-2">No Photos Found</h3>
              <p className="text-amber-700">Try adjusting your filters or add new photos.</p>
            </div>
          )}
        </div>
      </div>

      {/* Photo Detail Modal */}
      {showDetailModal && selectedPhoto && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-5xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between p-4 border-b border-orange-200 sticky top-0 bg-white">
              <div className="flex items-center gap-2">
                <button onClick={handleCloseModal} className="px-2 py-1 rounded hover:bg-amber-100"><X className="w-6 h-6 text-amber-600"/></button>
                <h2 className="text-2xl font-bold text-amber-800">{selectedPhoto.title}</h2>
              </div>
              {isGalleryMode && (
                <div className="flex items-center gap-2">
                  <button onClick={handlePrevPhoto} className="px-3 py-1 bg-amber-500 text-white rounded">Prev</button>
                  <button onClick={handleNextPhoto} className="px-3 py-1 bg-amber-500 text-white rounded">Next</button>
                </div>
              )}
            </div>
            <div className="p-6">
              <div className="aspect-video bg-gradient-to-br from-amber-100 to-orange-200 rounded-lg mb-6 overflow-hidden">
                {selectedPhoto.imageUrl ? (
                  <img src={selectedPhoto.imageUrl} alt={selectedPhoto.title} className="w-full h-full object-contain" />
                ) : (
                  <div className="flex items-center justify-center h-full text-amber-600"><Camera className="w-10 h-10"/></div>
                )}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="md:col-span-2">
                  <h3 className="text-lg font-semibold text-amber-800 mb-3">Description</h3>
                  <p className="text-amber-700 leading-relaxed text-sm">{selectedPhoto.description}</p>
                </div>
                <div>
                  <div className="space-y-2 text-sm text-amber-700">
                    {selectedPhoto.photographer && (<div className="flex items-center"><User className="w-4 h-4 mr-2"/><span>{selectedPhoto.photographer}</span></div>)}
                    {selectedPhoto.location && (<div className="flex items-center"><MapPin className="w-4 h-4 mr-2"/><span>{selectedPhoto.location}</span></div>)}
                    {selectedPhoto.eventDate && (<div className="flex items-center"><Calendar className="w-4 h-4 mr-2"/><span>{new Date(selectedPhoto.eventDate).toLocaleDateString()}</span></div>)}
                    {selectedPhoto.tags && selectedPhoto.tags.length>0 && (
                      <div className="flex items-center gap-2 flex-wrap">
                        <Tag className="w-4 h-4"/>
                        {selectedPhoto.tags.map((t, i) => (<span key={i} className="bg-amber-100 text-amber-700 px-2 py-1 rounded-full text-xs">#{t}</span>))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
              {currentGalleryPhotos.length > 1 && (
                <div className="mt-6 border-t border-orange-200 pt-4">
                  <h3 className="text-lg font-semibold text-amber-800 mb-3">All Photos</h3>
                  <div className="grid grid-cols-3 gap-2 max-h-48 overflow-y-auto">
                    {currentGalleryPhotos.map((p, idx) => (
                      <div key={p.id} onClick={()=>{ setCurrentPhotoIndex(idx); setSelectedPhoto(p); }} className={`relative cursor-pointer rounded-lg overflow-hidden transition ${idx===currentPhotoIndex?'ring-2 ring-amber-500':'hover:opacity-90'}`}>
                        <img src={p.imageUrl} alt={p.title} className="w-full h-20 object-cover"/>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}
