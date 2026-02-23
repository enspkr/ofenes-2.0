package ws

import (
	"encoding/json"
	"log"
	"time"

	"ofenes/internal/models"
)

// Hub maintains the set of active clients and routes messages.
// It also stores the last known VideoState so new clients
// can sync immediately on connect.
type Hub struct {
	clients    map[*Client]bool
	Broadcast  chan []byte
	Register   chan *Client
	Unregister chan *Client

	// lastVideoState stores the most recent video sync payload.
	// Sent to new clients on connect so they join mid-stream.
	lastVideoState []byte
}

// NewHub creates and returns a new Hub instance.
func NewHub() *Hub {
	return &Hub{
		Broadcast:  make(chan []byte),
		Register:   make(chan *Client),
		Unregister: make(chan *Client),
		clients:    make(map[*Client]bool),
	}
}

// Run starts the Hub's main event loop. Call this in a goroutine.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.clients[client] = true
			log.Printf("ws: client connected (user=%s, total=%d)", client.Username, len(h.clients))
			h.broadcastSystemMessage("user_joined", client.UserID, client.Username)

			// Push the current video state to the new client
			if h.lastVideoState != nil {
				select {
				case client.Send <- h.lastVideoState:
				default:
				}
			}

			// Broadcast updated user list so peers know who to connect to
			h.broadcastUserList()

		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("ws: client disconnected (user=%s, total=%d)", client.Username, len(h.clients))
				h.broadcastSystemMessage("user_left", client.UserID, client.Username)

				// Broadcast updated user list after disconnect
				h.broadcastUserList()
			}

		case message := <-h.Broadcast:
			h.routeMessage(message)
		}
	}
}

// routeMessage parses incoming JSON and routes by message type.
func (h *Hub) routeMessage(raw []byte) {
	var msg models.Message
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("ws: invalid message format: %v", err)
		return
	}

	switch msg.Type {
	case models.MsgTypeChat:
		h.broadcastToAll(raw)

	case models.MsgTypeVideoSync:
		h.lastVideoState = raw
		h.broadcastToAll(raw)

	case models.MsgTypeWebRTC:
		// WebRTC signaling: forward to a specific target user
		h.routeWebRTCMessage(msg)

	case models.MsgTypeAdmin:
		h.broadcastToAll(raw)

	default:
		log.Printf("ws: unknown message type: %s", msg.Type)
		h.broadcastToAll(raw)
	}
}

// routeWebRTCMessage parses the target from the payload and sends directly.
func (h *Hub) routeWebRTCMessage(msg models.Message) {
	// The payload is JSON with a "target" field
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

	// Re-serialize the full message for forwarding
	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: failed to marshal webrtc message: %v", err)
		return
	}

	h.sendToUser(payload.Target, data)
}

// sendToUser sends a message to a specific user by username.
func (h *Hub) sendToUser(username string, message []byte) {
	for client := range h.clients {
		if client.Username == username {
			select {
			case client.Send <- message:
			default:
				close(client.Send)
				delete(h.clients, client)
			}
			return // Found the target, done
		}
	}
	log.Printf("ws: target user not found: %s", username)
}

// broadcastUserList sends the current list of connected usernames to all clients.
func (h *Hub) broadcastUserList() {
	usernames := make([]string, 0, len(h.clients))
	for client := range h.clients {
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

	h.broadcastToAll(data)
}

// broadcastToAll sends a message to every connected client.
func (h *Hub) broadcastToAll(message []byte) {
	for client := range h.clients {
		select {
		case client.Send <- message:
		default:
			close(client.Send)
			delete(h.clients, client)
		}
	}
}

// broadcastSystemMessage sends a system notification to all clients.
func (h *Hub) broadcastSystemMessage(event, userID, username string) {
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

	h.broadcastToAll(data)
}
