import './Toast.css';

export function Toast({ message, type = 'info', onClose }) {
  if (!message) return null;

  return (
    <div className={`toast toast--${type}`}>
      <span>{message}</span>
      <button className="toast-close" onClick={onClose}>✕</button>
    </div>
  );
}
