import { cn } from '@/lib/utils'
import DotGrid from '@/vendor/reactbits/DotGrid'
import { HeroStory } from './HeroStory'

// The two v4 effects in Figma: the dot background behind the hero with the hero story window,
// and the dot background behind the call-to-action card.
function DotBackdrop({ className }: { className: string }) {
  return (
    <div className={cn('absolute inset-0', className)}>
      <DotGrid dotSize={3} gap={22} baseColor="#dcdee3" activeColor="#2f5aba" proximity={120} shockStrength={2} glow={0.2} />
    </div>
  )
}

export function MotionDemo() {
  return (
    <main className="flex flex-col gap-16 pb-16">
      <section aria-label="Hero" className="relative overflow-hidden px-4 pb-16 pt-24 sm:px-8">
        <DotBackdrop className="[mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_75%)]" />
        <div className="relative mx-auto max-w-[1100px]">
          <HeroStory />
        </div>
      </section>
      <section aria-label="Call to action" className="px-4 sm:px-8">
        <div className="relative mx-auto h-[475px] max-w-[1200px] overflow-hidden rounded-[32px] border border-line bg-surface">
          <DotBackdrop className="[mask-image:radial-gradient(ellipse_at_center,black_20%,transparent_70%)]" />
        </div>
      </section>
    </main>
  )
}
