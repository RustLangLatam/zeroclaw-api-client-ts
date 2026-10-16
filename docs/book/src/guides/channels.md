# Channels and group chats

A channel is named `type.alias` (`whatsapp.main`, `telegram.bot`), as
`client.channels.list()` returns it with its status, health and readiness.

Sending, group chats and redelivery are routes of the patched
`0.8.5+unified.18` build only (see [Compatibility](../reference/compatibility.md)).

## What the gateway requires

| Action | Needs |
|---|---|
| list channels, bind an identity, relink | a token |
| list rooms and members | a token, pairing on, the channel configured and running |
| send, create rooms, invite, remove members, redeliver | the above, plus the channel in `[gateway] send_channels` |
| create rooms and manage members on WhatsApp Web | also `room_management = true` on the channel |

Refusals carry the channel and the reason
(`{"channel": "whatsapp.main", "error": "…"}`), which the
[error](./errors.md) keeps as its `reason`.

## Sending

`channels.send(channel, to, content, threadId?)` delivers plain text with no
agent turn: for notifications a person, not the agent, is sending. With
`[gateway] send_groups_only`, only group chats can be addressed.

## Group chats

```ts
const channels = client.channels;
const created = await channels.createRoom("whatsapp.main", "Orders team", undefined, ["+34600000000"]);
for (const room of await channels.rooms("whatsapp.main")) {
  const members = await channels.roomMembers("whatsapp.main", room.id);
}
await channels.invite("whatsapp.main", created.room, "+34611111111");
await channels.removeMember("whatsapp.main", created.room, "+34611111111");
```

On WhatsApp, invitees are also added to the channel's allowlist, and the new
group to its allowed groups, so the agent answers in it. Creating rooms and
invitations are rate-limited per channel (`[gateway] rooms_per_hour`,
`invites_per_hour`, `invites_per_day`): over the limit the call fails with
429.

## Handing a message to its agent again

`channels.redeliver(channel, messageId)` hands a received message to its
agent again as a new turn. The gateway keeps only recent inbound messages,
in memory; one it no longer keeps answers 404 (`isNotFound(err)`).

## Identities and logins

- `bind(channelType, alias, identity)` allows a Telegram, WeChat or LINE
  user to talk to the channel.
- `relink(channel)` clears a QR-paired channel's saved login (WhatsApp Web);
  after `client.system.reload()` the channel asks to be paired again.
