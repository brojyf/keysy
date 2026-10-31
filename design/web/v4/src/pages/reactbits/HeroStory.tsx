import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { useEffect, useState } from 'react'
import { assistant, type SecretRow } from '@/content'
import { ProductWindow } from '@/shared/Product'
import ShinyText from '@/vendor/reactbits/ShinyText'
import TextType from '@/vendor/reactbits/TextType'

// The AI assistant moves the Stripe and Resend keys into production/shared, as in design/web/motion/hero-motion.html.
type Stage = 'typing' | 'sent' | 'thinking' | 'done' | 'fading'

const START_MS = 1200
const TYPING_MS = 32
const THOUGHT_MS = 1000
const HOLD_MS = 3500
// The paths change while the assistant shows its second thought.
const MOVE_AT_THOUGHT = 1
const { moves } = assistant
const smooth = { type: 'spring', visualDuration: 0.45, bounce: 0 } as const

function splitPath(path: string) {
  const cut = path.lastIndexOf('/') + 1
  return [path.slice(0, cut), path.slice(cut)]
}

function MovingPath({ row, moved }: { row: SecretRow; moved: boolean }) {
  const move = moves.find(m => m.to === row.path)
  const [folder, key] = splitPath(move && !moved ? move.from : row.path)
  return (
    <span className="inline-flex">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={folder}
          initial={{ opacity: 0, x: 6, filter: 'blur(2px)' }}
          animate={{ opacity: 1, x: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, x: -6, filter: 'blur(2px)' }}
          transition={smooth}
        >
          {folder}
        </motion.span>
      </AnimatePresence>
      <motion.span layout="position" transition={smooth}>
        {key}
      </motion.span>
    </span>
  )
}

function AssistantThread({ stage, thought, run }: { stage: Stage; thought: number; run: number }) {
  const rise = { initial: { opacity: 0, y: 12, scale: 0.96 }, animate: { opacity: 1, y: 0, scale: 1 }, exit: { opacity: 0 }, transition: smooth }
  return (
    <div className="flex h-full flex-col gap-3 p-4 text-[13px]">
      <p className="font-semibold">{assistant.title}</p>
      <AnimatePresence>
        {stage !== 'typing' && (
          <motion.p key="prompt" {...rise} className="self-end rounded-lg rounded-br-sm bg-button px-3 py-2 text-on-button">
            {assistant.prompt}
          </motion.p>
        )}
        {stage === 'thinking' && (
          <motion.div key="thinking" {...rise} className="text-xs">
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={thought}
                className="block"
                initial={{ opacity: 0, y: 6, filter: 'blur(2px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -6, filter: 'blur(2px)' }}
                transition={{ duration: 0.2 }}
              >
                <ShinyText text={assistant.thinking[thought]} color="#64666b" shineColor="#2f5aba" speed={1.6} />
              </motion.span>
            </AnimatePresence>
          </motion.div>
        )}
        {(stage === 'done' || stage === 'fading') && (
          <motion.div key="reply" {...rise} className="rounded-lg bg-soft px-3 py-2">
            <p>{assistant.reply}</p>
            <ul className="mt-2 flex flex-col gap-1 text-xs text-muted">
              {assistant.results.map((result, i) => (
                <motion.li key={result} initial={{ opacity: 0, x: -4 }} animate={{ opacity: 1, x: 0 }} transition={{ ...smooth, delay: 0.16 + i * 0.07 }}>
                  ✓ {result}
                </motion.li>
              ))}
            </ul>
            <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="mt-2 text-xs font-medium text-accent">
              {assistant.link}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mt-auto flex h-14 items-start justify-between gap-2 overflow-hidden rounded-lg border border-line px-3 py-2 text-xs">
        {stage === 'typing' ? (
          <TextType key={run} text={assistant.prompt} loop={false} typingSpeed={TYPING_MS} initialDelay={START_MS} cursorCharacter="|" />
        ) : (
          <span className="text-muted">{assistant.placeholder}</span>
        )}
        <span className="grid size-5 shrink-0 place-items-center rounded-md bg-button text-on-button">↑</span>
      </div>
    </div>
  )
}

export function HeroStory() {
  const reduceMotion = useReducedMotion()
  const [run, setRun] = useState(0)
  const [stage, setStage] = useState<Stage>(reduceMotion ? 'done' : 'typing')
  const [thought, setThought] = useState(0)

  useEffect(() => {
    if (reduceMotion) return
    const typed = START_MS + assistant.prompt.length * TYPING_MS + 300
    const steps: [number, () => void][] = [
      [typed, () => setStage('sent')],
      [500, () => setStage('thinking')],
      ...assistant.thinking.slice(1).map((_, i): [number, () => void] => [THOUGHT_MS, () => setThought(i + 1)]),
      [THOUGHT_MS, () => setStage('done')],
      [HOLD_MS, () => setStage('fading')],
      [400, () => {
        setThought(0)
        setStage('typing')
        setRun(r => r + 1)
      }],
    ]
    let at = 0
    const timers = steps.map(([wait, step]) => setTimeout(step, (at += wait)))
    return () => timers.forEach(clearTimeout)
  }, [run, reduceMotion])

  const moved = stage === 'done' || stage === 'fading' || (stage === 'thinking' && thought >= MOVE_AT_THOUGHT)
  const movedPaths = moves.map(m => m.to)

  return (
    <motion.div key={run} initial={{ opacity: run === 0 ? 1 : 0 }} animate={{ opacity: stage === 'fading' ? 0 : 1 }} transition={{ duration: 0.35 }}>
      <ProductWindow
        aside={<AssistantThread stage={stage} thought={thought} run={run} />}
        highlightedPaths={moved ? movedPaths : []}
        renderPath={row => <MovingPath row={row} moved={moved} />}
      />
    </motion.div>
  )
}
