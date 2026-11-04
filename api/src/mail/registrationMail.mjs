// Turns an outbox payload into the confirmation mail. A pure function: easy to test and to change.
export function registrationMail({ name, email, event }) {
  const when = new Date(event.startsAt).toLocaleString('en-GB', {
    dateStyle: 'full',
    timeStyle: 'short',
    timeZone: 'Europe/Brussels'
  });
  return {
    to: email,
    subject: `You're registered: ${event.title}`,
    text: [
      `Hi ${name},`,
      '',
      `You're registered for "${event.title}".`,
      `When: ${when}`,
      `Where: ${event.location}`,
      '',
      'See you there!',
      'Campus Events'
    ].join('\n')
  };
}
