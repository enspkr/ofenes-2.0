import { useState, useRef, useEffect } from 'react'
import type { Message } from '../types/models'

interface ChatProps {
    messages: Message[]
    onSend: (type: Message['type'], payload: string) => void
    readyState: string
    currentUsername: string
}

/**
 * Chat — real-time chat panel with message list, input, and system notifications.
 */
export function Chat({ messages, onSend, readyState, currentUsername }: ChatProps) {
    const [input, setInput] = useState('')
    const messagesEndRef = useRef<HTMLDivElement>(null)

    // Auto-scroll to bottom on new messages
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

    const isConnected = readyState === 'open'

    return (
        <div className="flex flex-col h-full bg-slate-900/50 backdrop-blur-sm border border-slate-700 rounded-2xl overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700 bg-slate-800/50">
                <h2 className="text-base font-semibold text-slate-200">Chat</h2>
                <div className="flex items-center gap-2">
                    <span
                        className={`w-2.5 h-2.5 rounded-full ${isConnected
                            ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50'
                            : 'bg-red-400 shadow-sm shadow-red-400/50'
                            }`}
                    />
                    <span className="text-xs font-mono text-slate-500 uppercase">
                        {isConnected ? 'Live' : readyState}
                    </span>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2 scrollbar-thin">
                {messages.length === 0 && (
                    <p className="text-center text-sm text-slate-600 py-8">
                        No messages yet. Say hello! 👋
                    </p>
                )}

                {messages.map((msg, i) => {
                    if (msg.type === 'system') {
                        return <SystemMessage key={i} msg={msg} />
                    }
                    const isOwn = msg.sender === currentUsername
                    return <ChatBubble key={i} msg={msg} isOwn={isOwn} />
                })}

                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <form
                onSubmit={handleSend}
                className="flex items-center gap-2 px-4 py-3 border-t border-slate-700 bg-slate-800/30"
            >
                <input
                    type="text"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    disabled={!isConnected}
                    placeholder={isConnected ? 'Type a message...' : 'Reconnecting...'}
                    className="flex-1 px-4 py-2 bg-slate-900/50 border border-slate-700 rounded-lg text-slate-200 text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 transition-all duration-200 disabled:opacity-50"
                />
                <button
                    type="submit"
                    disabled={!isConnected || !input.trim()}
                    className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 hover:from-cyan-400 hover:to-blue-400 text-white text-sm font-medium rounded-lg transition-all duration-200 disabled:opacity-30 disabled:cursor-not-allowed shadow-lg shadow-cyan-500/20"
                >
                    Send
                </button>
            </form>
        </div>
    )
}

/** Individual chat message bubble */
function ChatBubble({ msg, isOwn }: { msg: Message; isOwn: boolean }) {
    const time = new Date(msg.timestamp).toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit',
    })

    return (
        <div className={`flex flex-col ${isOwn ? 'items-end' : 'items-start'}`}>
            {!isOwn && (
                <span className="text-xs text-slate-500 ml-1 mb-0.5">{msg.sender}</span>
            )}
            <div
                className={`max-w-[80%] px-3.5 py-2 rounded-2xl text-sm ${isOwn
                    ? 'bg-cyan-600/80 text-white rounded-br-md'
                    : 'bg-slate-700/80 text-slate-200 rounded-bl-md'
                    }`}
            >
                {msg.payload}
            </div>
            <span className="text-[10px] text-slate-600 mt-0.5 mx-1">{time}</span>
        </div>
    )
}

/** System notification (join/leave) */
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
            <span className="text-xs text-slate-500 bg-slate-800/50 px-3 py-1 rounded-full">
                {text}
            </span>
        </div>
    )
}
