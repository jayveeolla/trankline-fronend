import type { ReactNode } from 'react'
import './module-pages.css'

export default function ModulePageFrame({ title, description, children }: { title: string; description: string; children?: ReactNode }) {
  return <section className="workspace-page module-page-frame">
    <div className="page-heading workspace-page-heading">
      <div><div className="eyebrow"><span className="pulse-dot" /> TRACKLINE WORKSPACE</div><h1>{title}</h1><p>{description}</p></div>
    </div>
    {children || <div className="module-empty-state"><strong>{title}</strong><span>This module is ready for its dedicated workflow.</span></div>}
  </section>
}
