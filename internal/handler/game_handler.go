package handler

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"

	"ofenes/pkg/response"
)

// SearchArtist proxies a YouTube Data API channel search so the frontend
// can find artists without exposing the API key to the browser.
func (h *Handler) SearchArtist(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query().Get("q")
	if q == "" {
		response.Error(w, http.StatusBadRequest, "q is required")
		return
	}

	apiKey := h.app.Config.YouTubeAPIKey
	if apiKey == "" {
		response.Error(w, http.StatusInternalServerError, "YouTube API key not configured")
		return
	}

	ytURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=%s&maxResults=8&key=%s",
		url.QueryEscape(q), apiKey,
	)

	body, err := fetchURL(ytURL)
	if err != nil {
		response.Error(w, http.StatusBadGateway, "YouTube API unavailable")
		return
	}

	var ytResp struct {
		Items []struct {
			ID struct {
				ChannelID string `json:"channelId"`
			} `json:"id"`
			Snippet struct {
				Title      string `json:"title"`
				Thumbnails struct {
					Default struct{ URL string `json:"url"` } `json:"default"`
					Medium  struct{ URL string `json:"url"` } `json:"medium"`
				} `json:"thumbnails"`
			} `json:"snippet"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &ytResp); err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to parse YouTube response")
		return
	}

	type Artist struct {
		ChannelID    string `json:"channelId"`
		Name         string `json:"name"`
		ThumbnailURL string `json:"thumbnailUrl"`
	}

	artists := make([]Artist, 0, len(ytResp.Items))
	for _, item := range ytResp.Items {
		if item.ID.ChannelID == "" {
			continue
		}
		thumb := item.Snippet.Thumbnails.Medium.URL
		if thumb == "" {
			thumb = item.Snippet.Thumbnails.Default.URL
		}
		artists = append(artists, Artist{
			ChannelID:    item.ID.ChannelID,
			Name:         item.Snippet.Title,
			ThumbnailURL: thumb,
		})
	}

	response.JSON(w, http.StatusOK, artists)
}

// GetArtistTracks returns the top videos from a YouTube channel (artist).
func (h *Handler) GetArtistTracks(w http.ResponseWriter, r *http.Request) {
	channelID := r.URL.Query().Get("channelId")
	if channelID == "" {
		response.Error(w, http.StatusBadRequest, "channelId is required")
		return
	}

	apiKey := h.app.Config.YouTubeAPIKey
	if apiKey == "" {
		response.Error(w, http.StatusInternalServerError, "YouTube API key not configured")
		return
	}

	ytURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&channelId=%s&maxResults=50&order=viewCount&key=%s",
		url.QueryEscape(channelID), apiKey,
	)

	body, err := fetchURL(ytURL)
	if err != nil {
		response.Error(w, http.StatusBadGateway, "YouTube API unavailable")
		return
	}

	tracks, err := parseVideoItems(body)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to parse YouTube response")
		return
	}

	response.JSON(w, http.StatusOK, tracks)
}

// GetGenres returns the static list of music genres available for the game.
func (h *Handler) GetGenres(w http.ResponseWriter, r *http.Request) {
	genres := []map[string]string{
		{"id": "pop", "name": "Pop"},
		{"id": "rock", "name": "Rock"},
		{"id": "hip-hop", "name": "Hip-Hop"},
		{"id": "r&b", "name": "R&B"},
		{"id": "electronic edm", "name": "Electronic / EDM"},
		{"id": "latin", "name": "Latin"},
		{"id": "jazz", "name": "Jazz"},
		{"id": "classical", "name": "Classical"},
		{"id": "metal", "name": "Metal"},
		{"id": "country", "name": "Country"},
		{"id": "k-pop", "name": "K-Pop"},
		{"id": "indie", "name": "Indie"},
	}
	response.JSON(w, http.StatusOK, genres)
}

// GetGenreTracks searches YouTube for popular tracks in a given genre.
func (h *Handler) GetGenreTracks(w http.ResponseWriter, r *http.Request) {
	genre := r.URL.Query().Get("genre")
	if genre == "" {
		response.Error(w, http.StatusBadRequest, "genre is required")
		return
	}

	apiKey := h.app.Config.YouTubeAPIKey
	if apiKey == "" {
		response.Error(w, http.StatusInternalServerError, "YouTube API key not configured")
		return
	}

	ytURL := fmt.Sprintf(
		"https://www.googleapis.com/youtube/v3/search?part=snippet&type=video&videoCategoryId=10&q=%s+official+audio&maxResults=50&order=relevance&key=%s",
		url.QueryEscape(genre), apiKey,
	)

	body, err := fetchURL(ytURL)
	if err != nil {
		response.Error(w, http.StatusBadGateway, "YouTube API unavailable")
		return
	}

	tracks, err := parseVideoItems(body)
	if err != nil {
		response.Error(w, http.StatusInternalServerError, "failed to parse YouTube response")
		return
	}

	response.JSON(w, http.StatusOK, tracks)
}

// --- shared helpers ---

type gameTrack struct {
	VideoID      string `json:"videoId"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

func parseVideoItems(body []byte) ([]gameTrack, error) {
	var ytResp struct {
		Items []struct {
			ID struct {
				VideoID string `json:"videoId"`
			} `json:"id"`
			Snippet struct {
				Title        string `json:"title"`
				ChannelTitle string `json:"channelTitle"`
				Thumbnails   struct {
					High   struct{ URL string `json:"url"` } `json:"high"`
					Medium struct{ URL string `json:"url"` } `json:"medium"`
				} `json:"thumbnails"`
			} `json:"snippet"`
		} `json:"items"`
	}
	if err := json.Unmarshal(body, &ytResp); err != nil {
		return nil, err
	}

	tracks := make([]gameTrack, 0, len(ytResp.Items))
	for _, item := range ytResp.Items {
		if item.ID.VideoID == "" {
			continue
		}
		thumb := item.Snippet.Thumbnails.High.URL
		if thumb == "" {
			thumb = item.Snippet.Thumbnails.Medium.URL
		}
		tracks = append(tracks, gameTrack{
			VideoID:      item.ID.VideoID,
			Title:        item.Snippet.Title,
			Artist:       item.Snippet.ChannelTitle,
			ThumbnailURL: thumb,
		})
	}
	return tracks, nil
}

func fetchURL(rawURL string) ([]byte, error) {
	resp, err := http.Get(rawURL) //nolint:gosec — URL is constructed server-side from config + validated inputs
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}
