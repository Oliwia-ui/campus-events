import { Event, Registration } from '../models/index.mjs';

const inDays = (days, hour = 14) => {
  const date = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
  date.setHours(hour, 0, 0, 0);
  return date;
};

export async function seedDemoData() {
  await Event.bulkCreate([
    {
      title: 'Welcome Day IXD',
      description: 'Meet your classmates, lecturers and the projects of this year.',
      location: 'Campus Mechelen',
      startsAt: inDays(7, 10),
      capacity: 120
    },
    {
      title: 'Prototyping with Figma & APIs',
      description: 'Connect a clickable prototype to real data in one afternoon.',
      location: 'Room B204',
      startsAt: inDays(14),
      capacity: 25
    },
    {
      title: 'Backend Bootcamp',
      description: 'A small, hands-on session. Only two seats, so be quick.',
      location: 'Room C101',
      startsAt: inDays(21),
      capacity: 2
    },
    {
      title: 'Portfolio Review',
      description: 'Get feedback on your portfolio from industry guests.',
      location: 'Online',
      startsAt: inDays(-10),
      capacity: 40
    }
  ]);

  await Registration.bulkCreate([
    { eventId: 1, name: 'Ada Lovelace', email: 'ada@example.com' },
    { eventId: 1, name: 'Grace Hopper', email: 'grace@example.com' },
    { eventId: 2, name: 'Alan Turing', email: 'alan@example.com' }
  ]);
}
