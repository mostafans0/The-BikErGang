import { useMemo } from 'react'
import { FittingRoom as FittingRoomStudio } from '@/components/FittingRoom'
import { buildWardrobe } from '@/features/fitting-room/catalog'

export default function FittingRoom() {
  const wardrobe = useMemo(() => buildWardrobe(), [])
  return (
    <div className="mx-auto max-w-7xl px-5 py-12 lg:px-8">
      <p className="eyebrow">Fitting Room</p>
      <h1 className="section-title mt-3">See it on you, before you buy.</h1>
      <p className="mt-4 max-w-2xl leading-7 text-muted-foreground">
        Upload a full-body photo and your device builds a proportional 3D avatar — your height, build, and skin tone.
        Dress it in helmets, jackets, gloves, trousers and boots, and get an instant, honest read on whether each
        piece <span className="text-foreground">fits</span> and whether the outfit{' '}
        <span className="text-foreground">looks good together</span>. No photo ever leaves your browser.
      </p>

      <div className="mt-8">
        <FittingRoomStudio wardrobe={wardrobe} />
      </div>

      <p className="mt-6 text-xs leading-5 text-muted-foreground">
        Fit and look are computed deterministically from your measurements and the garments’ sizes and colours — a
        guidance tool, not a guarantee. Always confirm sizing and certifications before riding.
      </p>
    </div>
  )
}
