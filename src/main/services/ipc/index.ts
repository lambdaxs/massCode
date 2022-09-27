import { subscribeToContextMenu } from './context-menu'
import { subscribeToNotification } from './notifications'
import { subscribeToPrettier } from './prettier'
import {subscribeToMoyu} from './moyu'

export const subscribeToChannels = () => {
  subscribeToContextMenu()
  subscribeToNotification()
  subscribeToPrettier()
  subscribeToMoyu()
}
