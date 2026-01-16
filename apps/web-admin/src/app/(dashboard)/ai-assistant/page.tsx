'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Message, QueryResult } from '@/lib/ai-assistant/types';
import { MessageBubble } from '@/components/ai-assistant/message-bubble';

const SUGGESTED_QUESTIONS = [
  { text: "Combien d'hôtels enregistrés à Dakar?", icon: 'hotel' },
  { text: "Combien d'Airbnb non conformes à Gorée?", icon: 'warning' },
  { text: 'Revenus totaux ce mois?', icon: 'payments' },
  { text: "Taux d'occupation à Saly?", icon: 'trending_up' },
  { text: 'Alertes critiques ouvertes?', icon: 'notifications' },
  { text: "Quels établissements n'ont pas déclaré?", icon: 'assignment_late' },
];

export default function AIAssistantPage() {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Bonjour! Je suis l'Assistant IA de Gestoo. Je peux vous aider à analyser les données touristiques du Sénégal. Posez-moi une question sur les propriétés, les revenus, les alertes, ou toute autre donnée.",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, scrollToBottom]);

  const sendMessage = async (content: string) => {
    if (!content.trim() || isLoading) return;

    const userMessage: Message = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: content.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue('');
    setIsLoading(true);

    // Add loading message
    const loadingId = `loading-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: loadingId,
        role: 'assistant',
        content: '',
        timestamp: new Date(),
        isLoading: true,
      },
    ]);

    try {
      const conversationHistory = messages
        .filter((m) => m.id !== 'welcome')
        .map((m) => ({
          role: m.role,
          content: m.content,
        }));

      const response = await fetch('/api/ai-assistant/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: content.trim(),
          conversationHistory,
        }),
      });

      const data = await response.json();

      // Remove loading message and add response
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        return [
          ...filtered,
          {
            id: `assistant-${Date.now()}`,
            role: 'assistant',
            content: data.response || data.error || "Désolé, une erreur s'est produite.",
            timestamp: new Date(),
            data: data.data as QueryResult | undefined,
          },
        ];
      });
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages((prev) => {
        const filtered = prev.filter((m) => m.id !== loadingId);
        return [
          ...filtered,
          {
            id: `error-${Date.now()}`,
            role: 'assistant',
            content: "Désolé, une erreur réseau s'est produite. Veuillez réessayer.",
            timestamp: new Date(),
          },
        ];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(inputValue);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const handleSuggestionClick = (question: string) => {
    sendMessage(question);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] bg-gray-50 dark:bg-gray-900">
      {/* Header */}
      <div className="flex-shrink-0 px-6 py-4 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
            <span className="material-symbols-outlined text-white">smart_toy</span>
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Assistant IA</h1>
            <p className="text-sm text-gray-500">Analyse des données touristiques</p>
          </div>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-4">
          {messages.map((message) => (
            <MessageBubble key={message.id} message={message} />
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Suggested Questions */}
      {messages.length <= 2 && (
        <div className="flex-shrink-0 px-4 pb-4">
          <div className="max-w-3xl mx-auto">
            <p className="text-sm text-gray-500 mb-3">Questions suggérées:</p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSuggestionClick(q.text)}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 hover:border-primary transition-colors disabled:opacity-50"
                >
                  <span className="material-symbols-outlined text-base text-gray-400">
                    {q.icon}
                  </span>
                  {q.text}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Input Area */}
      <div className="flex-shrink-0 px-4 pb-4 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-3xl mx-auto">
          <form onSubmit={handleSubmit} className="relative">
            <div className="relative bg-white dark:bg-gray-800 rounded-2xl border border-gray-200 dark:border-gray-700 shadow-sm overflow-hidden">
              <textarea
                ref={inputRef}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Posez votre question..."
                rows={1}
                disabled={isLoading}
                className="w-full px-4 py-3 pr-14 resize-none bg-transparent text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none disabled:opacity-50"
                style={{ minHeight: '48px', maxHeight: '120px' }}
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isLoading}
                className="absolute right-2 bottom-2 w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <span className="material-symbols-outlined">send</span>
                )}
              </button>
            </div>
            <p className="mt-2 text-xs text-center text-gray-400">
              Appuyez sur Entrée pour envoyer, Shift+Entrée pour une nouvelle ligne
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
