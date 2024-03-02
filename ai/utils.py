from auth import sp

# Function to get all liked songs' IDs
def get_liked_song_ids():
    liked_song_ids = set()
    results = sp.current_user_saved_tracks(limit=50)
    while results:
        for item in results["items"]:
            liked_song_ids.add(item["track"]["id"])
        print(f"{len(liked_song_ids)} / {results['total']} liked songs fetched", end="\r")
        results = sp.next(results)
    
    print(f"All tracks fetched from your liked songs")
    return liked_song_ids

def get_playlist_name(playlist_id):
    playlist = sp.playlist(playlist_id)
    return playlist["name"]

def get_liked_songs():
    liked_songs = []
    results = sp.current_user_saved_tracks(limit=50)
    while results:
        for item in results["items"]:
            liked_songs.append(item)
        print(f"{len(liked_songs)} / {results['total']} liked songs fetched", end="\r")
        results = sp.next(results)
    return liked_songs

def get_playlist_name(playlist_id):
    playlist = sp.playlist(playlist_id)
    return playlist["name"]

# Function to fetch all tracks from a playlist with pagination
def fetch_all_playlist_tracks(playlist_id: str):
    playlist_tracks = []
    offset = 0
    
    playlist = sp.playlist(playlist_id)
    print(f"Fetching tracks from '{playlist['name']}' by {playlist['owner']['display_name']}")
    
    while True:
        tracks = sp.playlist_tracks(playlist_id=playlist_id, offset=offset)["items"]
        if not tracks:
            break
        playlist_tracks.extend(tracks)
        offset += len(tracks)
        print(f"{offset} / {playlist['tracks']['total']} tracks fetched", end="\r")
        
    return playlist_tracks

def check_duplicate_track(track, playlist_tracks_to_compare):
    track_name = track["track"]["name"]
    track_id = track["track"]["id"]
    track_artist = track["track"]["artists"][0]
    track_duration = track["track"]["duration_ms"]

    for destination_track in playlist_tracks_to_compare:
        destination_track_name = destination_track["track"]["name"]
        destination_track_id = destination_track["track"]["id"]
        destination_track_artist = destination_track["track"]["artists"][0]
        destination_track_duration = destination_track["track"]["duration_ms"]

        if track_id == destination_track_id or (
            track_name == destination_track_name
            and track_artist == destination_track_artist
            and track_duration == destination_track_duration
        ):
            return True
    return False

def get_track_genres_from_id(track_id):
    track_info = sp.track(track_id)
    if track_info["artists"]:
        artist_id = track_info["artists"][0]["id"]
        artist_info = sp.artist(artist_id)
        if artist_info["genres"]:
            return artist_info["genres"]
    return None

