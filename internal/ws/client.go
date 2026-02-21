package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// Tuning constants — configurable via constants for clarity.
const (
	writeWait      = 10 * time.Second
	pongWait       = 60 * time.Second
	pingPeriod     = (pongWait * 9) / 10
	maxMessageSize = 4096
)

// upgrader handles the HTTP → WebSocket protocol upgrade.
// CheckOrigin is permissive in development.
// TODO: Read allowed origins from config in production.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true
	},
}

// Client represents a single WebSocket connection.
// Each client is associated with a user (via UserID) and manages
// two goroutines: readPump and writePump.
type Client struct {
	hub    *Hub
	conn   *websocket.Conn
	Send   chan []byte
	UserID string // Identifies who this connection belongs to
}

// ServeWs handles the WebSocket upgrade and registers the client.
//
// The userID is extracted from the query parameter "userId".
// In production, this should come from the JWT token instead.
// TODO: Extract userID from JWT via middleware context.
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	// Extract user identity from query params (or future: JWT)
	userID := r.URL.Query().Get("userId")
	if userID == "" {
		userID = "anonymous"
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws: upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:    hub,
		conn:   conn,
		Send:   make(chan []byte, 256),
		UserID: userID,
	}

	client.hub.Register <- client

	go client.writePump()
	go client.readPump()
}

// readPump reads messages from the WebSocket and forwards them to the Hub.
// One readPump goroutine per connection — guarantees single reader.
func (c *Client) readPump() {
	defer func() {
		c.hub.Unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(maxMessageSize)
	c.conn.SetReadDeadline(time.Now().Add(pongWait))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(pongWait))
		return nil
	})

	for {
		_, message, err := c.conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("ws: read error (user=%s): %v", c.UserID, err)
			}
			break
		}
		c.hub.Broadcast <- message
	}
}

// writePump writes messages from the Hub to the WebSocket.
// One writePump goroutine per connection — guarantees single writer.
func (c *Client) writePump() {
	ticker := time.NewTicker(pingPeriod)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.Send:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Batch queued messages for efficiency
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
