package game

import "sync"

// Manager holds all active game sessions keyed by room ID.
type Manager struct {
	mu       sync.RWMutex
	sessions map[string]*Session
}

func NewManager() *Manager {
	return &Manager{
		sessions: make(map[string]*Session),
	}
}

func (m *Manager) Get(roomID string) (*Session, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	s, ok := m.sessions[roomID]
	return s, ok
}

func (m *Manager) Set(roomID string, s *Session) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.sessions[roomID] = s
}

func (m *Manager) Delete(roomID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.sessions, roomID)
}
