import spotipy
from spotipy.oauth2 import SpotifyOAuth
from spotipy.oauth2 import SpotifyClientCredentials
from dotenv import load_dotenv
import os

# Load .env file
load_dotenv()

# Get client ID and secret
client_id = os.getenv('CLIENT_ID')
client_secret = os.getenv('CLIENT_SECRET')

client_credentials_flow = False
authorization_code_flow = not client_credentials_flow

if authorization_code_flow:
    scope = "playlist-read-private playlist-modify-private user-library-read playlist-modify-public"
    sp = spotipy.Spotify(
        auth_manager=SpotifyOAuth(
            client_id=client_id,
            client_secret=client_secret,
            scope=scope,
            redirect_uri="http://localhost:3000",
        )
    )
else:
    sp = spotipy.Spotify(
        auth_manager=SpotifyClientCredentials(
            client_id=client_id,
            client_secret=client_secret,
        )
    )
