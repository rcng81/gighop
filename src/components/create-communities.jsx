import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc } from 'firebase/firestore';
import { availableTags } from '../constants';

const CreateCommunities = () => {
  const navigate = useNavigate();
  const [selectedTags, setSelectedTags] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    description: '',
    privacy: 'public'
  });

  const toggleTag = (tag) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const toggleAllTags = () => {
    if (selectedTags.length === availableTags.length) {
      setSelectedTags([]);
    } else {
      setSelectedTags([...availableTags]);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);

    try {
      const user = auth.currentUser;
      if (!user) return;

      const communityRef = await addDoc(collection(db, "communities"), {
        ...formData,
        tags: selectedTags,
        createdAt: serverTimestamp(),
        ownerId: user.uid
      });
      
      await setDoc(
        doc(db, "users", user.uid, "user_communities", communityRef.id),
        { joinedAt: new Date() }
      );
      

      navigate("/community");
    } catch (err) {
      console.error("Error adding community:", err);
      setLoading(false);
    }
  };

  return (
    <div className="d-flex justify-content-center" style={{ minHeight: '100vh', width: '100vw', padding: '2rem'}} >
      <div className="w-100" style={{ maxWidth: '700px' }}>
        <div className="card shadow p-4">
          <button className="btn btn-link position-absolute top-0 start-0 m-3 text-dark fs-4" onClick={() => navigate('/community')} > × </button>

          <form onSubmit={handleSubmit} className="mt-4">
            <h2 className="text-center mb-4">Create Community</h2>

            <div className="mb-3">
              <label className="form-label">Community Name</label>
              <input 
                type="text" 
                className="form-control" 
                name="name" 
                value={formData.name} 
                onChange={handleChange} 
                placeholder="Enter community name" 
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Location</label>
              <input 
                type="text" 
                className="form-control" 
                name="location" 
                value={formData.location} 
                onChange={handleChange} 
                placeholder="e.g. New York, NY" 
                required 
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Description</label>
              <textarea 
                className="form-control" 
                name="description"
                value={formData.description} 
                onChange={handleChange} rows={3} placeholder="Describe your community.." 
                required
              />
            </div>

            <div className="mb-3">
              <label className="form-label">Tags / Interests</label>
              <div className="d-flex flex-wrap gap-2">
                <button type="button" className={`btn btn-outline-primary ${selectedTags.length === availableTags.length ? 'active' : ''}`} onClick={toggleAllTags}>All</button> 
                {availableTags.map((tag) => (
                  <button
                    type="button"
                    key={tag}
                    className={`btn btn-outline-primary ${selectedTags.includes(tag) ? 'active' : ''}`}
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
            </div>

            <div className="mb-3">
              <label className="form-label d-block">Privacy</label>

              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name="privacy" value="public" checked={formData.privacy === 'public'} onChange={handleChange} />
                <label className="form-check-label">Public</label>
              </div>
              
              <div className="form-check form-check-inline">
                <input className="form-check-input" type="radio" name="privacy" value="private" checked={formData.privacy === 'private'} onChange={handleChange} />
                <label className="form-check-label">Private</label>
              </div>
            </div>

            <div className="d-grid">
              <button type="submit" className="btn btn-primary" disabled={loading}>
                {loading ? "Creating..." : "Create"}
              </button>
            </div>

          </form>
        </div>
      </div>
    </div>
  );
};

export default CreateCommunities;
