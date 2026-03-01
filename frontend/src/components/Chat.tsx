import { useState, useRef, useEffect, useCallback } from 'react'
import type { Message } from '../types/models'

const MIN_WIDTH = 280
const MAX_WIDTH = 600

interface ChatProps {
    messages: Message[]
    onSend: (type: Message['type'], payload: string) => void
    readyState: string
    currentUsername: string
    connectedUsers: string[]
    width: number
    onWidthChange: (width: number) => void
}

export function Chat({
    messages,
    onSend,
    readyState,
    currentUsername,
    connectedUsers,
    width,
    onWidthChange,
}: ChatProps) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)
    const isDragging = useRef(false)

    const isConnected = readyState === 'open'
    const chatMessages = messages.filter((m) => m.type === 'chat' || m.type === 'system')

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }, [messages])

    const handleSend = (e: React.FormEvent) => {
        e.preventDefault()
        const trimmed = input.trim()
        if (!trimmed) return
        onSend('chat', trimmed)
        setInput('')
    }

    const handleMouseDown = useCallback((e: React.MouseEvent) => {
        e.preventDefault()
        isDragging.current = true
        const startX = e.clientX
        const startWidth = width

        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging.current) return
            const delta = startX - e.clientX
            const newWidth = Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, startWidth + delta))
            onWidthChange(newWidth)
        }

        const handleMouseUp = () => {
            isDragging.current = false
            document.removeEventListener('mousemove', handleMouseMove)
            document.removeEventListener('mouseup', handleMouseUp)
            document.body.style.cursor = ''
            document.body.style.userSelect = ''
        }

        document.body.style.cursor = 'col-resize'
        document.body.style.userSelect = 'none'
        document.addEventListener('mousemove', handleMouseMove)
        document.addEventListener('mouseup', handleMouseUp)
    }, [width, onWidthChange])

    return (
        <div
            className="flex h-full"
            style={{ width: `${width}px`, minWidth: `${MIN_WIDTH}px`, maxWidth: `${MAX_WIDTH}px` }}
        >
            {/* Drag handle */}
            <div
                className="w-1.5 flex-shrink-0 cursor-col-resize transition-colors duration-150 rounded-l"
                style={{ backgroundColor: 'transparent' }}
                onMouseDown={handleMouseDown}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'var(--accent-border)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
            />

            {/* Chat content */}
            <div
                className="flex-1 flex flex-col backdrop-blur-sm rounded-r-2xl overflow-hidden min-w-0"
                style={{ backgroundColor: 'var(--bg-overlay)', border: '1px solid var(--border)' }}
            >
                {/* Header */}
                <div
                    className="flex items-center justify-between px-4 py-3"
                    style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}
                >
                    <h2 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Chat</h2>
                    <div className="flex items-center gap-2">
                        <span
                            className={`w-2 h-2 rounded-full ${
                                isConnected
                                    ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                                    : 'bg-red-400 shadow-sm shadow-red-400/50'
                            }`}
                        />
                        <span className="text-[10px] font-mono uppercase" style={{ color: 'var(--text-tertiary)' }}>
                            {isConnected ? 'Live' : readyState}
                        </span>
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
                    {chatMessages.length === 0 && (
                        <p className="text-center text-sm py-8" style={{ color: 'var(--text-muted)' }}>
                            No messages yet. Say hello!
                        </p>
                    )}

                    {chatMessages.map((msg, i) => {
                        if (msg.type === 'system') {
                            return <SystemMessage key={i} msg={msg} />
                        }
                        const isOwn = msg.sender === currentUsername
                        return <ChatBubble key={i} msg={msg} isOwn={isOwn} />
                    })}

                    <div ref={messagesEndRef} />
                </div>

                {/* Input area */}
                <div style={{ borderTop: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
                    <form onSubmit={handleSend} className="flex items-center gap-2 px-3 py-2">
                        <input
                            type="text"
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            disabled={!isConnected}
                            placeholder={isConnected ? 'Text here' : 'Reconnecting...'}
                            className="min-w-0 flex-1 px-3 py-2 rounded-lg text-sm outline-none transition-all duration-200 disabled:opacity-50"
                            style={{
                                backgroundColor: 'var(--bg-input)',
                                border: '1px solid var(--border)',
                                color: 'var(--text-primary)',
                            }}
                            onFocus={(e) => { e.target.style.boxShadow = '0 0 0 1px var(--accent-ring)'; e.target.style.borderColor = 'var(--accent-ring)' }}
                            onBlur={(e) => { e.target.style.boxShadow = 'none'; e.target.style.borderColor = 'var(--border)' }}
                        />
                        <button
                            type="submit"
                            disabled={!isConnected || !input.trim()}
                            className="flex-shrink-0 px-3 py-2 text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed"
                            style={{
                                backgroundColor: 'var(--accent-dark)',
                                color: 'var(--text-on-accent)',
                            }}
                        >
                            Send
                        </button>
                    </form>

                    {/* Bottom toolbar */}
                    <div className="flex items-center gap-1 px-3 pb-2">
                        <ToolbarButton title={`${connectedUsers.length} users online`}>
                            <span className="text-[10px] font-bold mr-0.5" style={{ color: 'var(--accent-light)' }}>{connectedUsers.length}</span>
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                                <circle cx="9" cy="7" r="4" />
                                <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                                <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                            </svg>
                        </ToolbarButton>

                        <ToolbarButton title="Chat info (coming soon)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M12 16v-4" />
                                <path d="M12 8h.01" />
                            </svg>
                        </ToolbarButton>

                        <ToolbarButton title="Emoji (coming soon)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                                <line x1="9" x2="9.01" y1="9" y2="9" />
                                <line x1="15" x2="15.01" y1="9" y2="9" />
                            </svg>
                        </ToolbarButton>

                        <ToolbarButton title="Attach file (coming soon)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
                            </svg>
                        </ToolbarButton>

                        <ToolbarButton title="Help (coming soon)">
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <circle cx="12" cy="12" r="10" />
                                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
                                <path d="M12 17h.01" />
                            </svg>
                        </ToolbarButton>
                    </div>
                </div>
            </div>
        </div>
    )
}

function ToolbarButton({ children, title }: { children: React.ReactNode; title: string }) {
    return (
        <button
            className="flex items-center gap-0.5 px-1.5 py-1 rounded transition-colors duration-150"
            style={{ color: 'var(--text-tertiary)' }}
            onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.backgroundColor = 'var(--bg-overlay)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-tertiary)'; e.currentTarget.style.backgroundColor = 'transparent' }}
            title={title}
            type="button"
        >
            {children}
        </button>
    )
}

function ChatBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })

    const avatar = (
        <div
            className="w-8 h-8 rounded flex-shrink-0 flex items-center justify-center text-xs font-bold"
            style={{
                backgroundColor: isOwn ? 'var(--accent-dark)' : 'var(--control-bg)',
                color: 'var(--text-on-accent)',
            }}
        >
            {msg.sender.charAt(0).toUpperCase()}
        </div>
    )

    return (
        <div className={`flex gap-2 ${isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {avatar}
            <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'} min-w-0 flex-1`}>
                <div className={`flex items-center gap-2 mb-0.5 ${isOwn ? 'flex-row-reverse' : ''}`}>
                    <span className="text-[11px] font-medium" style={{ color: 'var(--text-secondary)' }}>{isOwn ? 'me' : msg.sender}</span>
                    <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{time}</span>
                </div>
                <div
                    className="max-w-[90%] px-3 py-2 rounded text-sm break-words"
                    style={{
                        backgroundColor: isOwn ? 'var(--msg-own-bg)' : 'var(--msg-other-bg)',
                        color: isOwn ? 'var(--msg-own-text)' : 'var(--msg-other-text)',
                        border: `1px solid ${isOwn ? 'var(--msg-own-border)' : 'var(--msg-other-border)'}`,
                    }}
                >
                    {msg.payload}
                </div>
            </div>
        </div>
    )
}

function SystemMessage({ msg }: { msg: Message }) {
    let text = msg.payload
    try {
        const data = JSON.parse(msg.payload) as { event: string; username: string }
        if (data.event === 'user_joined') {
            text = `${data.username} joined`
        } else if (data.event === 'user_left') {
            text = `${data.username} left`
        }
    } catch {
        // Fallback to raw payload
    }

    return (
        <div className="flex justify-center py-1">
            <span
                className="text-[10px] px-3 py-1 rounded-full"
                style={{ color: 'var(--text-tertiary)', backgroundColor: 'var(--bg-card)' }}
            >
                {text}
            </span>
        </div>
    )
}
