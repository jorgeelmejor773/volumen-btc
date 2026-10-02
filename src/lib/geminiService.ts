/**
 * Browser-side Gemini TTS service — no backend needed.
 * Calls the Gemini API directly from the browser using the stored API key.
 */
import { GoogleGenAI, Modality } from '@google/genai';
import { base64ToUint8Array, uint8ArrayToBase64 } from '../utils/audioUtils';

function wrapPcmInWav(
  pcmBase64: string,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): string {
  const pcmArray = base64ToUint8Array(pcmBase64);

  // Already a WAV file?
  if (
    pcmArray.length >= 4 &&
    pcmArray[0] === 0x52 &&
    pcmArray[1] === 0x49 &&
    pcmArray[2] === 0x46 &&
    pcmArray[3] === 0x46
  ) {
    return pcmBase64;
  }

  const dataLength = pcmArray.length;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;

  const header = new Uint8Array(44);
  const view = new DataView(header.buffer);

  // RIFF
  header.set([0x52, 0x49, 0x46, 0x46], 0);
  view.setUint32(4, 36 + dataLength, true);
  header.set([0x57, 0x41, 0x56, 0x45], 8);
  // fmt
  header.set([0x66, 0x6d, 0x74, 0x20], 12);
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  // data
  header.set([0x64, 0x61, 0x74, 0x61], 36);
  view.setUint32(40, dataLength, true);

  const wav = new Uint8Array(44 + dataLength);
  wav.set(header, 0);
  wav.set(pcmArray, 44);

  return uint8ArrayToBase64(wav);
}

function buildClient(apiKey: string): GoogleGenAI {
  if (!apiKey) throw new Error('GEMINI_API_KEY no configurada.');
  return new GoogleGenAI({ apiKey });
}

export interface TtsGenerateParams {
  text: string;
  voiceName?: string;
  accent?: string;
  tone?: string;
  customInstruction?: string;
  multiSpeaker?: boolean;
  speakerVoiceConfigs?: { speaker: string; voiceName: string }[];
}

export interface TtsResult {
  audioBase64: string;
  duration: number;
}

export async function generateTts(
  apiKey: string,
  params: TtsGenerateParams
): Promise<TtsResult> {
  const {
    text,
    voiceName = 'Kore',
    accent = 'Español Neutro',
    tone = 'Natural y claro',
    customInstruction = '',
    multiSpeaker = false,
    speakerVoiceConfigs = [],
  } = params;

  if (!text.trim()) throw new Error('El texto es obligatorio.');

  const ai = buildClient(apiKey);

  let promptText = '';
  const speechConfig: Record<string, unknown> = {};

  if (multiSpeaker && speakerVoiceConfigs.length === 2) {
    promptText = `TTS the following conversation in Spanish with natural pronunciation:\n${text}`;
    speechConfig.multiSpeakerVoiceConfig = {
      speakerVoiceConfigs: speakerVoiceConfigs.map((s) => ({
        speaker: s.speaker,
        voiceConfig: { prebuiltVoiceConfig: { voiceName: s.voiceName } },
      })),
    };
  } else {
    const parts: string[] = [];
    if (accent) parts.push(`acento ${accent}`);
    if (tone) parts.push(`tono ${tone}`);
    if (customInstruction.trim()) parts.push(customInstruction.trim());
    const styleGuide = parts.length > 0 ? ` con ${parts.join(', ')}` : '';
    promptText = `Lee en español${styleGuide}: ${text}`;
    speechConfig.voiceConfig = {
      prebuiltVoiceConfig: { voiceName: voiceName || 'Kore' },
    };
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash-preview-tts',
    contents: [{ parts: [{ text: promptText }] }],
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig,
    },
  });

  const audioPart = response.candidates?.[0]?.content?.parts?.[0];
  const rawBase64 = audioPart?.inlineData?.data;

  if (!rawBase64) throw new Error('No se recibió audio del modelo Gemini TTS.');

  const wavBase64 = wrapPcmInWav(rawBase64);
  const pcmBytes = base64ToUint8Array(rawBase64);
  const duration = parseFloat((pcmBytes.length / (24000 * 2)).toFixed(2));

  return { audioBase64: wavBase64, duration };
}

export async function enhanceText(
  apiKey: string,
  text: string,
  mode = 'fluidez'
): Promise<string> {
  if (!text.trim()) return text;

  const ai = buildClient(apiKey);

  let instruction =
    'Eres un editor de guiones para locución y locutores profesionales en español.';
  if (mode === 'fluidez') {
    instruction +=
      ' Mejora la puntuación (agrega signos ¿ ?, ¡ !, comas para pausas de respiración naturales), manteniendo el mensaje exacto intacto.';
  } else if (mode === 'dramatismo') {
    instruction +=
      ' Añade pausas expresivas (puntos suspensivos, exclamaciones) para mayor dramatismo sin alterar el significado.';
  } else if (mode === 'comercial') {
    instruction +=
      ' Optimiza el texto para un spot comercial dinámico y persuasivo.';
  }

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: `Optimiza este texto para locución en español:\n\n"${text}"\n\nDevuelve ÚNICAMENTE el texto mejorado, sin explicaciones ni comillas extras.`,
    config: { systemInstruction: instruction, temperature: 0.3 },
  });

  return response.text?.trim() || text;
}

export async function validateApiKey(apiKey: string): Promise<boolean> {
  try {
    const ai = buildClient(apiKey);
    await ai.models.generateContent({
      model: 'gemini-2.0-flash',
      contents: [{ parts: [{ text: 'hi' }] }],
    });
    return true;
  } catch {
    return false;
  }
}
