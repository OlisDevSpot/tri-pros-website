/* eslint-disable node/prefer-global/process */
import type { InsertProject } from '@/db/schema'
import fs from 'node:fs'
import path from 'node:path'
import { db } from '@/db'
import { projects } from '@/db/schema'
import { mediaFiles } from '@/db/schema/media-files'
import { projectsData } from './projects'

async function createProject(data: Omit<InsertProject, 'address' | 'state' | 'customerId'>) {
  const [newProject] = await db.insert(projects).values(data).returning().onConflictDoUpdate({
    target: projects.accessor,
    set: {
      title: data.title,
      description: data.description,
    },
  })

  return newProject
}

async function seedMediaFilesInDrizzle() {
  for (const project of projectsData) {
    const newProject = await createProject({
      title: project.title,
      accessor: project.accessor,
      description: project.description,
      city: 'Beverly Hills',
    })
    const folder = path.join(process.cwd(), 'public', 'portfolio-photos', 'projects', project.title)

    const files = fs.readdirSync(folder)

    for (const file of files) {
      // const filePath = path.join(folder, file)
      // const fileData = fs.readFileSync(filePath)

      await db.insert(mediaFiles).values({
        name: file,
        pathKey: `projects/${newProject.title}/${file}`,
        bucket: 'portfolio-photos',
        mimeType: 'image/jpeg',
        fileExtension: 'jpeg',
        url: `https://one-stop-sales.r2.cloudflarestorage.com/portfolio-photos/projects/${newProject.title}/${file}`,
        tags: [],
        isHeroImage: false,
        projectId: newProject.id,
      })
    }
  }
}

seedMediaFilesInDrizzle()
