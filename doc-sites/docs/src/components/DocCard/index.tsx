import React from 'react'
import clsx from 'clsx'
// import Translate from "@docusaurus/Translate";
import Link from '@docusaurus/Link'
import style from './style.module.css'

export interface Props {
  title: string
  url: string
  description: JSX.Element
}

export function DocCard({ title, url, description }: Props) {
  return (
    <div className={clsx(style.card)}>
      <Link to={url}>
        <h2 className={clsx(style.cardTitle)}>{title}</h2>
        <p className={clsx(style.cardDescription)}>{description}</p>
      </Link>
    </div>
  )
}
