import React, { useState, useEffect } from 'react';
import { KeyRound, CheckCircle2, AlertCircle, Eye, EyeOff, X, ExternalLink } from 'lucide-react';
import { validateApiKey } from '../lib/geminiService';

interface ApiKeyBannerProps {
  onKeyReady: (key: string) => void;
}

const LS_KEY = 'vozstudio_gemini_api_key';

export function getStoredApiKey(): string {
  return localStorage.getItem(LS_KEY) || '';
}

export const ApiKeyBanner: React.FC<ApiKeyBannerProps> = ({ onKeyReady }) => {
  const [show, setShow] = useState(false);
  const [key, setKey] = useState('');
  const [visible, setVisible] = useState(false);
  const [status, setStatus] = useState<'idle' | 'validating' | 'valid' | 'invalid'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = getStoredApiKey();
    if (stored) {
      onKeyReady(stored);
      setShow(false);
    } else {
      setShow(true);
    }
  }, []);

  const handleValidate = async () => {
    if (!key.trim()) return;
    setStatus('validating');
    setErrorMsg('');
    try {
      const valid = await validateApiKey(key.trim());
      if (valid) {
        setStatus('valid');
        localStorage.setItem(LS_KEY, key.trim());
        onKeyReady(key.trim());
        setTimeout(() => setShow(false), 1200);
      } else {
        setStatus('invalid');
        setErrorMsg('API key inválida. Verifica en Google AI Studio.');
      }
    } catch {
      setStatus('invalid');
      setErrorMsg('No se pudo conectar con Gemini. Verifica la key.');
    }
  };

  const handleRemove = () => {
    localStorage.removeItem(LS_KEY);
    setKey('');
    setStatus('idle');
    setShow(true);
  };

  if (!show && !dismissed) return null;

  return (
    <div className="w-full border-b border-amber-200 bg-amber-50 px-4 py-3">
      <div className="mx-auto flex max-w-7xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: message */}
        <div className="flex items-start gap-3">
          <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
            <KeyRound className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold text-amber-900">
              Se requiere una Gemini API Key para generar voz
            </p>
            <p className="text-xs text-amber-700">
              Obtén tu clave gratis en{' '}
              <a
                href="https://aistudio.google.com/app/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-0.5 font-medium underline underline-offset-2 hover:text-amber-900"
              >
                Google AI Studio <ExternalLink className="h-3 w-3" />
              </a>
              . Se guarda solo en tu navegador.
            </p>
          </div>
        </div>

        {/* Right: input */}
        <div className="flex items-center gap-2">
          <div className="relative flex items-center">
            <input
              type={visible ? 'text' : 'password'}
              value={key}
              onChange={(e) => {
                setKey(e.target.value);
                setStatus('idle');
              }}
              onKeyDown={(e) => e.key === 'Enter' && handleValidate()}
              placeholder="AIza..."
              className={`w-64 rounded-lg border px-3 py-2 pr-10 font-mono text-xs shadow-sm outline-none transition-all focus:ring-2 ${
                status === 'valid'
                  ? 'border-emerald-400 bg-emerald-50 ring-emerald-200'
                  : status === 'invalid'
                  ? 'border-rose-400 bg-rose-50 ring-rose-200'
                  : 'border-amber-300 bg-white focus:border-amber-400 focus:ring-amber-200'
              }`}
            />
            <button
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 text-amber-500 hover:text-amber-700"
              title={visible ? 'Ocultar' : 'Mostrar'}
            >
              {visible ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </button>
          </div>

          <button
            onClick={handleValidate}
            disabled={!key.trim() || status === 'validating'}
            className={`flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-bold transition-all ${
              status === 'validating'
                ? 'cursor-wait bg-amber-300 text-amber-800'
                : status === 'valid'
                ? 'bg-emerald-500 text-white'
                : 'bg-amber-500 text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-50'
            }`}
          >
            {status === 'validating' && (
              <span className="h-3 w-3 animate-spin rounded-full border-2 border-white border-t-transparent" />
            )}
            {status === 'valid' && <CheckCircle2 className="h-3.5 w-3.5" />}
            {status === 'validating' ? 'Verificando…' : status === 'valid' ? '¡Listo!' : 'Guardar Key'}
          </button>

          <button
            onClick={() => setDismissed(true)}
            className="ml-1 rounded-md p-1.5 text-amber-500 hover:bg-amber-100 hover:text-amber-700"
            title="Cerrar (sin guardar)"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Error message */}
      {status === 'invalid' && errorMsg && (
        <div className="mx-auto mt-2 flex max-w-7xl items-center gap-1.5 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" />
          {errorMsg}
        </div>
      )}
    </div>
  );
};

/** Small button to reset/change the stored API key */
export const ApiKeyResetButton: React.FC<{ onClick: () => void }> = ({ onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[10px] font-semibold text-slate-500 shadow-xs transition hover:bg-slate-50 hover:text-slate-700"
    title="Cambiar Gemini API Key"
  >
    <KeyRound className="h-3 w-3" />
    API Key
  </button>
);
