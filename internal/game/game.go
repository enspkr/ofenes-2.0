package game

import (
	"sync"
	"time"
)

type Status string

const (
	StatusLobby        Status = "lobby"
	StatusModeSelect   Status = "mode_select"
	StatusArtistSelect Status = "artist_select"
	StatusGenreSelect  Status = "genre_select"
	StatusRoundActive  Status = "round_active"
	StatusRoundResult  Status = "round_result"
	StatusEnded        Status = "ended"
)

type GameTrack struct {
	VideoID      string `json:"videoId"`
	Title        string `json:"title"`
	Artist       string `json:"artist"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

type SelectedArtist struct {
	ChannelID    string `json:"channelId"`
	Name         string `json:"name"`
	ThumbnailURL string `json:"thumbnailUrl"`
}

type Session struct {
	mu sync.Mutex

	ID              string
	RoomID          string
	Host            string
	Players         []string // nil/empty = everyone in room
	Status          Status
	Mode            string // "artists" | "genres"
	SelectedArtists []SelectedArtist
	SelectedGenre   string
	TrackPool       []GameTrack
	PlayedVideoIDs  map[string]bool
	TotalRounds     int
	CurrentRound    int
	CurrentTrack    *GameTrack
	CurrentVideoID  string // stored for late-joiner sync
	StartSeconds    int    // stored for late-joiner sync
	Options         []GameTrack
	Answers         map[string]string // username -> videoId this round
	Scores          map[string]int    // username -> cumulative score
	RoundStartTime  time.Time
	RoundTimer      *time.Timer
	CreatedAt       time.Time
}

func NewSession(id, roomID, host string, players []string) *Session {
	if players == nil {
		players = []string{}
	}
	return &Session{
		ID:             id,
		RoomID:         roomID,
		Host:           host,
		Players:        players,
		Status:         StatusLobby,
		PlayedVideoIDs: make(map[string]bool),
		Answers:        make(map[string]string),
		Scores:         make(map[string]int),
		TotalRounds:    10,
		CreatedAt:      time.Now(),
	}
}

func (s *Session) Lock()   { s.mu.Lock() }
func (s *Session) Unlock() { s.mu.Unlock() }

func (s *Session) RemainingTracks() []GameTrack {
	var remaining []GameTrack
	for _, t := range s.TrackPool {
		if !s.PlayedVideoIDs[t.VideoID] {
			remaining = append(remaining, t)
		}
	}
	return remaining
}

func (s *Session) IsPlayer(username string) bool {
	if len(s.Players) == 0 {
		return true
	}
	for _, p := range s.Players {
		if p == username {
			return true
		}
	}
	return false
}

// SessionSnapshot is a serializable, lock-free view of a session.
// Always call Snapshot() under the session lock.
type SessionSnapshot struct {
	ID              string           `json:"id"`
	RoomID          string           `json:"roomId"`
	Host            string           `json:"host"`
	Players         []string         `json:"players"`
	Status          Status           `json:"status"`
	Mode            string           `json:"mode"`
	SelectedArtists []SelectedArtist `json:"selectedArtists"`
	SelectedGenre   string           `json:"selectedGenre"`
	TotalRounds     int              `json:"totalRounds"`
	CurrentRound    int              `json:"currentRound"`
	Options         []GameTrack      `json:"options"`
	Scores          map[string]int   `json:"scores"`
	CurrentVideoID  string           `json:"currentVideoId,omitempty"`
	StartSeconds    int              `json:"startSeconds,omitempty"`
}

func (s *Session) Snapshot() SessionSnapshot {
	artists := s.SelectedArtists
	if artists == nil {
		artists = []SelectedArtist{}
	}
	options := s.Options
	if options == nil {
		options = []GameTrack{}
	}
	scores := make(map[string]int, len(s.Scores))
	for k, v := range s.Scores {
		scores[k] = v
	}
	snap := SessionSnapshot{
		ID:              s.ID,
		RoomID:          s.RoomID,
		Host:            s.Host,
		Players:         s.Players,
		Status:          s.Status,
		Mode:            s.Mode,
		SelectedArtists: artists,
		SelectedGenre:   s.SelectedGenre,
		TotalRounds:     s.TotalRounds,
		CurrentRound:    s.CurrentRound,
		Options:         options,
		Scores:          scores,
	}
	if s.Status == StatusRoundActive || s.Status == StatusRoundResult {
		snap.CurrentVideoID = s.CurrentVideoID
		snap.StartSeconds = s.StartSeconds
	}
	return snap
}
