import { useMemo } from 'react';
import { CartLine } from '../db/localDb';

/**
 * Fase 3.1 — Carrito + Checkout por WhatsApp.
 * No usa pasarela: arma un mensaje URL-encoded con el detalle, el total y los
 * datos bancarios y redirige al cliente a wa.me. Antes de redirigir, registra
 * la orden en el backend como PENDIENTE_VALIDACION (reserva stock).
 */

interface BankInfo {
  bankName: string;
  bankAccount: string;
  bankHolder: string;
  whatsapp: string; // número de la ferretería, formato internacional sin '+'
}

interface CartProps {
  lines: CartLine[];
  bank: BankInfo;
  customerName?: string;
  /** Crea la orden en el backend y devuelve su código. */
  onCheckout: (lines: CartLine[]) => Promise<{ code: string }>;
  onRemove: (productUnitId: string) => void;
}

function buildWhatsappMessage(
  orderCode: string,
  lines: CartLine[],
  total: number,
  bank: BankInfo,
  customerName?: string,
): string {
  const items = lines
    .map((l) => `• ${l.quantity} ${l.unit} ${l.name} — $${(l.quantity * l.unitPrice).toFixed(2)}`)
    .join('\n');

  const msg =
    `🧾 *Pedido ${orderCode}*\n` +
    (customerName ? `Cliente: ${customerName}\n` : '') +
    `\n${items}\n\n` +
    `*TOTAL: $${total.toFixed(2)}*\n\n` +
    `💳 *Datos para transferencia:*\n` +
    `Banco: ${bank.bankName}\n` +
    `Cuenta: ${bank.bankAccount}\n` +
    `Titular: ${bank.bankHolder}\n\n` +
    `Envía el comprobante por aquí para validar tu pedido. ¡Gracias!`;

  return encodeURIComponent(msg);
}

export default function Cart({ lines, bank, customerName, onCheckout, onRemove }: CartProps) {
  const total = useMemo(
    () => lines.reduce((sum, l) => sum + l.quantity * l.unitPrice, 0),
    [lines],
  );

  async function handleFinish() {
    if (lines.length === 0) return;
    // 1. Registrar la orden (reserva stock, estado PENDIENTE_VALIDACION).
    const { code } = await onCheckout(lines);
    // 2. Construir el mensaje y redirigir a WhatsApp.
    const text = buildWhatsappMessage(code, lines, total, bank, customerName);
    const url = `https://wa.me/${bank.whatsapp}?text=${text}`;
    window.open(url, '_blank');
  }

  return (
    <aside className="cart">
      <h2>Carrito</h2>
      {lines.length === 0 && <p className="muted">Tu carrito está vacío</p>}
      <ul>
        {lines.map((l) => (
          <li key={l.productUnitId}>
            <span>
              {l.quantity} {l.unit} · {l.name}
            </span>
            <span>${(l.quantity * l.unitPrice).toFixed(2)}</span>
            <button onClick={() => onRemove(l.productUnitId)} aria-label="Quitar">
              ✕
            </button>
          </li>
        ))}
      </ul>
      <div className="cart-total">
        <strong>Total</strong>
        <strong>${total.toFixed(2)}</strong>
      </div>
      <button className="btn-whatsapp" disabled={lines.length === 0} onClick={handleFinish}>
        Finalizar por WhatsApp
      </button>
    </aside>
  );
}
