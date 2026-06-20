import { useState } from 'react';
import './CopyButton.css';

const CLEAR_DELAY_MS = 30_000;

export function CopyButton({ text, label = 'Copiar' }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);

    // Limpia el portapapeles a los 30 segundos
    setTimeout(async () => {
      await navigator.clipboard.writeText('');
      setCopied(false);
    }, CLEAR_DELAY_MS);
  };

  return (
    <button className={`copy-btn ${copied ? 'copy-btn--copied' : ''}`} onClick={handleCopy}>
      <box-icon
        name={copied ? 'check' : 'copy'}
        color={copied ? 'var(--color-accent)' : 'var(--color-muted)'}
        size="16px"
      />
      <span>{copied ? 'Copiado' : label}</span>
    </button>
  );
}
