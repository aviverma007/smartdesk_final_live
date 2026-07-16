export default function Modal({ title, children, onClose, actions }) {
  return (
    <div className="mback" onClick={(e) => { if (e.target === e.currentTarget) onClose?.(); }}>
      <div className="modal">
        {title && <h3>{title}</h3>}
        <div>{children}</div>
        {actions && <div className="actions">{actions}</div>}
      </div>
    </div>
  );
}
