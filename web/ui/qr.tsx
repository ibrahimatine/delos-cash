// Scannable QR code of a Lightning invoice (DESIGN §2.13), drawn as one SVG
// path. The frame is Bitcoin orange: this QR is Lightning (DESIGN §1.5).
import qrcode from 'qrcode-generator'
import { useMemo } from 'react'
import { cx } from '../ui/primitives.tsx'

const QUIET = 3

export const QrCode = (
  { value, dim, className }: {
    value: string
    dim?: boolean
    className?: string
  },
) => {
  const { size, d } = useMemo(() => {
    // BOLT11 invoices are shown uppercase in QR codes (smaller, standard)
    const qr = qrcode(0, 'M')
    qr.addData(`lightning:${value}`.toUpperCase(), 'Alphanumeric')
    qr.make()
    const n = qr.getModuleCount()
    let path = ''
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        if (qr.isDark(y, x)) path += `M${x + QUIET} ${y + QUIET}h1v1h-1z`
      }
    }
    return { size: n + QUIET * 2, d: path }
  }, [value])
  return (
    <div
      className={cx(
        'p-2 rounded-2xl border-[3px] border-btc bg-white transition-opacity duration-500',
        dim && 'opacity-15',
        className,
      )}
    >
      <svg
        viewBox={`0 0 ${size} ${size}`}
        role='img'
        aria-label='QR code de la facture Lightning'
        shapeRendering='crispEdges'
        className='w-full h-auto block'
      >
        <rect width={size} height={size} fill='#fff' />
        <path d={d} fill='#111' />
      </svg>
    </div>
  )
}
