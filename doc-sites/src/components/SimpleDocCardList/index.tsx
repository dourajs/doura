import React from 'react'
import clsx from 'clsx'
import { Props as CardProps, DocCard } from '../DocCard'

export interface Props {
  items: CardProps[]
  className?: string
}

export function SimpleDocCardList({ items, className }: Props) {
  return (
    <section className={clsx('row', className)}>
      {items.map((item, index) => (
        <article key={index} className="col col--6 margin-bottom--lg">
          <DocCard {...item} />
        </article>
      ))}
    </section>
  )
}
