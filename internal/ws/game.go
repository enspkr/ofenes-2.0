package ws

import (
	"encoding/json"
	"log"
	"math/rand"
	"time"

	"ofenes/internal/game"
	"ofenes/internal/models"

	"github.com/google/uuid"
)

// handleGameMessage dispatches a game WebSocket message to the right handler.
func (h *Hub) handleGameMessage(roomID string, msg models.Message) {
	var base struct {
		Action string `json:"action"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &base); err != nil {
		log.Printf("game: bad payload from %s: %v", msg.Sender, err)
		return
	}

	switch base.Action {
	case models.GameActionStart:
		h.handleGameStart(roomID, msg)
	case models.GameActionModeSelect:
		h.handleGameModeSelect(roomID, msg)
	case models.GameActionArtistAdd:
		h.handleGameArtistAdd(roomID, msg)
	case models.GameActionArtistRemove:
		h.handleGameArtistRemove(roomID, msg)
	case models.GameActionGenreSelect:
		h.handleGameGenreSelect(roomID, msg)
	case models.GameActionBegin:
		h.handleGameBegin(roomID, msg)
	case models.GameActionAnswer:
		h.handleGameAnswer(roomID, msg)
	case models.GameActionLeave:
		h.handleGameLeave(roomID, msg)
	default:
		log.Printf("game: unknown action %q from %s", base.Action, msg.Sender)
	}
}

func (h *Hub) handleGameStart(roomID string, msg models.Message) {
	var payload struct {
		Players []string `json:"players"`
	}
	json.Unmarshal([]byte(msg.Payload), &payload) //nolint:errcheck — already validated above

	// Cancel existing game if any
	if existing, ok := h.gameManager.Get(roomID); ok {
		existing.Lock()
		if existing.RoundTimer != nil {
			existing.RoundTimer.Stop()
		}
		existing.Unlock()
	}

	session := game.NewSession(uuid.New().String(), roomID, msg.Sender, payload.Players)
	h.gameManager.Set(roomID, session)
	h.broadcastGameState(roomID, session)
}

func (h *Hub) handleGameModeSelect(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		Mode string `json:"mode"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	session.Lock()
	if session.Host != msg.Sender {
		session.Unlock()
		return
	}
	session.Mode = payload.Mode
	if payload.Mode == "artists" {
		session.Status = game.StatusArtistSelect
	} else {
		session.Status = game.StatusGenreSelect
	}
	session.Unlock()

	h.broadcastGameState(roomID, session)
}

func (h *Hub) handleGameArtistAdd(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		ChannelID    string `json:"channelId"`
		Name         string `json:"name"`
		ThumbnailURL string `json:"thumbnailUrl"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	session.Lock()
	if session.Host != msg.Sender {
		session.Unlock()
		return
	}
	// Deduplicate
	for _, a := range session.SelectedArtists {
		if a.ChannelID == payload.ChannelID {
			session.Unlock()
			return
		}
	}
	session.SelectedArtists = append(session.SelectedArtists, game.SelectedArtist{
		ChannelID:    payload.ChannelID,
		Name:         payload.Name,
		ThumbnailURL: payload.ThumbnailURL,
	})
	session.Unlock()

	h.broadcastGameState(roomID, session)
}

func (h *Hub) handleGameArtistRemove(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		ChannelID string `json:"channelId"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	session.Lock()
	if session.Host != msg.Sender {
		session.Unlock()
		return
	}
	filtered := session.SelectedArtists[:0]
	for _, a := range session.SelectedArtists {
		if a.ChannelID != payload.ChannelID {
			filtered = append(filtered, a)
		}
	}
	session.SelectedArtists = filtered
	session.Unlock()

	h.broadcastGameState(roomID, session)
}

func (h *Hub) handleGameGenreSelect(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		Genre string `json:"genre"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	session.Lock()
	if session.Host != msg.Sender {
		session.Unlock()
		return
	}
	session.SelectedGenre = payload.Genre
	session.Unlock()

	h.broadcastGameState(roomID, session)
}

// handleGameBegin receives the track pool from the frontend and starts round 1.
func (h *Hub) handleGameBegin(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		Tracks []game.GameTrack `json:"tracks"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	if len(payload.Tracks) < 4 {
		h.sendGameError(roomID, "Need at least 4 songs to start the game.")
		return
	}

	session.Lock()
	if session.Host != msg.Sender {
		session.Unlock()
		return
	}
	session.TrackPool = payload.Tracks
	rounds := 10
	if len(payload.Tracks) < rounds {
		rounds = len(payload.Tracks)
	}
	session.TotalRounds = rounds
	session.Unlock()

	h.startNextRound(roomID, session)
}

func (h *Hub) handleGameAnswer(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	var payload struct {
		VideoID string `json:"videoId"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		return
	}

	session.Lock()

	if session.Status != game.StatusRoundActive {
		session.Unlock()
		return
	}
	// One answer per player per round
	if _, already := session.Answers[msg.Sender]; already {
		session.Unlock()
		return
	}

	session.Answers[msg.Sender] = payload.VideoID
	allDone := h.allPlayersAnswered(session, roomID)

	session.Unlock()

	if allDone {
		session.Lock()
		if session.RoundTimer != nil {
			session.RoundTimer.Stop()
			session.RoundTimer = nil
		}
		session.Unlock()
		h.endRound(roomID, session)
	}
}

func (h *Hub) handleGameLeave(roomID string, msg models.Message) {
	session, ok := h.gameManager.Get(roomID)
	if !ok {
		return
	}

	session.Lock()

	// Remove from explicit players list
	filtered := session.Players[:0]
	for _, p := range session.Players {
		if p != msg.Sender {
			filtered = append(filtered, p)
		}
	}
	session.Players = filtered

	// Host leaving ends the game
	if session.Host == msg.Sender {
		if session.RoundTimer != nil {
			session.RoundTimer.Stop()
			session.RoundTimer = nil
		}
		session.Status = game.StatusEnded
		session.Unlock()
		h.broadcastGameEndAsync(roomID, session)
		h.gameManager.Delete(roomID)
		return
	}

	session.Unlock()
	h.broadcastGameState(roomID, session)
}

// --- Round lifecycle ---

func (h *Hub) startNextRound(roomID string, session *game.Session) {
	session.Lock()

	session.CurrentRound++
	remaining := session.RemainingTracks()

	if len(remaining) == 0 || session.CurrentRound > session.TotalRounds {
		session.Status = game.StatusEnded
		session.Unlock()
		h.broadcastGameEndAsync(roomID, session)
		h.gameManager.Delete(roomID)
		return
	}

	correctIdx := rand.Intn(len(remaining))
	correct := remaining[correctIdx]
	session.CurrentTrack = &correct
	session.PlayedVideoIDs[correct.VideoID] = true

	options := buildGameOptions(correct, session.TrackPool)
	session.Options = options
	session.Answers = make(map[string]string)
	session.Status = game.StatusRoundActive
	session.RoundStartTime = time.Now()

	startSeconds := 20 + rand.Intn(61) // 20–80s into the video
	session.CurrentVideoID = correct.VideoID
	session.StartSeconds = startSeconds

	roundNumber := session.CurrentRound
	totalRounds := session.TotalRounds

	session.Unlock()

	// Broadcast round_start asynchronously (called from goroutine context)
	h.roomBroadcast <- roomBroadcastMsg{
		RoomID: roomID,
		Data: h.mustBuildGameMessage(map[string]interface{}{
			"action":       models.GameActionRoundStart,
			"roundNumber":  roundNumber,
			"totalRounds":  totalRounds,
			"videoId":      correct.VideoID,
			"startSeconds": startSeconds,
			"durationMs":   30000,
			"options":      options,
		}),
	}

	// Auto-end round after 30s
	session.Lock()
	session.RoundTimer = time.AfterFunc(30*time.Second, func() {
		h.endRound(roomID, session)
	})
	session.Unlock()
}

func (h *Hub) endRound(roomID string, session *game.Session) {
	session.Lock()

	if session.Status != game.StatusRoundActive {
		session.Unlock()
		return
	}

	if session.RoundTimer != nil {
		session.RoundTimer.Stop()
		session.RoundTimer = nil
	}

	correctVideoID := session.CurrentVideoID
	elapsed := time.Since(session.RoundStartTime).Seconds()

	for username, answer := range session.Answers {
		if answer == correctVideoID {
			bonus := int(50.0 * (1.0 - elapsed/30.0))
			if bonus < 0 {
				bonus = 0
			}
			session.Scores[username] += 100 + bonus
		}
	}

	session.Status = game.StatusRoundResult

	// Snapshot mutable maps
	answers := make(map[string]string, len(session.Answers))
	for k, v := range session.Answers {
		answers[k] = v
	}
	scores := make(map[string]int, len(session.Scores))
	for k, v := range session.Scores {
		scores[k] = v
	}
	currentRound := session.CurrentRound
	totalRounds := session.TotalRounds

	session.Unlock()

	h.roomBroadcast <- roomBroadcastMsg{
		RoomID: roomID,
		Data: h.mustBuildGameMessage(map[string]interface{}{
			"action":         models.GameActionRoundEnd,
			"correctVideoId": correctVideoID,
			"answers":        answers,
			"scores":         scores,
		}),
	}

	// Auto-advance after 5s
	if currentRound >= totalRounds {
		time.AfterFunc(5*time.Second, func() {
			session.Lock()
			session.Status = game.StatusEnded
			session.Unlock()
			h.broadcastGameEndAsync(roomID, session)
			h.gameManager.Delete(roomID)
		})
	} else {
		time.AfterFunc(5*time.Second, func() {
			h.startNextRound(roomID, session)
		})
	}
}

// --- Broadcast helpers ---

// broadcastGameState is called from the Hub's main goroutine (direct send, no channel).
func (h *Hub) broadcastGameState(roomID string, session *game.Session) {
	session.Lock()
	snap := session.Snapshot()
	session.Unlock()

	data := h.buildGameMessage(map[string]interface{}{
		"action":  models.GameActionState,
		"session": snap,
	})
	if data != nil {
		h.broadcastToRoom(roomID, data)
	}
}

// broadcastGameEndAsync is called from goroutines — uses the roomBroadcast channel.
func (h *Hub) broadcastGameEndAsync(roomID string, session *game.Session) {
	session.Lock()
	scores := make(map[string]int, len(session.Scores))
	for k, v := range session.Scores {
		scores[k] = v
	}
	session.Unlock()

	h.roomBroadcast <- roomBroadcastMsg{
		RoomID: roomID,
		Data: h.mustBuildGameMessage(map[string]interface{}{
			"action": models.GameActionEnd,
			"scores": scores,
		}),
	}
}

func (h *Hub) sendGameError(roomID, errMsg string) {
	data := h.buildGameMessage(map[string]interface{}{
		"action":  models.GameActionError,
		"message": errMsg,
	})
	if data != nil {
		h.broadcastToRoom(roomID, data)
	}
}

// buildGameMessage wraps a game payload in the standard Message envelope.
func (h *Hub) buildGameMessage(payload interface{}) []byte {
	payloadJSON, err := json.Marshal(payload)
	if err != nil {
		log.Printf("game: marshal payload: %v", err)
		return nil
	}
	msg := models.Message{
		Type:      models.MsgTypeGame,
		Sender:    "system",
		Payload:   string(payloadJSON),
		Timestamp: time.Now(),
	}
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("game: marshal message: %v", err)
		return nil
	}
	return data
}

// mustBuildGameMessage panics only in tests; in production logs and returns nil-safe stub.
func (h *Hub) mustBuildGameMessage(payload interface{}) []byte {
	data := h.buildGameMessage(payload)
	if data == nil {
		// Fallback: empty JSON — broadcastToRoom will silently skip
		return []byte("{}")
	}
	return data
}

// --- Helpers ---

func (h *Hub) allPlayersAnswered(session *game.Session, roomID string) bool {
	players := session.Players
	if len(players) == 0 {
		// Everyone connected to the room
		for client := range h.clients[roomID] {
			if _, ok := session.Answers[client.Username]; !ok {
				return false
			}
		}
		return true
	}
	for _, p := range players {
		if _, ok := session.Answers[p]; !ok {
			return false
		}
	}
	return true
}

func buildGameOptions(correct game.GameTrack, pool []game.GameTrack) []game.GameTrack {
	var distractors []game.GameTrack
	for _, t := range pool {
		if t.VideoID != correct.VideoID {
			distractors = append(distractors, t)
		}
	}
	rand.Shuffle(len(distractors), func(i, j int) {
		distractors[i], distractors[j] = distractors[j], distractors[i]
	})
	n := 3
	if len(distractors) < n {
		n = len(distractors)
	}
	options := append([]game.GameTrack{correct}, distractors[:n]...)
	rand.Shuffle(len(options), func(i, j int) {
		options[i], options[j] = options[j], options[i]
	})
	return options
}
