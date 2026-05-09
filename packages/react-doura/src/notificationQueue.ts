type Notify = () => void

const pendingNotifications = new Set<Notify>()
let flushTask: ReturnType<typeof setTimeout> | undefined

function flushNotifications() {
  flushTask = undefined

  const notifications = Array.from(pendingNotifications)
  pendingNotifications.clear()

  for (let i = 0; i < notifications.length; i++) {
    notifications[i]()
  }
}

export function queueReactNotification(notify: Notify): void {
  pendingNotifications.add(notify)

  if (flushTask === undefined) {
    flushTask = setTimeout(flushNotifications, 0)
  }
}

export function cancelReactNotification(notify: Notify): void {
  pendingNotifications.delete(notify)
}

export function hasPendingReactNotifications(): boolean {
  return pendingNotifications.size > 0
}
