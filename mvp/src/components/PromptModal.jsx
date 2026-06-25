import { useEffect, useRef, useState } from 'react';
import { useUI } from '../store/useUI.js';

// Modal de input (reemplaza window.prompt). Promesa resuelta por useUI.ask().
export default function PromptModal() {
  const prompt = useUI((s) => s.prompt);
  const closePrompt = useUI((s) => s.closePrompt);
  const [value, setValue] = useState('');
  const inputRef = useRef(null);

  useEffect(() => {
    setValue('');
    if (prompt) setTimeout(() => inputRef.current?.focus(), 50);
  }, [prompt]);

  if (!prompt) return null;

  const confirm = () => closePrompt(value.trim() || null);

  return (
    <div className="modal-overlay" onClick={() => closePrompt(null)}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <h3>{prompt.title}</h3>
        {prompt.label && <label className="modal-label">{prompt.label}</label>}
        <input
          ref={inputRef}
          className="modal-input"
          value={value}
          placeholder={prompt.placeholder}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') confirm();
            if (e.key === 'Escape') closePrompt(null);
          }}
        />
        <div className="modal-actions">
          <button className="btn-ghost" onClick={() => closePrompt(null)}>Cancelar</button>
          <button className="btn-primary" onClick={confirm}>{prompt.confirmText}</button>
        </div>
      </div>
    </div>
  );
}
