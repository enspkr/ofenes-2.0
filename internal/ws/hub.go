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

		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
				log.Printf("ws: client disconnected (user=%s, total=%d)", client.Username, len(h.clients))
				h.broadcastSystemMessage("user_left", client.UserID, client.Username)
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
		// Store latest video state for late joiners
		h.lastVideoState = raw
		h.broadcastToAll(raw)

	case models.MsgTypeAdmin:
		h.broadcastToAll(raw)

	default:
		log.Printf("ws: unknown message type: %s", msg.Type)
		h.broadcastToAll(raw)
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
