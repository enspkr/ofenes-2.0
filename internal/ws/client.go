package ws

import (
	"log"
	"net/http"
	"time"

	"github.com/gorilla/websocket"
)

// Tuning constants for WebSocket connections.
// These are best-practice values from the gorilla/websocket examples.
const (
	// Time allowed to write a message to the peer.
	writeWait = 10 * time.Second

	// Time allowed to read the next pong message from the peer.
	// If no pong arrives within this window, we assume the client is dead.
	pongWait = 60 * time.Second

	// Send pings to peer with this period. Must be less than pongWait
	// so that a pong can arrive before we time out.
	pingPeriod = (pongWait * 9) / 10

	// Maximum message size allowed from peer (bytes).
	maxMessageSize = 4096
)

// upgrader upgrades an HTTP connection to a WebSocket connection.
// CheckOrigin returns true for all origins during development.
// TODO: restrict origins in production.
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins in dev
	},
}

// Client is a middleman between the WebSocket connection and the Hub.
//
// Each Client spawns two goroutines:
//   - readPump:  reads messages FROM the WebSocket and sends them to the Hub.
//   - writePump: reads messages FROM the Hub (via Send channel) and writes them
//     TO the WebSocket.
//
// This separation means the Hub never touches the raw connection directly.
type Client struct {
	hub  *Hub
	conn *websocket.Conn

	// Buffered channel of outbound messages.
	// The Hub writes into this; writePump drains it.
	Send chan []byte
}

// ServeWs handles WebSocket requests from the peer.
// This is the HTTP handler you mount on your router:
//
//	http.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
//	    ws.ServeWs(hub, w, r)
//	})
func ServeWs(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("ws upgrade error: %v", err)
		return
	}

	client := &Client{
		hub:  hub,
		conn: conn,
		Send: make(chan []byte, 256), // 256-message buffer
	}

	// Register this client with the Hub.
	client.hub.Register <- client

	// Start the read and write pumps in separate goroutines.
	// These goroutines will exit when the connection closes.
	go client.writePump()
	go client.readPump()
}

// readPump pumps messages from the WebSocket connection to the Hub.
//
// A goroutine running readPump is started for each connection. The
// application ensures that there is at most one reader on a connection
// by executing all reads from this goroutine.
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
				log.Printf("ws read error: %v", err)
			}
			break
		}
		// Forward the message to the Hub for broadcasting.
		c.hub.Broadcast <- message
	}
}

// writePump pumps messages from the Hub to the WebSocket connection.
//
// A goroutine running writePump is started for each connection. The
// application ensures that there is at most one writer on a connection
// by executing all writes from this goroutine.
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
				// The Hub closed the channel — send a close frame.
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := c.conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Drain any queued messages into the same write frame for efficiency.
			n := len(c.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-c.Send)
			}

			if err := w.Close(); err != nil {
				return
			}

		case <-ticker.C:
			// Send a ping to keep the connection alive.
			c.conn.SetWriteDeadline(time.Now().Add(writeWait))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}
