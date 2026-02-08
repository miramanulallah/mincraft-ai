
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality } from '@google/genai';
import { Message } from './types.ts';
import { minecraftAI } from './services/geminiService.ts';
import MinecraftButton from './components/MinecraftButton.tsx';
import ChatBubble from './components/ChatBubble.tsx';

// --- Audio Helpers ---
function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLive, setIsLive] = useState(false);
  const [transcription, setTranscription] = useState('');
  const [textInput, setTextInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  
  // Audio Refs
  const audioContexts = useRef<{ input: AudioContext; output: AudioContext } | null>(null);
  const sessionRef = useRef<any>(null);
  const nextStartTimeRef = useRef(0);
  const sourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());

  // Initialize Audio Contexts
  const initAudio = () => {
    if (!audioContexts.current) {
      audioContexts.current = {
        input: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 }),
        output: new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 }),
      };
    }
  };

  const addMessage = useCallback((role: 'user' | 'assistant', content: string) => {
    setMessages(prev => [
      ...prev,
      { id: Date.now().toString() + Math.random(), role, content, timestamp: Date.now() }
    ]);
  }, []);

  const handleTextSend = async () => {
    if (!textInput.trim() || isTyping) return;
    
    const userPrompt = textInput;
    setTextInput('');
    addMessage('user', userPrompt);
    setIsTyping(true);

    try {
      const history = messages.slice(-10).map(m => ({
        role: m.role,
        content: m.content
      }));
      const aiResponse = await minecraftAI.generateResponse(userPrompt, history);
      addMessage('assistant', aiResponse || "Oof!");
    } catch (error) {
      console.error(error);
    } finally {
      setIsTyping(false);
    }
  };

  const stopLiveSession = () => {
    if (sessionRef.current) {
      sessionRef.current.close();
      sessionRef.current = null;
    }
    setIsLive(false);
    for (const source of sourcesRef.current) {
      source.stop();
    }
    sourcesRef.current.clear();
  };

  const startLiveSession = async () => {
    initAudio();
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "" });
    
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      setIsLive(true);

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } },
          },
          systemInstruction: `You are "Minecraft AI". Be concise and blocky.
          CRITICAL: If the user speaks in Hindi, you MUST respond in Hindi but using ENGLISH LETTERS (Romanized Hindi).
          Example: "Aapka swagat hai!" instead of "आपका स्वागत है!".
          Keep all responses within the Minecraft theme.`,
          inputAudioTranscription: {},
          outputAudioTranscription: {},
        },
        callbacks: {
          onopen: () => {
            const source = audioContexts.current!.input.createMediaStreamSource(stream);
            const scriptProcessor = audioContexts.current!.input.createScriptProcessor(4096, 1, 1);
            
            scriptProcessor.onaudioprocess = (e) => {
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) {
                int16[i] = inputData[i] * 32768;
              }
              const pcmBlob = {
                data: encode(new Uint8Array(int16.buffer)),
                mimeType: 'audio/pcm;rate=16000',
              };
              sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
            };
            
            source.connect(scriptProcessor);
            scriptProcessor.connect(audioContexts.current!.input.destination);
          },
          onmessage: async (msg: LiveServerMessage) => {
            const base64Audio = msg.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
            if (base64Audio) {
              const outCtx = audioContexts.current!.output;
              nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outCtx.currentTime);
              const audioBuffer = await decodeAudioData(decode(base64Audio), outCtx, 24000, 1);
              const source = outCtx.createBufferSource();
              source.buffer = audioBuffer;
              source.connect(outCtx.destination);
              source.start(nextStartTimeRef.current);
              nextStartTimeRef.current += audioBuffer.duration;
              sourcesRef.current.add(source);
              source.onended = () => sourcesRef.current.delete(source);
            }

            if (msg.serverContent?.inputTranscription) {
              setTranscription(t => t + " " + msg.serverContent!.inputTranscription!.text);
            }
            if (msg.serverContent?.outputTranscription) {
              addMessage('assistant', msg.serverContent.outputTranscription.text);
            }
            if (msg.serverContent?.turnComplete) {
              setTranscription('');
            }
            if (msg.serverContent?.interrupted) {
              for (const s of sourcesRef.current) s.stop();
              sourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onclose: () => setIsLive(false),
          onerror: (e) => console.error("Live session error:", e),
        }
      });

      sessionRef.current = await sessionPromise;
    } catch (err) {
      console.error("Failed to start Live session:", err);
      setIsLive(false);
    }
  };

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, transcription, isTyping]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#111] p-2 md:p-4 overflow-hidden">
      <main className="w-full max-w-2xl h-[92vh] bg-[#222] border-4 border-[#000] flex flex-col shadow-2xl relative">
        
        <header className="bg-[#333] border-b-4 border-[#000] p-2 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <div className="w-5 h-5 bg-green-700 border-2 border-black pixelated"></div>
            <h1 className="text-white text-[8px] tracking-tight">MINECRAFT AI</h1>
          </div>
          <div className="flex gap-0.5">
             {[...Array(10)].map((_, i) => (
               <span key={i} className="text-red-600 text-[7px]">❤</span>
             ))}
          </div>
        </header>

        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-2 bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] bg-[#1a1a1a]"
          style={{ imageRendering: 'pixelated' }}
        >
          {messages.length === 0 && (
            <div className="text-center mt-6">
              <p className="text-gray-600 text-[7px]">WORLD GENERATED</p>
              <p className="text-gray-500 text-[6px] mt-1">SAY 'NAMASTE' OR 'HELLO'</p>
            </div>
          )}
          {messages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} />
          ))}
          {transcription && (
            <div className="flex justify-end mb-2">
              <div className="bg-blue-950/20 border-2 border-blue-900/40 p-1.5 max-w-[80%]">
                <p className="text-[6px] text-blue-400 animate-pulse italic">{transcription}...</p>
              </div>
            </div>
          )}
          {isTyping && (
            <div className="flex justify-start mb-2">
              <div className="bg-gray-800 border-2 border-gray-700 p-1.5">
                <p className="text-[6px] text-gray-400 animate-pulse">MINING RESPONSE...</p>
              </div>
            </div>
          )}
        </div>

        <footer className="bg-[#333] border-t-4 border-[#000] p-2 flex flex-col gap-2">
          {/* Text Input Row */}
          <div className="flex gap-2 bg-[#1a1a1a] p-1 border-2 border-black">
             <input 
               type="text" 
               className="flex-1 bg-transparent text-white outline-none text-[8px] px-1 h-6 font-sans"
               placeholder="Chat or speak..."
               value={textInput}
               onChange={(e) => setTextInput(e.target.value)}
               onKeyDown={(e) => e.key === 'Enter' && handleTextSend()}
             />
             <MinecraftButton onClick={handleTextSend} disabled={isTyping || !textInput.trim()}>
                GO
             </MinecraftButton>
          </div>

          {/* Voice/System Row */}
          <div className="flex items-center justify-between gap-2">
             <MinecraftButton 
               variant={isLive ? 'active' : 'primary'}
               onClick={isLive ? stopLiveSession : startLiveSession}
               className="w-24 h-6"
             >
               {isLive ? '🎙 ACTIVE' : '🎙 MIC'}
             </MinecraftButton>

             <div className="flex gap-0.5">
                {[...Array(9)].map((_, i) => (
                  <div key={i} className="w-4 h-4 bg-[#444] border-2 border-black flex items-center justify-center">
                     {i === 0 && isLive && <div className="w-2 h-2 bg-red-600 animate-ping"></div>}
                  </div>
                ))}
             </div>
          </div>

          <div className="flex gap-2 text-[5px] text-gray-600 justify-center uppercase">
             <span>SURVIVAL</span>
             <span>ROMANIZED HINDI MODE</span>
             <span>DPI: COMPACT</span>
          </div>
        </footer>
      </main>
      
      <div className="fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,_#222_0%,_#000_100%)]"></div>
    </div>
  );
};

export default App;
