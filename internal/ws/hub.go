// Package ws implements WebSocket connection management.
//
// Architecture Deep-Dive:
//
// The Hub is a central coordinator that runs as a single long-lived goroutine.
// It uses three channels to safely manage concurrent access to the client map
// WITHOUT needing a mutex (channel-based synchronization is idiomatic Go).
//
//   Hub goroutine (single)
//     ┌─────────────────────────────────────┐
//     │  select {                           │
//     │    case client := <-register:       │  ← new connection joins
//     │    case client := <-unregister:     │  ← connection leaves
//     │    case message := <-broadcast:     │  ← fan-out to all clients
//     │  }                                  │
//     └─────────────────────────────────────┘
//
// Each Client has its own writePump goroutine that reads from a buffered
// 'send' channel. The Hub writes into those channels; the writePump drains
// them onto the actual WebSocket connection. This decouples broadcast speed
// from individual connection write speed.
package ws

// Hub maintains the set of active clients and broadcasts messages.
type Hub struct {
	// Registered clients. The map value is unused (set semantics).
	clients map[*Client]bool

	// Inbound messages from clients to broadcast.
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

// Run starts the Hub's main event loop. Call this in a goroutine:
//
//	hub := ws.NewHub()
//	go hub.Run()
//
// This is the ONLY goroutine that reads/writes the clients map,
// so no mutex is needed — all synchronization happens through channels.
func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.clients[client] = true

		case client := <-h.Unregister:
			if _, ok := h.clients[client]; ok {
				delete(h.clients, client)
				close(client.Send)
			}

		case message := <-h.Broadcast:
			for client := range h.clients {
				select {
				case client.Send <- message:
					// Message queued successfully.
				default:
					// Client's send buffer is full — assume it's dead.
					// Close the channel and remove the client.
					close(client.Send)
					delete(h.clients, client)
				}
			}
		}
	}
}
