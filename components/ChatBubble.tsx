
import React from 'react';
import { Message } from '../types';

interface ChatBubbleProps {
  message: Message;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isAssistant = message.role === 'assistant';

  return (
    <div className={`flex flex-col mb-3 ${isAssistant ? 'items-start' : 'items-end'}`}>
      <div className="flex items-center gap-1 mb-0.5">
        <span className={`text-[6px] uppercase ${isAssistant ? 'text-green-500' : 'text-blue-500'}`}>
          {isAssistant ? 'Crafty' : 'You'}
        </span>
      </div>
      <div 
        className={`
          max-w-[90%] p-2 border-2 relative
          ${isAssistant 
            ? 'bg-gray-800 border-gray-700 text-white' 
            : 'bg-green-950 border-green-900 text-white'
          }
        `}
        style={{
          boxShadow: '2px 2px 0px rgba(0,0,0,0.5)',
        }}
      >
        <p className="text-[8px] leading-tight break-words whitespace-pre-wrap font-sans">
          {message.content}
        </p>
      </div>
    </div>
  );
};

export default ChatBubble;
