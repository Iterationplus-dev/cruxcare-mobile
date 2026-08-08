describe('Book & attend therapy (PRD 5.3)', () => {
  beforeEach(() => cy.loginAsDemo());

  it('books an appointment with the assigned therapist', () => {
    cy.location('pathname').should('include', '/tabs/home');
    cy.contains('ion-tab-button', 'Care').click();
    cy.location('pathname').should('include', '/tabs/care');

    cy.contains('Amaka Obi'); // seeded assigned therapist
    cy.contains('button', 'Book').click();

    cy.location('pathname').should('include', '/care/book');
    cy.contains('button', '09:00').click();
    cy.contains('button', 'Request this slot').click();

    cy.location('pathname').should('include', '/tabs/care');
  });

  it('sends a chat message to the therapist', () => {
    cy.contains('ion-tab-button', 'Care').click();
    cy.contains('button', 'Message').click();

    cy.location('pathname').should('include', '/messages/');
    const body = `Smoke test message ${Date.now()}`;
    cy.get('.cc-thread__composer input').type(`${body}{enter}`);
    cy.contains(body);
  });
});
