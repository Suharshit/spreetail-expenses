import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding users and group...')

  const users = [
    { name: 'Aisha',  email: 'aisha@flat.com',  password: 'password123' },
    { name: 'Rohan',  email: 'rohan@flat.com',  password: 'password123' },
    { name: 'Priya',  email: 'priya@flat.com',  password: 'password123' },
    { name: 'Meera',  email: 'meera@flat.com',  password: 'password123' },
    { name: 'Sam',    email: 'sam@flat.com',    password: 'password123' },
    { name: 'Dev',    email: 'dev@flat.com',    password: 'password123' },
  ]

  const createdUsers: Record<string, string> = {}

  for (const u of users) {
    const hash = await bcrypt.hash(u.password, 10)
    const user = await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: { name: u.name, email: u.email, passwordHash: hash },
    })
    createdUsers[u.name] = user.id
    console.log(`Created user: ${u.name}`)
  }

  // Create the group
  const group = await prisma.group.upsert({
    where: { id: 'flat-group-id-001' },
    update: {},
    create: {
      id: 'flat-group-id-001',
      name: 'The Flat',
      description: 'Aisha, Rohan, Priya, Meera, Sam shared flat',
      createdBy: createdUsers['Aisha'],
    },
  })
  console.log('Created group: The Flat')

  // Create memberships with correct dates
  const memberships = [
    { userId: createdUsers['Aisha'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: createdUsers['Rohan'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: createdUsers['Priya'], joinedAt: new Date('2026-02-01'), leftAt: null },
    { userId: createdUsers['Meera'], joinedAt: new Date('2026-02-01'), leftAt: new Date('2026-03-31') },
    { userId: createdUsers['Dev'],   joinedAt: new Date('2026-03-08'), leftAt: new Date('2026-03-14') },
    { userId: createdUsers['Sam'],   joinedAt: new Date('2026-04-15'), leftAt: null },
  ]

  for (const m of memberships) {
    await prisma.groupMembership.upsert({
      where: { groupId_userId: { groupId: group.id, userId: m.userId } },
      update: {},
      create: { groupId: group.id, ...m },
    })
  }
  console.log('Created memberships')
  console.log('Seeding complete!')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())