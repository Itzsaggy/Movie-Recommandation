import os
from flask import Flask, request, jsonify, send_from_directory
from flask_cors import CORS
import requests
from requests.exceptions import RequestException
from collections import defaultdict
import pandas as pd

# Define the Flask app first
app = Flask(__name__, static_folder='../dist')  # Serve React build from dist folder
CORS(app, resources={r"/api/*": {"origins": "*"}, r"/*": {"origins": "*"}}, supports_credentials=True)

# TMDB API setup
TMDB_API_KEY = os.getenv('TMDB_API_KEY', '9aadbd159eccb13f0fef0ca607d554cf')
TMDB_BASE_URL = "https://api.themoviedb.org/3"

# Load and preprocess MovieLens data
movies_df = pd.read_csv('data/movies.csv')
movies_df['genres'] = movies_df['genres'].apply(lambda x: x.split('|'))
mood_to_genre = {
    'happy': ['Comedy', 'Animation', 'Family'],
    'sad': ['Drama', 'Romance'],
    'excited': ['Action', 'Adventure', 'Sci-Fi'],
    'calm': ['Drama', 'Documentary']
}

# Cache for TMDB data
tmdb_cache = {}

# User profiles
user_profiles = defaultdict(lambda: {'preferred_genres': set(), 'last_mood': None})

# Feedback and favorites
feedback_scores = defaultdict(int)
feedback_count = defaultdict(int)
favorites = set()

# Serve the React frontend
@app.route('/', defaults={'path': ''})
@app.route('/<path:path>')
def serve(path):
    if path != "" and os.path.exists(os.path.join(app.static_folder, path)):
        return send_from_directory(app.static_folder, path)
    return send_from_directory(app.static_folder, 'index.html')

def get_tmdb_data(movie_title):
    cleaned_title = movie_title.split(' (')[0]
    if cleaned_title in tmdb_cache:
        return tmdb_cache[cleaned_title]
    url = f"{TMDB_BASE_URL}/search/movie?api_key={TMDB_API_KEY}&query={cleaned_title}"
    print(f"Requesting TMDB for: {url}")
    for attempt in range(5):
        try:
            response = requests.get(url, timeout=15)
            print(f"Response status: {response.status_code}, Content: {response.text[:500]}...")
            if response.status_code == 200:
                data = response.json()
                if data['results']:
                    result = data['results'][0]
                    poster_path = result.get('poster_path')
                    rating = result.get('vote_average')
                    release_date = result.get('release_date', '').split('-')[0] if result.get('release_date') else None
                    overview = result.get('overview', 'No overview available')
                    video_url = None
                    video_response = requests.get(f"{TMDB_BASE_URL}/movie/{result['id']}/videos?api_key={TMDB_API_KEY}", timeout=15)
                    if video_response.status_code == 200:
                        video_data = video_response.json()
                        if video_data['results']:
                            video = next((v for v in video_data['results'] if v['type'] == 'Trailer' and v['site'] == 'YouTube'), None)
                            if video:
                                video_url = f"https://www.youtube.com/watch?v={video['key']}"
                    data = {
                        'poster': f"https://image.tmdb.org/t/p/w500{poster_path}" if poster_path else None,
                        'rating': rating,
                        'release_year': release_date,
                        'overview': overview,
                        'trailer': video_url
                    }
                    tmdb_cache[cleaned_title] = data
                    print(f"Found: {cleaned_title}, Poster: {poster_path}, Rating: {rating}, Year: {release_date}, Trailer: {video_url}")
                    return data
                print(f"No TMDB data found for: {cleaned_title}")
                tmdb_cache[cleaned_title] = {'poster': None, 'rating': None, 'release_year': None, 'overview': 'No overview available', 'trailer': None}
                return tmdb_cache[cleaned_title]
            else:
                print(f"TMDB API error for {cleaned_title}: Status {response.status_code}")
                tmdb_cache[cleaned_title] = {'poster': None, 'rating': None, 'release_year': None, 'overview': f'API error: Status {response.status_code}', 'trailer': None}
                return tmdb_cache[cleaned_title]
        except RequestException as e:
            print(f"Attempt {attempt + 1} failed for {cleaned_title}: {str(e)}")
            if attempt < 4:
                import time
                time.sleep(3)
    print(f"All attempts failed for {cleaned_title} due to connection issues")
    tmdb_cache[cleaned_title] = {'poster': None, 'rating': None, 'release_year': None, 'overview': 'Connection failed after multiple attempts', 'trailer': None}
    return tmdb_cache[cleaned_title]

def recommend_movies(genre, mood, num_recommendations=3):
    genre_matches = movies_df[movies_df['genres'].apply(lambda x: genre in x)]
    if mood in mood_to_genre:
        mood_genres = mood_to_genre[mood]
        mood_matches = genre_matches[genre_matches['genres'].apply(
            lambda x: any(g in mood_genres for g in x)
        )]
    else:
        mood_matches = genre_matches
    if mood_matches.empty:
        return [{'title': 'No matches found', 'genres': [], 'poster': None, 'rating': None, 'release_year': None, 'overview': 'No overview available', 'trailer': None}]
    
    user_profile = user_profiles['default']
    user_genres = user_profile['preferred_genres']
    user_mood = user_profile['last_mood']

    recommendations = mood_matches[['title', 'genres']].head(num_recommendations).to_dict('records')
    for rec in recommendations:
        tmdb_data = get_tmdb_data(rec['title'])
        rec['poster'] = tmdb_data['poster']
        rec['rating'] = tmdb_data['rating']
        rec['release_year'] = tmdb_data['release_year']
        rec['overview'] = tmdb_data['overview']
        rec['trailer'] = tmdb_data['trailer']
        avg_feedback = feedback_scores[rec['title']] / max(feedback_count[rec['title']], 1)
        genre_boost = 1.0
        if any(g in user_genres for g in rec['genres']):
            genre_boost = 1.5
        rec['feedback_score'] = avg_feedback * genre_boost
        rec['is_favorite'] = rec['title'] in favorites
    recommendations.sort(key=lambda x: x['feedback_score'], reverse=True)
    user_profiles['default']['last_mood'] = mood
    if genre:
        user_profiles['default']['preferred_genres'].add(genre)
    return recommendations[:num_recommendations]

@app.route('/recommend', methods=['POST'])
def get_recommendations():
    data = request.get_json()
    genre = data.get('genre')
    mood = data.get('mood')
    if not genre:
        return jsonify({'error': 'Genre is required'}), 400
    recommendations = recommend_movies(genre, mood)
    return jsonify({'recommendations': recommendations})

@app.route('/feedback', methods=['POST'])
def update_feedback():
    data = request.get_json()
    title = data.get('title')
    score = data.get('score')
    if title and isinstance(score, (int, float)) and 1 <= score <= 5:
        feedback_scores[title] += score
        feedback_count[title] += 1
        return jsonify({'status': 'success'})
    return jsonify({'error': 'Invalid feedback: Score must be between 1 and 5'}), 400

@app.route('/favorite', methods=['POST'])
def toggle_favorite():
    data = request.get_json()
    title = data.get('title')
    action = data.get('action')
    if not title or action not in ['add', 'remove']:
        return jsonify({'error': 'Invalid favorite action'}), 400
    if action == 'add':
        favorites.add(title)
    elif action == 'remove':
        favorites.discard(title)
    return jsonify({'status': 'success', 'favorites': list(favorites)})

@app.route('/favorites', methods=['GET'])
def get_favorites():
    if not favorites:
        return jsonify({'favorites': []})
    favorite_movies = [movie for movie in movies_df[movies_df['title'].isin(favorites)].to_dict('records')]
    for rec in favorite_movies:
        tmdb_data = get_tmdb_data(rec['title'])
        rec['poster'] = tmdb_data['poster']
        rec['rating'] = tmdb_data['rating']
        rec['release_year'] = tmdb_data['release_year']
        rec['overview'] = tmdb_data['overview']
        rec['trailer'] = tmdb_data['trailer']
    return jsonify({'favorites': favorite_movies})

@app.route('/profile', methods=['POST'])
def update_profile():
    data = request.get_json()
    user_id = data.get('user_id', 'default')
    preferred_genres = data.get('preferred_genres', [])
    if not isinstance(preferred_genres, list):
        preferred_genres = []
    user_profiles[user_id]['last_mood'] = data.get('mood')
    user_profiles[user_id]['preferred_genres'].update(preferred_genres)
    profile_data = {
        'last_mood': user_profiles[user_id]['last_mood'],
        'preferred_genres': list(user_profiles[user_id]['preferred_genres'])
    }
    return jsonify({'status': 'success', 'profile': profile_data})

if __name__ == '__main__':
    app.run(debug=True, port=5000)