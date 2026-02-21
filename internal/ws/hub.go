// Package ws implements WebSocket connection management.
//
// Architecture:
//
//	Hub goroutine (single owner of clients map)
//	  ┌──────────────────────────────────────────┐
//	  │  select {                                │
//	  │    case client := <-register:            │  ← new connection joins
//	  │    case client := <-unregister:          │  ← connection leaves
//	  │    case message := <-broadcast:          │  ← fan-out to all clients
//	  │  }                                       │
//	  └──────────────────────────────────────────┘
//
// The Hub is the ONLY goroutine that touches the clients map.
// All synchronization is done through channels — no mutexes needed.
package ws

import (
	"encoding/json"
	"log"
	"time"

	"ofenes/internal/models"
)

// Hub maintains the set of active clients and routes messages.
type Hub struct {
	// Registered clients.
	clients map[*Client]bool

	// Inbound messages from clients.
	Broadcast chan []byte

	// Register requests from new clients.
	Register chan *Client

	// Unregister requests from disconnecting clients.
	Unregister chan *Client
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
			log.Printf("ws: client connected (user=%s, total=%d)", client.UserID, len(h.clients))

			// Notify all clients about the new connection
			h.broadcastSystemMessage("user_joined", client.UserID)

		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("ws: client disconnected (user=%s, total=%d)", client.UserID, len(h.clients))

				h.broadcastSystemMessage("user_left", client.UserID)
			}

		case message := <-h.Broadcast:
			h.routeMessage(message)
		}
	}
}

// routeMessage parses incoming JSON and routes by message type.
// This is the typed routing layer — extend it as you add features.
func (h *Hub) routeMessage(raw []byte) {
	var msg models.Message
	if err := json.Unmarshal(raw, &msg); err != nil {
		log.Printf("ws: invalid message format: %v", err)
		return
	}

	switch msg.Type {
	case models.MsgTypeChat:
		// Chat messages: broadcast to all clients
		h.broadcastToAll(raw)

	case models.MsgTypeVideoSync:
		// Video sync: broadcast to all clients
		h.broadcastToAll(raw)

	case models.MsgTypeAdmin:
		// Admin messages: only broadcast to admins (future: check role)
		h.broadcastToAll(raw)

	default:
		log.Printf("ws: unknown message type: %s", msg.Type)
		h.broadcastToAll(raw) // fallback: broadcast anyway
	}
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

// broadcastSystemMessage creates and sends a system message to all clients.
func (h *Hub) broadcastSystemMessage(event, userID string) {
	msg := models.Message{
		Type:      models.MsgTypeSystem,
		Sender:    "system",
		Payload:   event,
		Timestamp: time.Now(),
	}

	// Include the user ID in the payload for user_joined/user_left events
	msg.Payload = `{"event":"` + event + `","userId":"` + userID + `"}`

	data, err := json.Marshal(msg)
	if err != nil {
		log.Printf("ws: failed to marshal system message: %v", err)
		return
	}

	h.broadcastToAll(data)
}
