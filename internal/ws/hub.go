package ws

import (
	"context"
	"encoding/json"
	"log"
	"time"

	"ofenes/internal/models"
	"ofenes/internal/repository"

	"github.com/google/uuid"
)

// Hub maintains the set of active clients grouped by room and routes messages.
// It also persists chat messages via the MessageRepository.
type Hub struct {
	// clients maps roomID -> set of clients in that room.
	clients map[string]map[*Client]bool

	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client

	// lastVideoState stores the most recent video sync payload per room.
	lastVideoState map[string][]byte

	messageRepo repository.MessageRepository
}

// NewHub creates and returns a new Hub instance.
// The messageRepo can be nil if message persistence is not needed.
func NewHub(messageRepo repository.MessageRepository) *Hub {
	return &Hub{
		Broadcast:      make(chan []byte),
		Register:       make(chan *Client),
		Unregister:     make(chan *Client),
		clients:        make(map[string]map[*Client]bool),
		lastVideoState: make(map[string][]byte),
		messageRepo:    messageRepo,
	}
}

// Run starts the Hub's main event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.addClient(client)

		case client := <-h.Unregister:
			h.removeClient(client)

		case message := <-h.Broadcast:
			h.routeMessage(message)
		}
	}
}

// addClient registers a new client in its room.
func (h *Hub) addClient(client *Client) {
	room := client.RoomID
	if h.clients[room] == nil {
		h.clients[room] = make(map[*Client]bool)
	}
	h.clients[room][client] = true

	log.Printf("ws: client connected (user=%s, room=%s, total_in_room=%d)",
		client.Username, room, len(h.clients[room]))

	h.broadcastSystemMessage(room, "user_joined", client.UserID, client.Username)

	// Push the current video state to the new client
	if state, ok := h.lastVideoState[room]; ok {
		select {
		case client.Send <- state:
		default:
		}
	}

	h.broadcastUserList(room)
}

// removeClient unregisters a client and cleans up empty rooms.
func (h *Hub) removeClient(client *Client) {
	room := client.RoomID
	roomClients, ok := h.clients[room]
	if !ok {
		return
	}

	if _, exists := roomClients[client]; !exists {
		return
	}

	delete(roomClients, client)
	close(client.Send)

	log.Printf("ws: client disconnected (user=%s, room=%s, total_in_room=%d)",
		client.Username, room, len(roomClients))

	h.broadcastSystemMessage(room, "user_left", client.UserID, client.Username)
	h.broadcastUserList(room)

	// Clean up empty rooms from memory
	if len(roomClients) == 0 {
		delete(h.clients, room)
		delete(h.lastVideoState, room)
	}
}

// routeMessage parses incoming JSON and routes by message type.
func (h *Hub) routeMessage(raw []byte) {
	var msg models.Message
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("ws: invalid message format: %v", err)
		return
	}

	// Find which room this sender is in.
	room := h.findClientRoom(msg.Sender)
	if room == "" {
		log.Printf("ws: sender %s not found in any room", msg.Sender)
		return
	}

	switch msg.Type {
	case models.MsgTypeChat:
		h.persistMessage(room, msg)
		h.broadcastToRoom(room, raw)

	case models.MsgTypeVideoSync:
		h.lastVideoState[room] = raw
		h.broadcastToRoom(room, raw)

	case models.MsgTypeWebRTC:
		// WebRTC signaling: forward to a specific target user (cross-room)
		h.routeWebRTCMessage(msg)

	case models.MsgTypeAdmin:
		h.broadcastToRoom(room, raw)

	default:
		log.Printf("ws: unknown message type: %s", msg.Type)
		h.broadcastToRoom(room, raw)
	}
}

// persistMessage saves a chat message to the database asynchronously.
func (h *Hub) persistMessage(roomID string, msg models.Message) {
	if h.messageRepo == nil {
		return
	}

	// Find sender's user ID
	senderID := h.findClientUserID(msg.Sender)
	if senderID == "" {
		return
	}

	chatMsg := &models.ChatMessage{
		ID:        uuid.New().String(),
		RoomID:    roomID,
		SenderID:  senderID,
		Sender:    msg.Sender,
		Type:      msg.Type,
		Content:   msg.Payload,
		CreatedAt: msg.Timestamp,
	}

	// Fire and forget -- don't block the broadcast loop.
	go func() {
		if err := h.messageRepo.Create(context.Background(), chatMsg); err != nil {
			log.Printf("ws: failed to persist message: %v", err)
		}
	}()
}

// findClientRoom returns the room ID of a client identified by username.
func (h *Hub) findClientRoom(username string) string {
	for roomID, roomClients := range h.clients {
		for client := range roomClients {
			if client.Username == username {
				return roomID
			}
		}
	}
	return ""
}

// findClientUserID returns the user ID of a client identified by username.
func (h *Hub) findClientUserID(username string) string {
	for _, roomClients := range h.clients {
		for client := range roomClients {
			if client.Username == username {
				return client.UserID
			}
		}
	}
	return ""
}

// routeWebRTCMessage parses the target from the payload and sends directly.
func (h *Hub) routeWebRTCMessage(msg models.Message) {
	var payload struct {
		Target string `json:"target"`
	}
	if err := json.Unmarshal([]byte(msg.Payload), &payload); err != nil {
		log.Printf("ws: webrtc message missing target: %v", err)
		return
	}

	if payload.Target == "" {
		log.Printf("ws: webrtc message has empty target")
		return
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: failed to marshal webrtc message: %v", err)
		return
	}

	h.sendToUser(payload.Target, data)
}

// sendToUser sends a message to a specific user by username (across all rooms).
func (h *Hub) sendToUser(username string, message []byte) {
	for _, roomClients := range h.clients {
		for client := range roomClients {
			if client.Username == username {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(roomClients, client)
				}
				return
			}
		}
	}
	log.Printf("ws: target user not found: %s", username)
}

// broadcastUserList sends the current list of connected usernames in a room.
func (h *Hub) broadcastUserList(roomID string) {
	roomClients := h.clients[roomID]
	if roomClients == nil {
		return
	}

	usernames := make([]string, 0, len(roomClients))
	for client := range roomClients {
		usernames = append(usernames, client.Username)
	}

	payload, _ := json.Marshal(usernames)

	msg := models.Message{
		Type:      models.MsgTypeUserList,
		Sender:    "system",
		Payload:   string(payload),
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: failed to marshal user list: %v", err)
		return
	}

	h.broadcastToRoom(roomID, data)
}

// broadcastToRoom sends a message to every client in a specific room.
func (h *Hub) broadcastToRoom(roomID string, message []byte) {
	roomClients := h.clients[roomID]
	if roomClients == nil {
		return
	}

	for client := range roomClients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(roomClients, client)
		}
	}
}

// broadcastSystemMessage sends a system notification to all clients in a room.
func (h *Hub) broadcastSystemMessage(roomID, event, userID, username string) {
	payload, _ := json.Marshal(map[string]string{
		"event":    event,
		"userId":   userID,
		"username": username,
	})

	msg := models.Message{
		Type:      models.MsgTypeSystem,
		Sender:    "system",
		Payload:   string(payload),
		Timestamp: time.Now(),
	}

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: failed to marshal system message: %v", err)
		return
	}

	h.broadcastToRoom(roomID, data)
}
