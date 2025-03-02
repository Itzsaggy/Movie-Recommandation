import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';

function App() {
  const [genre, setGenre] = useState('');
  const [mood, setMood] = useState('');
  const [recommendations, setRecommendations] = useState([]);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const [favorites, setFavorites] = useState([]);
  const [showFavorites, setShowFavorites] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const genres = ['Comedy', 'Action', 'Drama', 'Sci-Fi', 'Romance'];
  const moods = ['happy', 'sad', 'excited', 'calm'];

  // Filter recommendations based on search query
  const filteredRecommendations = recommendations.filter(rec =>
    rec.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setRecommendations([]);
    setLoading(true);

    try {
      const response = await fetch('http://localhost:5000/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ genre, mood }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recommendations');
      }
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  };

  const handleFeedback = async (title, score) => {
    try {
      const response = await fetch('http://localhost:5000/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, score }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Feedback submission failed');
      }
      alert('Feedback submitted!');
    } catch (err) {
      console.error('Feedback error:', err.message);
    }
  };

  const toggleFavorite = async (title, isFavorite) => {
    const action = isFavorite ? 'remove' : 'add';
    try {
      const response = await fetch('http://localhost:5000/favorite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, action }),
      });
      if (!response.ok) {
        throw new Error('Favorite action failed');
      }
      const favoriteResponse = await fetch('http://localhost:5000/favorites');
      if (!favoriteResponse.ok) {
        throw new Error('Failed to fetch favorites');
      }
      const data = await favoriteResponse.json();
      setFavorites(data.favorites || []);
    } catch (err) {
      console.error('Favorite error:', err.message);
    }
  };

  useEffect(() => {
    const fetchFavorites = async () => {
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const response = await fetch('http://localhost:5000/favorites');
          if (response.status === 200) {
            const data = await response.json();
            setFavorites(data.favorites || []);
            break;
          }
        } catch (err) {
          console.error(`Favorites fetch attempt ${attempt + 1} failed:`, err.message);
          if (attempt < 2) await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
    };
    fetchFavorites();

    // Update profile when genre or mood changes
    const updateProfile = async () => {
      try {
        const response = await fetch('http://localhost:5000/profile', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ user_id: 'default', preferred_genres: [genre], mood }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Profile update failed');
        }
        // No need to update state here; backend handles preferences
      } catch (err) {
        console.error('Profile update error:', err.message);
      }
    };
    if (genre || mood) updateProfile();
  }, [genre, mood]); // Trigger on genre or mood change

  const handleClearSearch = () => {
    setSearchQuery('');
  };

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center py-8">
      <motion.h1
        initial={{ opacity: 0, y: -50 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.3 }}
        className="text-4xl font-bold text-gray-800 mb-6"
      >
        Movie Recommender
      </motion.h1>
      <div className="w-full max-w-md mb-4">
        <button
          onClick={() => setShowFavorites(!showFavorites)}
          className="w-full bg-green-500 text-white py-2 rounded-md hover:bg-green-600 transition duration-200 mb-2"
        >
          {showFavorites ? 'Back to Recommendations' : 'View Favorites'}
        </button>
        <div className="w-full max-w-md mb-4 flex space-x-2">
          <input
            type="text"
            placeholder="Search movies..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleClearSearch}
            className="bg-gray-500 text-white py-2 px-4 rounded-md hover:bg-gray-600 transition duration-200"
          >
            Clear
          </button>
        </div>
      </div>
      {!showFavorites && (
        <motion.form
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          onSubmit={handleSubmit}
          className="w-full max-w-md bg-white p-6 rounded-lg shadow-md"
        >
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Genre:</label>
            <select
              value={genre}
              onChange={(e) => setGenre(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a genre</option>
              {genres.map((g) => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
          </div>
          <div className="mb-4">
            <label className="block text-gray-700 font-semibold mb-2">Mood:</label>
            <select
              value={mood}
              onChange={(e) => setMood(e.target.value)}
              className="w-full p-2 border rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Select a mood</option>
              {moods.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="w-full bg-blue-500 text-white py-2 rounded-md hover:bg-blue-600 transition duration-200"
          >
            Get Recommendations
          </button>
        </motion.form>
      )}

      {loading && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 flex justify-center"
        >
          <div className="spinner"></div>
        </motion.div>
      )}
      {error && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-4 text-red-500"
        >
          {error}
        </motion.p>
      )}
      {showFavorites ? (
        <div className="mt-8 w-full max-w-2xl">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Favorites:</h2>
          <ul className="space-y-4">
            {favorites.map((rec, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="flex items-start bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition duration-200"
              >
                {rec.poster ? (
                  <img
                    src={rec.poster}
                    alt={rec.title}
                    className="w-24 h-36 object-cover rounded-md mr-4"
                  />
                ) : (
                  <div className="w-24 h-36 flex items-center justify-center bg-gray-200 rounded-md mr-4 text-gray-500">
                    No Poster
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-800">{rec.title} ({rec.release_year || 'N/A'})</p>
                  <p className="text-gray-600">{rec.genres.join(', ')}</p>
                  {rec.rating && (
                    <p className="text-yellow-500 font-semibold">
                      Rating: {rec.rating}/10
                    </p>
                  )}
                  <p className="text-gray-500 text-sm mt-2">{rec.overview}</p>
                  {rec.trailer && (
                    <a href={rec.trailer} target="_blank" rel="noopener noreferrer" className="text-blue-500 mt-2 inline-block">
                      Watch Trailer
                    </a>
                  )}
                  <button
                    onClick={() => toggleFavorite(rec.title, true)}
                    className="mt-2 bg-red-500 text-white py-1 px-2 rounded-md hover:bg-red-600"
                  >
                    Remove from Favorites
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      ) : recommendations.length > 0 && (
        <div className="mt-8 w-full max-w-2xl">
          <h2 className="text-2xl font-semibold text-gray-800 mb-4">Recommendations:</h2>
          <ul className="space-y-4">
            {filteredRecommendations.map((rec, idx) => (
              <motion.li
                key={idx}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: idx * 0.05 }}
                className="flex items-start bg-white p-4 rounded-lg shadow-md hover:shadow-lg transition duration-200"
              >
                {rec.poster ? (
                  <img
                    src={rec.poster}
                    alt={rec.title}
                    className="w-24 h-36 object-cover rounded-md mr-4"
                  />
                ) : (
                  <div className="w-24 h-36 flex items-center justify-center bg-gray-200 rounded-md mr-4 text-gray-500">
                    No Poster
                  </div>
                )}
                <div className="flex-1">
                  <p className="text-lg font-medium text-gray-800">{rec.title} ({rec.release_year || 'N/A'})</p>
                  <p className="text-gray-600">{rec.genres.join(', ')}</p>
                  {rec.rating && (
                    <p className="text-yellow-500 font-semibold">
                      Rating: {rec.rating}/10
                    </p>
                  )}
                  <p className="text-gray-500 text-sm mt-2">{rec.overview}</p>
                  {rec.trailer && (
                    <a href={rec.trailer} target="_blank" rel="noopener noreferrer" className="text-blue-500 mt-2 inline-block">
                      Watch Trailer
                    </a>
                  )}
                  <div className="mt-2 flex space-x-2">
                    <button
                      onClick={() => toggleFavorite(rec.title, rec.is_favorite)}
                      className={`py-1 px-2 rounded-md ${rec.is_favorite ? 'bg-red-500 hover:bg-red-600' : 'bg-green-500 hover:bg-green-600'} text-white`}
                    >
                      {rec.is_favorite ? 'Remove Favorite' : 'Add to Favorites'}
                    </button>
                    <div>
                      <label className="mr-2">Rate (1-5):</label>
                      <input
                        type="number"
                        min="1"
                        max="5"
                        className="w-16 p-1 border rounded-md"
                        onChange={(e) => handleFeedback(rec.title, e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </motion.li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;