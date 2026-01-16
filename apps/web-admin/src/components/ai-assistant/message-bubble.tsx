'use client';

import { Message } from '@/lib/ai-assistant/types';
import { DataCard } from './data-card';

interface MessageBubbleProps {
  message: Message;
}

export function MessageBubble({ message }: MessageBubbleProps) {
  const isUser = message.role === 'user';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`flex items-start gap-3 max-w-[80%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
        {/* Avatar */}
        <div
          className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
            isUser
              ? 'bg-primary text-white'
              : 'bg-gradient-to-br from-blue-500 to-purple-600 text-white'
          }`}
        >
          {isUser ? (
            <span className="material-symbols-outlined text-sm">person</span>
          ) : (
            <span className="material-symbols-outlined text-sm">smart_toy</span>
          )}
        </div>

        {/* Message Content */}
        <div className={`flex flex-col gap-2 ${isUser ? 'items-end' : 'items-start'}`}>
          <div
            className={`rounded-2xl px-4 py-3 ${
              isUser
                ? 'bg-primary text-white rounded-tr-sm'
                : 'bg-white dark:bg-gray-800 text-gray-900 dark:text-white shadow-sm border border-gray-100 dark:border-gray-700 rounded-tl-sm'
            }`}
          >
            {message.isLoading ? (
              <div className="flex items-center gap-2">
                <div className="flex space-x-1">
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            ) : (
              <div className="whitespace-pre-wrap text-sm leading-relaxed">
                {formatMessageContent(message.content)}
              </div>
            )}
          </div>

          {/* Data Card */}
          {message.data && !message.isLoading && (
            <DataCard data={message.data} />
          )}

          {/* Timestamp */}
          <span className="text-xs text-gray-400 px-1">
            {formatTime(message.timestamp)}
          </span>
        </div>
      </div>
    </div>
  );
}

function formatMessageContent(content: string): React.ReactNode {
  // Simple markdown-like formatting for bold text
  const parts = content.split(/(\*\*[^*]+\*\*)/g);

  return parts.map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={index} className="font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function formatTime(date: Date): string {
  return new Date(date).toLocaleTimeString('fr-FR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}
