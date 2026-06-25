import { useSettings } from '../store/useSettings.js';

// Marca reutilizable: muestra el logo en imagen si se subió, si no el emoji.
export default function BrandMark({ size = 22, withName = true, className = '' }) {
  const { logoUrl, logoEmoji, storeName } = useSettings();
  return (
    <span className={`brandmark ${className}`}>
      {logoUrl ? (
        <img className="brandmark-img" src={logoUrl} alt={storeName} style={{ height: size }} />
      ) : (
        <span className="brandmark-emoji" style={{ fontSize: size }}>{logoEmoji}</span>
      )}
      {withName && <span className="brandmark-name">{storeName}</span>}
    </span>
  );
}
