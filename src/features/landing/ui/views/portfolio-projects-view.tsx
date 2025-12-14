'use client'

import { PortfolioProjectsHero } from '../components/portfolio/projects/hero'

export function PortfolioProjectsView() {
  return (
    <main>
      <PortfolioProjectsHero />
      {/* <div>
        <h1>Projects</h1>
        <div>
          {projects.map((project, index) => (
            <div key={project.title}>
              <h2>{project.title}</h2>
              <p>{project.description}</p>
            </div>
          ))}
        </div>
      </div> */}
    </main>
  )
}
