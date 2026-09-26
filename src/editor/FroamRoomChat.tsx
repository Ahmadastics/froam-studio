import type { RoomClient, RoomMemberView } from '../collab/room'
import type { FroamRole, FroamRoomEvent } from '../collab/types'
import { RoomMessages } from './collaborate/RoomMessages'
import { useRoomMessages } from './collaborate/useRoomMessages'

type Props = {
  client: RoomClient | null
  events: readonly FroamRoomEvent[]
  role: FroamRole | null
  roomId: string | null
  members: readonly RoomMemberView[]
}

/**
 * The room conversation for the client review bar — the same messages the
 * studio's Share → Chat shows, so a client and the team talk in one place.
 */
export default function FroamRoomChat({ client, events, role, roomId, members }: Props) {
  const me = client?.joined ? client.identity?.actor ?? null : null
  const messaging = useRoomMessages({ client, events, roomId, role, me })
  if (!client?.joined) return null
  return (
    <RoomMessages
      messaging={messaging}
      me={me}
      person={(actor) => members.find((member) => member.actor === actor)}
      requests={[]}
      active
      context={null}
      onClearContext={() => {}}
      canModerate={role === 'owner' || role === 'editor'}
      joined
    />
  )
}
