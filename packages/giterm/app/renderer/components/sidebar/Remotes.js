import React, { useMemo } from 'react'
import { useSelector } from 'app/store'

import { clipboard } from 'electron'
import { Cloud } from 'react-feather'

import { Section } from './Section'
import { RightClickArea, List } from 'app/lib/primitives'

export function Remotes() {
  const _remotes = useSelector((state) => state.remotes)
  const remotes = useMemo(() => {
    const remotes = []

    for (const remote of _remotes || []) {
      remotes.push({
        id: remote.name,
        name: remote.name,
        menuItems: [
          {
            label: 'Copy ID',
            click: () => clipboard.writeText(remote.name),
          },
        ],
      })
    }

    return remotes
  }, [_remotes])

  return (
    <Section data-testid="remotes" title="REMOTES" icon={<Cloud size={15} />}>
      {remotes.map((remote) => {
        return (
          <RightClickArea
            data-testid="remote"
            data-remoteid={remote.name}
            key={remote.id}
            menuItems={remote.menuItems}>
            <List.Row>
              <List.Label>{remote.name}</List.Label>
            </List.Row>
          </RightClickArea>
        )
      })}
    </Section>
  )
}
