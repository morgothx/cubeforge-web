import { nameOf } from './member-identity';

/**
 * Naming a person the caller may not see the address of.
 *
 * The claim is narrow and worth stating exactly: the identifier must be
 * **stable**, **never empty**, and must not be the address by another route.
 */
describe('what to call a member', () => {
  it('uses the address the backend disclosed', () => {
    expect(nameOf({ personId: 'person-1', email: 'someone@example.com' })).toBe(
      'someone@example.com',
    );
  });

  it('names them opaquely when it disclosed none', () => {
    const name = nameOf({ personId: 'person-1', email: undefined });

    expect(name).toMatch(/^person_[0-9a-f]{6}$/);
  });

  it('says the same thing about the same person every time', () => {
    // Across renders and across reloads. An identifier that changed would make
    // two rows for one person out of a listing that has one.
    expect(nameOf({ personId: 'person-1' })).toBe(
      nameOf({ personId: 'person-1' }),
    );
  });

  it('says different things about different people', () => {
    expect(nameOf({ personId: 'person-1' })).not.toBe(
      nameOf({ personId: 'person-2' }),
    );
  });

  it('spells nothing the id happened to contain', () => {
    // Slicing the id was the cheaper implementation and this is why it was not
    // taken: `person-caller` would have arrived on screen as `person_caller`,
    // and a real id would have surrendered its prefix to anybody reading.
    expect(nameOf({ personId: 'person-caller' })).not.toContain('caller');
  });

  it('is never empty, whatever it was given', () => {
    // The whole point of the column existing at all (7.2).
    expect(nameOf({ personId: '', email: undefined })).not.toBe('');
  });
});
