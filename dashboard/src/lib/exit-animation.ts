export async function exitAnimationFinished(element: Element) {
  await Promise.allSettled(element.getAnimations().map((animation) => animation.finished))
}
