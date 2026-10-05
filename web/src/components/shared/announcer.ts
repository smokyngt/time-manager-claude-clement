type Listener = (message: string) => void

const listeners = new Set<Listener>()

export class Announcer {
  /**
   * @route client.components.announcer.say
   * @param {string} message Text read out by screen readers.
   * @returns {void}
   */
  static say(message: string): void {
    listeners.forEach((listener) => {
      listener(message)
    })
  }

  /**
   * @route client.components.announcer.subscribe
   * @param {(message: string) => void} listener
   * @returns {() => void} Unsubscribe.
   */
  static subscribe(listener: Listener): () => void {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }
}
